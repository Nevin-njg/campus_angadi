import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
import { queryKeys } from '../../../lib/query-keys'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { notificationPath } from '../lib/notification-link'
export function NotificationsPage() {
  const c = useQueryClient()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const q = useQuery({
    queryKey: queryKeys.notifications.all(user?.id ?? ''),
    queryFn: () => notificationsApi.list({ page: 1, limit: 50 }),
  })
  const read = useMutation({
    mutationFn: notificationsApi.read,
    onSuccess: async () => {
      await c.invalidateQueries({ queryKey: queryKeys.notifications.all(user?.id ?? '') })
      await c.invalidateQueries({ queryKey: queryKeys.notifications.unread(user?.id ?? '') })
    },
  })
  const all = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: async () => {
      await c.invalidateQueries({ queryKey: queryKeys.notifications.all(user?.id ?? '') })
      await c.invalidateQueries({ queryKey: queryKeys.notifications.unread(user?.id ?? '') })
    },
  })

  const clear = useMutation({
    mutationFn: notificationsApi.deleteAll,
    onSuccess: async () => {
      await c.invalidateQueries({ queryKey: queryKeys.notifications.all(user?.id ?? '') })
      await c.invalidateQueries({ queryKey: queryKeys.notifications.unread(user?.id ?? '') })
    },
  })

  const unread = q.data?.items.filter((item) => !item.read).length ?? 0
  async function openNotification(item: NonNullable<typeof q.data>['items'][number]) {
    if (!item.read) {
      try {
        await read.mutateAsync(item.id)
      } catch {
        return
      }
    }

    if (!user) return

    const path = notificationPath(item, user.role)
    if (path) void navigate(path)
  }

  function clearAllNotifications() {
    const confirmed = window.confirm(
      'Clear all notifications? This will permanently remove all of your notifications.',
    )

    if (!confirmed) return

    clear.mutate()
  }

  return (
    <section className="container notifications-page">
      <div className="page-title-row">
        <div>
          <h1>Notifications</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button button-outline"
            disabled={!unread || all.isPending}
            onClick={() => all.mutate()}
          >
            {all.isPending ? 'Updating…' : `Mark all read${unread ? ` (${unread})` : ''}`}
          </button>

          <button
            className="button button-outline"
            disabled={!q.data?.items.length || clear.isPending}
            onClick={clearAllNotifications}
          >
            {clear.isPending ? 'Clearing…' : 'Clear all'}
          </button>
        </div>
      </div>
      <div className="notification-list">
        {q.isLoading ? (
          <div className="catalog-empty">
            <strong>Loading notifications…</strong>
          </div>
        ) : null}
        {q.isError ? (
          <div className="catalog-empty">
            <strong>Could not load notifications</strong>
            <span>{q.error.message}</span>
          </div>
        ) : null}
        {read.isError ? (
          <div className="form-error" role="alert">
            {read.error.message}
          </div>
        ) : null}

        {clear.isError ? (
          <div className="form-error" role="alert">
            {clear.error.message}
          </div>
        ) : null}

        {q.data?.items.map((x) => (
          <div key={x.id} className="flex items-stretch gap-2">
            <button
              type="button"
              className={`notification-card min-w-0 flex-1 ${x.read ? '' : 'unread'}`}
              onClick={() => void openNotification(x)}
            >
              <div>
                <span>{x.type}</span>
                <strong>{x.title}</strong>
                <p>{x.message}</p>
              </div>
              <small>{new Date(x.createdAt).toLocaleString()}</small>
            </button>
          </div>
        ))}
        {!q.isLoading && !q.isError && !q.data?.items.length ? (
          <div className="catalog-empty">
            <strong>No notifications</strong>
            <span>You are all caught up.</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

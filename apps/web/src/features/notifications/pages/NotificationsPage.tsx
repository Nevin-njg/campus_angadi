import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
export function NotificationsPage() {
  const c = useQueryClient()
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ page: 1, limit: 50 }),
  })
  const read = useMutation({
    mutationFn: notificationsApi.read,
    onSuccess: async () => {
      await c.invalidateQueries({ queryKey: ['notifications'] })
      await c.invalidateQueries({ queryKey: ['notifications', 'unread'] })
    },
  })
  const all = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: async () => {
      await c.invalidateQueries({ queryKey: ['notifications'] })
      await c.invalidateQueries({ queryKey: ['notifications', 'unread'] })
    },
  })
  const unread = q.data?.items.filter((item) => !item.read).length ?? 0
  return (
    <section className="container notifications-page">
      <div className="page-title-row">
        <div>
          <span className="section-kicker">Account updates</span>
          <h1>Notifications</h1>
          <p>Order, product, report and account messages.</p>
        </div>
        <button className="button button-outline" disabled={!unread || all.isPending} onClick={() => all.mutate()}>
          {all.isPending ? 'Updating…' : `Mark all read${unread ? ` (${unread})` : ''}`}
        </button>
      </div>
      <div className="notification-list">
        {q.isLoading ? <div className="catalog-empty"><strong>Loading notifications…</strong></div> : null}
        {q.isError ? <div className="catalog-empty"><strong>Could not load notifications</strong><span>{q.error.message}</span></div> : null}
        {q.data?.items.map((x) => (
          <button
            className={`notification-card ${x.read ? '' : 'unread'}`}
            key={x.id}
            onClick={() => !x.read && read.mutate(x.id)}
          >
            <div>
              <span>{x.type}</span>
              <strong>{x.title}</strong>
              <p>{x.message}</p>
            </div>
            <small>{new Date(x.createdAt).toLocaleString()}</small>
          </button>
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

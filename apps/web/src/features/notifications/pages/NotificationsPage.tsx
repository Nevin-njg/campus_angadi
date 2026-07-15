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
  return (
    <section>
      <div className="page-title-row">
        <div>
          <span className="section-kicker">Account updates</span>
          <h1>Notifications</h1>
          <p>Order, product, report and account messages.</p>
        </div>
        <button className="button button-outline" onClick={() => all.mutate()}>
          Mark all read
        </button>
      </div>
      <div className="notification-list">
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
        {!q.data?.items.length ? (
          <div className="catalog-empty">
            <strong>No notifications</strong>
            <span>You are all caught up.</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

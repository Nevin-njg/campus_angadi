import type { Notification, NotificationListQuery, PaginatedResult } from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'
function qs(q: NotificationListQuery) {
  const p = new URLSearchParams({ page: String(q.page), limit: String(q.limit) })
  if (q.unreadOnly !== undefined) p.set('unreadOnly', String(q.unreadOnly))
  return `?${p}`
}
export const notificationsApi = {
  async list(q: NotificationListQuery): Promise<PaginatedResult<Notification>> {
    const r = await apiRequestEnvelope<Notification[]>(`/notifications${qs(q)}`)
    return { items: r.data, meta: r.meta! }
  },
  unread: () => apiRequest<{ count: number }>('/notifications/unread-count'),
  read: (id: string) => apiRequest<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),
  readAll: () => apiRequest<null>('/notifications/read-all', { method: 'PATCH' }),

  pushConfig: () =>
    apiRequest<{ enabled: boolean; publicKey: string | null }>(
      '/notifications/push/public-key',
    ),

  subscribePush: (subscription: {
    endpoint: string
    expirationTime: number | null
    keys: {
      p256dh: string
      auth: string
    }
  }) =>
    apiRequest<{ subscribed: boolean }>('/notifications/push/subscribe', {
      method: 'POST',
      body: subscription,
    }),

  unsubscribePush: (endpoint: string) =>
    apiRequest<{ subscribed: boolean }>('/notifications/push/unsubscribe', {
      method: 'DELETE',
      body: { endpoint },
    }),
}

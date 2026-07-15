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
}

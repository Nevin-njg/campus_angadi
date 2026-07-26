import type { Notification, UserRole } from '@campusbaza/contracts'

export function notificationPath(
  notification: Pick<Notification, 'referenceType' | 'referenceId'>,
  role: UserRole,
): string | null {
  if (!notification.referenceType || !notification.referenceId) return null
  const type = notification.referenceType.toUpperCase()
  const id = encodeURIComponent(notification.referenceId)
  const isStaff = role === 'MODERATOR' || role === 'ADMIN' || role === 'SUPER_ADMIN'

  if (type === 'ORDER') return isStaff ? `/admin/orders/${id}` : `/account/orders/${id}`
  if (type === 'CHECKOUT') return `/account/orders?created=${id}`
  if (type === 'PRODUCT') return `/account/listings/${id}`
  if (type === 'REPORT') return '/account/reports'
  if (type === 'USER') return '/account/profile'
  return null
}

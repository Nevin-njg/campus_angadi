import type { NotificationListQuery, SendNotificationInput } from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type { NotificationRepository } from '../domain/notification.js'

export class NotificationService {
  constructor(private readonly notifications: NotificationRepository) {}
  list(userId: string, query: NotificationListQuery) {
    return this.notifications.list(userId, query)
  }
  unreadCount(userId: string) {
    return this.notifications.unreadCount(userId)
  }
  async markRead(userId: string, id: string) {
    const value = await this.notifications.markRead(userId, id)
    if (!value) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.')
    return value
  }
  markAllRead(userId: string) {
    return this.notifications.markAllRead(userId)
  }
  send(input: SendNotificationInput) {
    return this.notifications.send(input)
  }
}

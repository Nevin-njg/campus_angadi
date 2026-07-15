import type {
  Notification,
  NotificationListQuery,
  PaginatedResult,
  SendNotificationInput,
  UserRole,
} from '@campusbaza/contracts'

export interface NotificationRepository {
  list(userId: string, query: NotificationListQuery): Promise<PaginatedResult<Notification>>
  unreadCount(userId: string): Promise<number>
  markRead(userId: string, id: string): Promise<Notification | null>
  markAllRead(userId: string): Promise<void>
  send(input: SendNotificationInput): Promise<number>
  sendToUser(
    userId: string,
    input: Omit<SendNotificationInput, 'userId' | 'audience'>,
  ): Promise<void>
  recipientIdsForAudience(role: UserRole | 'ALL'): Promise<string[]>
}

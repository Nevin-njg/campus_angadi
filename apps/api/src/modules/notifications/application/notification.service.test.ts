import { describe, expect, it } from 'vitest'
import type {
  Notification,
  NotificationListQuery,
  PaginatedResult,
  SendNotificationInput,
  UserRole,
} from '@campusbaza/contracts'
import type { NotificationRepository } from '../domain/notification.js'
import { NotificationService } from './notification.service.js'

const item: Notification = {
  id: 'n1',
  type: 'SYSTEM',
  title: 'Hello',
  message: 'Welcome',
  referenceType: null,
  referenceId: null,
  read: false,
  createdAt: new Date().toISOString(),
  readAt: null,
}
class Fake implements NotificationRepository {
  markedAll = false
  list(userId: string, query: NotificationListQuery): Promise<PaginatedResult<Notification>> {
    void userId
    void query
    return Promise.resolve({ items: [item], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  }
  unreadCount() {
    return Promise.resolve(1)
  }
  markRead(userId: string, id: string) {
    void userId
    return Promise.resolve(
      id === 'n1' ? { ...item, read: true, readAt: new Date().toISOString() } : null,
    )
  }
  markAllRead() {
    this.markedAll = true
    return Promise.resolve()
  }
  send(input: SendNotificationInput) {
    void input
    return Promise.resolve(3)
  }
  sendToUser() {
    return Promise.resolve()
  }
  recipientIdsForAudience(role: UserRole | 'ALL') {
    void role
    return Promise.resolve([])
  }
}
describe('NotificationService', () => {
  it('returns unread counts and marks owned notifications read', async () => {
    const service = new NotificationService(new Fake())
    expect(await service.unreadCount('u1')).toBe(1)
    expect((await service.markRead('u1', 'n1')).read).toBe(true)
  })
  it('rejects an unknown notification', async () => {
    const service = new NotificationService(new Fake())
    await expect(service.markRead('u1', 'missing')).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
    })
  })
})

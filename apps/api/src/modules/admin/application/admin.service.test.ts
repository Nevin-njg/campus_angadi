import { describe, expect, it, vi } from 'vitest'
import type {
  AdminUserDetail,
  Notification,
  NotificationListQuery,
  PaginatedResult,
  SendNotificationInput,
  UserRole,
} from '@campusbaza/contracts'
import type { NotificationRepository } from '../../notifications/domain/notification.js'
import type { OrderService } from '../../orders/application/order.service.js'
import { AdminService } from './admin.service.js'
import type { MongooseAdminRepository } from '../infrastructure/mongoose-admin.repository.js'

const target: AdminUserDetail = {
  id: 'target',
  email: 'owner@campusbaza.example.edu',
  displayName: 'Owner',
  fullName: 'Owner',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  canSell: true,
  profileCompleted: true,
  listingCount: 0,
  orderCount: 0,
  completedSalesCount: 0,
  createdAt: new Date().toISOString(),
  lastActiveAt: null,
  phoneNumber: null,
  department: null,
  graduationYear: null,
  campusRole: null,
  bio: null,
  internalNotes: null,
}
class NotificationFake implements NotificationRepository {
  sent: string[] = []
  list(userId: string, query: NotificationListQuery): Promise<PaginatedResult<Notification>> {
    void userId
    void query
    throw new Error('unused')
  }
  unreadCount() {
    return Promise.resolve(0)
  }
  markRead() {
    return Promise.resolve(null)
  }
  markAllRead() {
    return Promise.resolve()
  }
  send(input: SendNotificationInput) {
    void input
    return Promise.resolve(0)
  }
  sendToUser(userId: string) {
    this.sent.push(userId)
    return Promise.resolve()
  }
  recipientIdsForAudience(role: UserRole | 'ALL') {
    void role
    return Promise.resolve([])
  }
}
function makeService(superAdminCount = 1) {
  const updateUser = vi.fn().mockResolvedValue({ ...target, role: 'USER' })
  const repo = {
    getUser: vi.fn().mockResolvedValue(target),
    superAdminCount: vi.fn().mockResolvedValue(superAdminCount),
    updateUser,
  } as unknown as MongooseAdminRepository
  return { service: new AdminService(repo, {} as OrderService, new NotificationFake()), updateUser }
}
describe('AdminService user protection', () => {
  it('requires a super admin to manage a super-admin account', async () => {
    const { service } = makeService()
    await expect(
      service.updateUser({ id: 'admin', role: 'ADMIN' }, 'target', {
        status: 'BLOCKED',
        reason: 'Security review',
      }),
    ).rejects.toMatchObject({ code: 'SUPER_ADMIN_REQUIRED' })
  })
  it('protects the final active super administrator from demotion', async () => {
    const { service, updateUser } = makeService(1)
    await expect(
      service.updateUser({ id: 'other-owner', role: 'SUPER_ADMIN' }, 'target', {
        role: 'USER',
        reason: 'Role cleanup',
      }),
    ).rejects.toMatchObject({ code: 'LAST_SUPER_ADMIN' })
    expect(updateUser).not.toHaveBeenCalled()
  })
})

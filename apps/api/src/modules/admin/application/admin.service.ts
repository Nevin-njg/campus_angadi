import type {
  AdminUserListQuery,
  EnrollMediatorInput,
  SalesAnalyticsQuery,
  UpdateAdminUserInput,
  UserRole,
} from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type { OrderService } from '../../orders/application/order.service.js'
import type { NotificationRepository } from '../../notifications/domain/notification.js'
import type { MongooseAdminRepository } from '../infrastructure/mongoose-admin.repository.js'
export class AdminService {
  constructor(
    private readonly repo: MongooseAdminRepository,
    private readonly orders: OrderService,
    private readonly notifications: NotificationRepository,
  ) {}
  async dashboard() {
    const [base, recent] = await Promise.all([
      this.repo.dashboardBase(),
      this.orders.listAdmin({ page: 1, limit: 5 }),
    ])
    return { ...base, recentOrders: recent.items }
  }
  listUsers(q: AdminUserListQuery) {
    return this.repo.listUsers(q)
  }
  async getUser(id: string) {
    const v = await this.repo.getUser(id)
    if (!v) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.')
    return v
  }
  async updateUser(actor: { id: string; role: UserRole }, id: string, input: UpdateAdminUserInput) {
    const target = await this.getUser(id)
    if (id === actor.id && input.status && input.status !== 'ACTIVE')
      throw new AppError(409, 'CANNOT_DISABLE_SELF', 'You cannot disable your own account.')
    if (
      (input.role || input.canMediateOrders !== undefined || target.role === 'SUPER_ADMIN') &&
      actor.role !== 'SUPER_ADMIN'
    )
      throw new AppError(
        403,
        'SUPER_ADMIN_REQUIRED',
        'Only a super administrator can manage administrator roles.',
      )
    if (
      target.role === 'SUPER_ADMIN' &&
      input.role &&
      input.role !== 'SUPER_ADMIN' &&
      (await this.repo.superAdminCount()) <= 1
    )
      throw new AppError(
        409,
        'LAST_SUPER_ADMIN',
        'The last active super administrator cannot be demoted.',
      )
    const value = await this.repo.updateUser(id, input)
    if (!value) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.')
    await this.notifications.sendToUser(id, {
      type: 'ACCOUNT',
      title: 'Account updated',
      message: `An administrator updated your account. Reason: ${input.reason}`,
      referenceType: 'USER',
      referenceId: id,
    })
    return value
  }
  async enrollMediator(actor: { id: string; role: UserRole }, input: EnrollMediatorInput) {
    if (input.access === 'ADMIN_MEDIATOR' && actor.role !== 'SUPER_ADMIN')
      throw new AppError(
        403,
        'SUPER_ADMIN_REQUIRED',
        'Only a super administrator can grant administrator access.',
      )
    const email = input.email.trim().toLowerCase()
    const existing = await this.repo.getUserByEmail(email)
    let role: 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN' =
      input.access === 'ADMIN_MEDIATOR' ? 'ADMIN' : 'MODERATOR'
    if (existing?.role === 'SUPER_ADMIN') role = 'SUPER_ADMIN'
    else if (existing?.role === 'ADMIN') role = 'ADMIN'
    const value = await this.repo.enrollMediator(email, role)
    if (!value) throw new AppError(500, 'MEDIATOR_ENROLLMENT_FAILED', 'Could not add mediator access.')
    await this.notifications.sendToUser(value.id, {
      type: 'ACCOUNT',
      title: 'Mediator access enabled',
      message: `You can now sign in with ${email} and use the mediator inbox. Reason: ${input.reason}`,
      referenceType: 'USER',
      referenceId: value.id,
    })
    return value
  }
  sales(q: SalesAnalyticsQuery) {
    return this.repo.sales(q)
  }
}

import type {
  Notification,
  NotificationListQuery,
  PaginatedResult,
  SendNotificationInput,
  UserRole,
} from '@campusbaza/contracts'
import type { NotificationRepository } from '../domain/notification.js'
import { NotificationModel } from './notification.model.js'
import { UserModel } from '../../users/infrastructure/user.models.js'

function map(document: Record<string, unknown>): Notification {
  return {
    id: String(document._id),
    type: document.type as Notification['type'],
    title: String(document.title),
    message: String(document.message),
    referenceType: (document.referenceType as string | null) ?? null,
    referenceId: (document.referenceId as string | null) ?? null,
    read: Boolean(document.readAt),
    createdAt: (document.createdAt as Date).toISOString(),
    readAt: document.readAt ? (document.readAt as Date).toISOString() : null,
  }
}

export class MongooseNotificationRepository implements NotificationRepository {
  async list(userId: string, query: NotificationListQuery): Promise<PaginatedResult<Notification>> {
    const filter: Record<string, unknown> = { userId }
    if (query.unreadOnly) filter.readAt = null
    const [documents, total] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<Record<string, unknown>[]>(),
      NotificationModel.countDocuments(filter),
    ])
    return {
      items: documents.map(map),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }

  unreadCount(userId: string) {
    return NotificationModel.countDocuments({ userId, readAt: null })
  }

  async markRead(userId: string, id: string): Promise<Notification | null> {
    const document = await NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { readAt: new Date() } },
      { new: true },
    ).lean<Record<string, unknown>>()
    return document ? map(document) : null
  }

  async markAllRead(userId: string): Promise<void> {
    await NotificationModel.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } })
  }

  async recipientIdsForAudience(role: UserRole | 'ALL'): Promise<string[]> {
    const filter: Record<string, unknown> = { status: 'ACTIVE' }
    if (role === 'USER') filter.role = 'USER'
    if (role === 'ADMIN') filter.role = { $in: ['ADMIN', 'SUPER_ADMIN'] }
    return (await UserModel.find(filter).distinct('_id')).map(String)
  }

  async send(input: SendNotificationInput): Promise<number> {
    const ids = input.userId
      ? [input.userId]
      : await this.recipientIdsForAudience(input.audience ?? 'ALL')
    if (!ids.length) return 0
    await NotificationModel.insertMany(
      ids.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
      })),
    )
    return ids.length
  }

  async sendToUser(
    userId: string,
    input: Omit<SendNotificationInput, 'userId' | 'audience'>,
  ): Promise<void> {
    await NotificationModel.create({
      userId,
      ...input,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
    })
  }
}

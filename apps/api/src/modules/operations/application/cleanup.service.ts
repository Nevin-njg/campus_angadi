import type { CleanupResult } from '@campusbaza/contracts'
import { AuditLogModel } from '../../audit/infrastructure/audit-log.model.js'
import { SessionModel } from '../../auth/infrastructure/session.model.js'
import { ModerationHistoryModel } from '../../listings/infrastructure/moderation-history.model.js'
import { NotificationModel } from '../../notifications/infrastructure/notification.model.js'
import { ProductModel } from '../../products/infrastructure/product.models.js'
import type { SettingsService } from '../../settings/application/settings.service.js'
import type { ImageUploadService } from '../../uploads/application/image-upload.service.js'

export interface CleanupOptions {
  batchSize: number
  temporaryUploadRetentionHours: number
  readNotificationRetentionDays: number
  revokedSessionRetentionDays: number
  auditLogRetentionDays: number
}

export class CleanupService {
  constructor(
    private readonly uploads: ImageUploadService,
    private readonly settings: SettingsService,
    private readonly options: CleanupOptions,
  ) {}

  async run(): Promise<CleanupResult> {
    const started = Date.now()
    const now = new Date()
    const staleUploadBefore = new Date(
      now.getTime() - this.options.temporaryUploadRetentionHours * 60 * 60_000,
    )
    const readNotificationBefore = new Date(
      now.getTime() - this.options.readNotificationRetentionDays * 24 * 60 * 60_000,
    )
    const revokedSessionBefore = new Date(
      now.getTime() - this.options.revokedSessionRetentionDays * 24 * 60 * 60_000,
    )
    const auditBefore = new Date(
      now.getTime() - this.options.auditLogRetentionDays * 24 * 60 * 60_000,
    )

    const staleUploads = await this.uploads.cleanupStaleTemporary(
      staleUploadBefore,
      this.options.batchSize,
    )
    const [readNotifications, revokedSessions, auditLogs, expiredListings] = await Promise.all([
      this.deleteReadNotifications(readNotificationBefore),
      this.deleteOldSessions(now, revokedSessionBefore),
      this.deleteOldAuditLogs(auditBefore),
      this.expireOldListings(now),
    ])

    return {
      staleUploads,
      readNotifications,
      revokedSessions,
      auditLogs,
      expiredListings,
      durationMs: Date.now() - started,
      success: true,
      completedAt: new Date().toISOString(),
    }
  }

  private async deleteReadNotifications(before: Date): Promise<number> {
    const documents = await NotificationModel.find({ readAt: { $lt: before } })
      .select({ _id: 1 })
      .sort({ readAt: 1 })
      .limit(this.options.batchSize)
      .lean<Array<{ _id: unknown }>>()
    if (!documents.length) return 0
    const result = await NotificationModel.deleteMany({
      _id: { $in: documents.map((document) => document._id) },
    })
    return result.deletedCount
  }

  private async deleteOldSessions(now: Date, revokedBefore: Date): Promise<number> {
    const documents = await SessionModel.find({
      $or: [{ expiresAt: { $lt: now } }, { revokedAt: { $lt: revokedBefore } }],
    })
      .select({ _id: 1 })
      .sort({ expiresAt: 1 })
      .limit(this.options.batchSize)
      .lean<Array<{ _id: string }>>()
    if (!documents.length) return 0
    const result = await SessionModel.deleteMany({
      _id: { $in: documents.map((document) => document._id) },
    })
    return result.deletedCount
  }

  private async deleteOldAuditLogs(before: Date): Promise<number> {
    const documents = await AuditLogModel.find({ createdAt: { $lt: before } })
      .select({ _id: 1 })
      .sort({ createdAt: 1 })
      .limit(this.options.batchSize)
      .lean<Array<{ _id: unknown }>>()
    if (!documents.length) return 0
    const result = await AuditLogModel.deleteMany({
      _id: { $in: documents.map((document) => document._id) },
    })
    return result.deletedCount
  }

  private async expireOldListings(now: Date): Promise<number> {
    const settings = await this.settings.getAdmin()
    const cutoff = new Date(now.getTime() - settings.listingExpirationDays * 24 * 60 * 60_000)
    const products = await ProductModel.find({
      sellerType: 'USER',
      status: 'APPROVED',
      published: true,
      deletedAt: null,
      approvedAt: { $lt: cutoff },
    })
      .select({ _id: 1, sellerId: 1, title: 1 })
      .sort({ updatedAt: 1 })
      .limit(this.options.batchSize)
      .lean<Array<Record<string, unknown>>>()

    if (!products.length) return 0

    let expired = 0
    for (const product of products) {
      const update = await ProductModel.updateOne(
        { _id: product._id, status: 'APPROVED', published: true },
        {
          $set: {
            status: 'HIDDEN',
            published: false,
            moderationMessage:
              'This listing expired automatically. Edit and resubmit it to publish again.',
          },
        },
      )
      if (!update.modifiedCount) continue
      expired += 1
      await Promise.all([
        ModerationHistoryModel.create({
          productId: product._id,
          action: 'HIDDEN',
          fromStatus: 'APPROVED',
          toStatus: 'HIDDEN',
          reason: 'Listing expired automatically under the configured retention policy.',
          actorId: null,
        }),
        NotificationModel.create({
          userId: product.sellerId,
          type: 'PRODUCT',
          title: 'Listing expired',
          message: `${String(product.title)} was hidden after the listing-expiration period. Edit and resubmit it to publish again.`,
          referenceType: 'PRODUCT',
          referenceId: String(product._id),
        }),
      ])
    }

    return expired
  }
}

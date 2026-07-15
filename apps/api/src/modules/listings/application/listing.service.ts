import type {
  AdminModerationQuery,
  CreateSecondHandListingInput,
  ModerateProductInput,
  ModerationAction,
  ProductStatus,
  UpdateSecondHandListingInput,
  UserListingQuery,
} from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import { slugify } from '../../../core/utils/slug.js'
import type { CategoryRepository } from '../../categories/domain/category.js'
import type { ImageUploadService } from '../../uploads/application/image-upload.service.js'
import type { UserRepository } from '../../users/domain/user.js'
import type { ListingRepository } from '../domain/listing.js'
import type { NotificationRepository } from '../../notifications/domain/notification.js'

const editableStatuses = new Set<ProductStatus>([
  'DRAFT',
  'PENDING_APPROVAL',
  'CHANGES_REQUESTED',
  'REJECTED',
  'APPROVED',
])

export class ListingService {
  constructor(
    private readonly listings: ListingRepository,
    private readonly categories: CategoryRepository,
    private readonly users: UserRepository,
    private readonly uploads: ImageUploadService,
    private readonly notifications: NotificationRepository | null = null,
  ) {}

  listMine(userId: string, query: UserListingQuery) {
    return this.listings.listOwned(userId, query)
  }

  async getMine(userId: string, productId: string) {
    const listing = await this.listings.findOwnedById(productId, userId)
    if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found.')
    return listing
  }

  async create(userId: string, input: CreateSecondHandListingInput) {
    await this.assertSellerEligible(userId)
    await this.assertCategory(input.categoryId)
    const uploadRecords = await this.uploads.assertOwnedTemporary(userId, input.imageUploadIds)
    const slug = await this.uniqueSlug(input.title)
    const created = await this.listings.create(userId, input, slug)
    try {
      await this.listings.attachImages(created.id, uploadRecords, input.title)
      await this.uploads.attachToProduct(userId, input.imageUploadIds, created.id)
      await this.listings.addHistory({
        productId: created.id,
        action: 'SUBMITTED',
        fromStatus: null,
        toStatus: 'PENDING_APPROVAL',
        reason: null,
        actorId: userId,
      })
      await this.notifications?.sendToUser(userId, {
        type: 'PRODUCT',
        title: 'Listing submitted',
        message: `${input.title} was submitted for administrator review.`,
        referenceType: 'PRODUCT',
        referenceId: created.id,
      })
      return await this.getMine(userId, created.id)
    } catch (error) {
      await this.uploads.releaseFromProduct(userId, input.imageUploadIds, created.id)
      await this.listings.hardDeletePending(created.id, userId)
      throw error
    }
  }

  async update(userId: string, productId: string, input: UpdateSecondHandListingInput) {
    await this.assertSellerEligible(userId)
    const current = await this.getMine(userId, productId)
    if (!editableStatuses.has(current.status)) {
      throw new AppError(
        409,
        'LISTING_NOT_EDITABLE',
        'This listing cannot be edited in its current status.',
      )
    }
    if (input.categoryId) await this.assertCategory(input.categoryId)

    const effectivePrice = input.price ?? current.price
    const effectiveOriginalPrice =
      input.originalPrice === undefined ? current.originalPrice : input.originalPrice
    if (effectiveOriginalPrice !== null && effectiveOriginalPrice < effectivePrice) {
      throw new AppError(
        400,
        'INVALID_PRODUCT_PRICE',
        'Original price cannot be lower than the selling price.',
      )
    }

    const keepImageIds = input.keepImageIds ?? current.images.map((image) => image.id)
    const imageUploadIds = input.imageUploadIds ?? []
    const imageCount = keepImageIds.length + imageUploadIds.length
    if (imageCount < 1 || imageCount > 8) {
      throw new AppError(
        400,
        'INVALID_IMAGE_COUNT',
        'A listing must contain between 1 and 8 images.',
      )
    }
    await this.uploads.assertOwnedTemporary(userId, imageUploadIds)

    const nextStatus: ProductStatus = 'PENDING_APPROVAL'
    const slug = input.title ? await this.uniqueSlug(input.title, productId) : undefined
    const updated = await this.listings.updateOwned(productId, userId, {
      ...input,
      ...(slug ? { slug } : {}),
      status: nextStatus,
      published: false,
      moderationMessage: null,
      submittedAt: new Date(),
    })
    if (!updated) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found.')

    const attached = await this.uploads.attachToProduct(userId, imageUploadIds, productId)
    let removedStorageKeys: string[]
    try {
      removedStorageKeys = await this.listings.replaceImages(
        productId,
        userId,
        keepImageIds,
        attached,
        input.title ?? current.title,
      )
    } catch (error) {
      await this.uploads.releaseFromProduct(userId, imageUploadIds, productId)
      throw error
    }
    await this.uploads.deleteStoredImages(removedStorageKeys)
    await this.listings.addHistory({
      productId,
      action: 'RESUBMITTED',
      fromStatus: current.status,
      toStatus: nextStatus,
      reason: null,
      actorId: userId,
    })
    return this.getMine(userId, productId)
  }

  async remove(userId: string, productId: string) {
    const current = await this.getMine(userId, productId)
    if (current.status === 'SOLD' || current.status === 'DELETED') {
      throw new AppError(409, 'LISTING_NOT_DELETABLE', 'This listing cannot be deleted.')
    }
    const listing = await this.listings.softDelete(productId, userId)
    if (!listing)
      throw new AppError(409, 'LISTING_NOT_DELETABLE', 'This listing cannot be deleted.')
    await this.listings.addHistory({
      productId,
      action: 'DELETED',
      fromStatus: current.status,
      toStatus: 'DELETED',
      reason: null,
      actorId: userId,
    })
    return listing
  }

  async markSold(userId: string, productId: string) {
    const current = await this.getMine(userId, productId)
    if (current.status !== 'APPROVED') {
      throw new AppError(
        409,
        'LISTING_NOT_SELLABLE',
        'Only an approved listing can be marked sold.',
      )
    }
    const listing = await this.listings.markSold(productId, userId)
    if (!listing) throw new AppError(409, 'LISTING_NOT_SELLABLE', 'Unable to mark listing sold.')
    await this.listings.addHistory({
      productId,
      action: 'MARKED_SOLD',
      fromStatus: current.status,
      toStatus: 'SOLD',
      reason: null,
      actorId: userId,
    })
    return listing
  }

  listModeration(query: AdminModerationQuery) {
    return this.listings.listForModeration(query)
  }

  async getModeration(productId: string) {
    const listing = await this.listings.findForModeration(productId)
    if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found.')
    return listing
  }

  async moderate(adminId: string, productId: string, input: ModerateProductInput) {
    const current = await this.getModeration(productId)
    const transition = this.moderationTransition(current.status, input)
    if (transition.toStatus === 'APPROVED') {
      const seller = await this.users.findById(current.sellerSnapshot.id)
      if (!seller || seller.user.status !== 'ACTIVE' || !seller.user.canSell) {
        throw new AppError(
          409,
          'SELLER_NOT_ELIGIBLE',
          'This seller is not currently eligible to publish listings.',
        )
      }
      await this.assertCategory(current.category.id)
      if (current.images.length === 0) {
        throw new AppError(
          409,
          'LISTING_IMAGE_REQUIRED',
          'A listing must contain at least one valid image before it can be approved.',
        )
      }
    }
    const listing = await this.listings.moderate(productId, {
      ...input,
      status: transition.toStatus,
      published: transition.toStatus === 'APPROVED',
      moderationMessage: transition.message,
      approvedBy: transition.toStatus === 'APPROVED' ? adminId : null,
      approvedAt: transition.toStatus === 'APPROVED' ? new Date() : null,
    })
    if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found.')
    await this.listings.addHistory({
      productId,
      action: transition.action,
      fromStatus: current.status,
      toStatus: transition.toStatus,
      reason: input.reason ?? null,
      actorId: adminId,
    })
    await this.notifications?.sendToUser(current.sellerSnapshot.id, {
      type: 'PRODUCT',
      title: `Listing ${transition.toStatus.toLowerCase().replaceAll('_', ' ')}`,
      message:
        transition.message ??
        `${current.title} is now ${transition.toStatus.toLowerCase().replaceAll('_', ' ')}.`,
      referenceType: 'PRODUCT',
      referenceId: productId,
    })
    return this.getModeration(productId)
  }

  private moderationTransition(
    status: ProductStatus,
    input: ModerateProductInput,
  ): {
    toStatus: ProductStatus
    action: ModerationAction
    message: string | null
  } {
    if (input.decision === 'APPROVE') {
      if (!['PENDING_APPROVAL', 'CHANGES_REQUESTED', 'REJECTED'].includes(status)) {
        throw new AppError(409, 'INVALID_MODERATION_TRANSITION', 'This listing cannot be approved.')
      }
      return { toStatus: 'APPROVED', action: 'APPROVED', message: null }
    }
    if (input.decision === 'REJECT') {
      if (!['PENDING_APPROVAL', 'CHANGES_REQUESTED'].includes(status)) {
        throw new AppError(409, 'INVALID_MODERATION_TRANSITION', 'This listing cannot be rejected.')
      }
      return { toStatus: 'REJECTED', action: 'REJECTED', message: input.reason ?? null }
    }
    if (input.decision === 'REQUEST_CHANGES') {
      if (status !== 'PENDING_APPROVAL') {
        throw new AppError(
          409,
          'INVALID_MODERATION_TRANSITION',
          'Changes can only be requested for a pending listing.',
        )
      }
      return {
        toStatus: 'CHANGES_REQUESTED',
        action: 'CHANGES_REQUESTED',
        message: input.reason ?? null,
      }
    }
    if (input.decision === 'HIDE') {
      if (status !== 'APPROVED') {
        throw new AppError(
          409,
          'INVALID_MODERATION_TRANSITION',
          'Only approved listings can be hidden.',
        )
      }
      return { toStatus: 'HIDDEN', action: 'HIDDEN', message: input.reason ?? null }
    }
    if (status !== 'HIDDEN') {
      throw new AppError(
        409,
        'INVALID_MODERATION_TRANSITION',
        'Only hidden listings can be restored.',
      )
    }
    return { toStatus: 'APPROVED', action: 'RESTORED', message: null }
  }

  private async assertSellerEligible(userId: string) {
    const user = await this.users.findById(userId)
    if (!user || user.user.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'Your account is not active.')
    }
    if (!user.user.canSell) {
      throw new AppError(
        403,
        'SELLING_SUSPENDED',
        'Your selling permission is currently suspended.',
      )
    }
    if (!user.user.profileCompleted) {
      throw new AppError(
        409,
        'PROFILE_COMPLETION_REQUIRED',
        'Complete your profile before submitting a product.',
      )
    }
  }

  private async assertCategory(categoryId: string) {
    const category = await this.categories.findById(categoryId)
    if (!category || !category.isActive) {
      throw new AppError(400, 'CATEGORY_NOT_AVAILABLE', 'Choose an active category.')
    }
  }

  private async uniqueSlug(title: string, excludeId?: string) {
    const base = slugify(title) || 'listing'
    let slug = base
    let suffix = 2
    while (await this.listings.slugExists(slug, excludeId)) slug = `${base}-${suffix++}`
    return slug
  }
}

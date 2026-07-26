import type {
  AdminModerationProduct,
  AdminModerationQuery,
  Category,
  CreateSecondHandListingInput,
  ModerateProductInput,
  ModerationHistoryEntry,
  PaginatedResult,
  ProductDetail,
  ProductImage,
  ProductStatus,
  ProductSummary,
  UpdateSecondHandListingInput,
  UserListing,
  UserListingQuery,
} from '@campusbaza/contracts'
import { Types } from 'mongoose'
import { CategoryModel } from '../../categories/infrastructure/category.model.js'
import { ProductImageModel, ProductModel } from '../../products/infrastructure/product.models.js'
import type { UploadAssetRecord } from '../../uploads/domain/image-storage.js'
import { UserModel, UserProfileModel } from '../../users/infrastructure/user.models.js'
import type { ListingRepository } from '../domain/listing.js'
import { ModerationHistoryModel } from './moderation-history.model.js'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mapCategory(document: Record<string, unknown>): Category {
  return {
    id: String(document._id),
    name: String(document.name),
    slug: String(document.slug),
    description: (document.description as string | null) ?? null,
    imageUrl: (document.imageUrl as string | null) ?? null,
    isActive: Boolean(document.isActive),
    displayOrder: Number(document.displayOrder),
    createdAt: (document.createdAt as Date).toISOString(),
    updatedAt: (document.updatedAt as Date).toISOString(),
  }
}

function mapImage(document: Record<string, unknown>): ProductImage {
  return {
    id: String(document._id),
    url: String(document.url),
    altText: typeof document.altText === 'string' ? document.altText : '',
    displayOrder: Number(document.displayOrder),
    isPrimary: Boolean(document.isPrimary),
  }
}

function objectIdToString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value instanceof Types.ObjectId) return value.toHexString()
  return null
}

function displayName(profile: Record<string, unknown> | undefined, fallback = 'Campus member') {
  if (typeof profile?.displayName === 'string' && profile.displayName) return profile.displayName
  if (typeof profile?.fullName === 'string' && profile.fullName) return profile.fullName
  return fallback
}

export class MongooseListingRepository implements ListingRepository {
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return Boolean(
      await ProductModel.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }),
    )
  }

  async create(
    sellerId: string,
    input: CreateSecondHandListingInput,
    slug: string,
  ): Promise<{ id: string }> {
    const document = await ProductModel.create({
      title: input.title,
      slug,
      description: input.description,
      categoryId: input.categoryId,
      price: input.price,
      originalPrice: input.originalPrice ?? null,
      stock: input.stock,
      condition: input.condition,
      productType: 'SECOND_HAND',
      sellerType: 'USER',
      sellerId,
      status: 'PENDING_APPROVAL',
      published: false,
      pickupLocation: input.pickupLocation,
      tags: [...new Set(input.tags.map((tag) => tag.toLowerCase()))],
      productAge: input.productAge ?? null,
      reasonForSelling: input.reasonForSelling ?? null,
      additionalDetails: input.additionalDetails ?? null,
      moderationMessage: null,
      submittedAt: new Date(),
      isFeatured: false,
    })
    return { id: String(document._id) }
  }

  async attachImages(
    productId: string,
    uploads: UploadAssetRecord[],
    title: string,
  ): Promise<void> {
    if (!uploads.length) return
    await ProductImageModel.insertMany(
      uploads.map((upload, index) => ({
        productId,
        url: upload.url,
        altText: title,
        displayOrder: index,
        isPrimary: index === 0,
        storageKey: upload.publicId,
        mimeType: upload.mimeType,
        bytes: upload.bytes,
        width: upload.width,
        height: upload.height,
      })),
    )
  }

  async replaceImages(
    productId: string,
    sellerId: string,
    keepImageIds: string[],
    uploads: UploadAssetRecord[],
    title: string,
  ): Promise<string[]> {
    const product = await ProductModel.findOne({
      _id: productId,
      sellerId,
      sellerType: 'USER',
      deletedAt: null,
    }).select('_id')
    if (!product) return []

    const existing = await ProductImageModel.find({ productId })
      .sort({ displayOrder: 1 })
      .lean<Record<string, unknown>[]>()
    const existingById = new Map(existing.map((image) => [String(image._id), image]))
    if (keepImageIds.some((id) => !existingById.has(id))) {
      throw new Error('One or more retained images do not belong to this listing')
    }

    const keepSet = new Set(keepImageIds)
    const removed = existing.filter((image) => !keepSet.has(String(image._id)))
    if (removed.length) {
      await ProductImageModel.deleteMany({ _id: { $in: removed.map((image) => image._id) } })
    }

    const inserted = uploads.length
      ? await ProductImageModel.insertMany(
          uploads.map((upload) => ({
            productId,
            url: upload.url,
            altText: title,
            displayOrder: 0,
            isPrimary: false,
            storageKey: upload.publicId,
            mimeType: upload.mimeType,
            bytes: upload.bytes,
            width: upload.width,
            height: upload.height,
          })),
        )
      : []

    const orderedIds = [...keepImageIds, ...inserted.map((image) => String(image._id))]
    await Promise.all(
      orderedIds.map((id, index) =>
        ProductImageModel.updateOne(
          { _id: id, productId },
          { $set: { displayOrder: index, isPrimary: index === 0, altText: title } },
        ),
      ),
    )

    return removed.flatMap((image) =>
      typeof image.storageKey === 'string' && image.storageKey ? [image.storageKey] : [],
    )
  }

  async hardDeletePending(productId: string, sellerId: string): Promise<void> {
    await Promise.all([
      ProductImageModel.deleteMany({ productId }),
      ProductModel.deleteOne({ _id: productId, sellerId, status: 'PENDING_APPROVAL' }),
      ModerationHistoryModel.deleteMany({ productId }),
    ])
  }

  async findOwnedById(productId: string, sellerId: string): Promise<UserListing | null> {
    const document = await ProductModel.findOne({
      _id: productId,
      sellerId,
      sellerType: 'USER',
    }).lean<Record<string, unknown>>()
    return document ? this.hydrateUserListing(document) : null
  }

  async listOwned(
    sellerId: string,
    query: UserListingQuery,
  ): Promise<PaginatedResult<ProductSummary>> {
    const filter: Record<string, unknown> = { sellerId, sellerType: 'USER' }
    if (query.status) filter.status = query.status
    else filter.status = { $ne: 'DELETED' }
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i')
      filter.$or = [{ title: regex }, { description: regex }, { tags: regex }]
    }
    const skip = (query.page - 1) * query.limit
    const [documents, total] = await Promise.all([
      ProductModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean<Record<string, unknown>[]>(),
      ProductModel.countDocuments(filter),
    ])
    return {
      items: await this.hydrateSummaries(documents),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }

  async updateOwned(
    productId: string,
    sellerId: string,
    input: UpdateSecondHandListingInput & {
      slug?: string
      status: ProductStatus
      published: boolean
      moderationMessage: string | null
      submittedAt: Date
    },
  ): Promise<UserListing | null> {
    const update: Record<string, unknown> = { ...input }
    delete update.imageUploadIds
    delete update.keepImageIds
    if (input.tags) update.tags = [...new Set(input.tags.map((tag) => tag.toLowerCase()))]
    if (input.status === 'PENDING_APPROVAL') {
      update.approvedAt = null
      update.approvedBy = null
    }
    const document = await ProductModel.findOneAndUpdate(
      { _id: productId, sellerId, sellerType: 'USER', deletedAt: null },
      { $set: update },
      { new: true, runValidators: true },
    ).lean<Record<string, unknown>>()
    return document ? this.hydrateUserListing(document) : null
  }

  async softDelete(productId: string, sellerId: string): Promise<UserListing | null> {
    const document = await ProductModel.findOneAndUpdate(
      {
        _id: productId,
        sellerId,
        sellerType: 'USER',
        deletedAt: null,
        status: { $nin: ['SOLD', 'DELETED'] },
      },
      { $set: { status: 'DELETED', published: false, deletedAt: new Date() } },
      { new: true },
    ).lean<Record<string, unknown>>()
    return document ? this.hydrateUserListing(document) : null
  }

  async markSold(productId: string, sellerId: string): Promise<UserListing | null> {
    const document = await ProductModel.findOneAndUpdate(
      {
        _id: productId,
        sellerId,
        sellerType: 'USER',
        deletedAt: null,
        status: 'APPROVED',
      },
      { $set: { status: 'SOLD', published: false, stock: 0 } },
      { new: true },
    ).lean<Record<string, unknown>>()
    return document ? this.hydrateUserListing(document) : null
  }

  async addHistory(input: {
    productId: string
    action: Parameters<ListingRepository['addHistory']>[0]['action']
    fromStatus: ProductStatus | null
    toStatus: ProductStatus
    reason: string | null
    actorId: string | null
  }): Promise<void> {
    await ModerationHistoryModel.create(input)
  }

  async listForModeration(query: AdminModerationQuery): Promise<PaginatedResult<ProductSummary>> {
    const filter: Record<string, unknown> = {
      sellerType: 'USER',
      status: query.status,
      ...(query.status === 'DELETED' ? {} : { deletedAt: null }),
    }
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i')
      const matchingUsers = await UserModel.find({ email: regex }).distinct('_id')
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: regex },
        { sellerId: { $in: matchingUsers } },
      ]
    }
    const skip = (query.page - 1) * query.limit
    const [documents, total] = await Promise.all([
      ProductModel.find(filter)
        .sort({ submittedAt: 1, createdAt: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean<Record<string, unknown>[]>(),
      ProductModel.countDocuments(filter),
    ])
    return {
      items: await this.hydrateSummaries(documents),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }

  async findForModeration(productId: string): Promise<AdminModerationProduct | null> {
    const document = await ProductModel.findOne({ _id: productId, sellerType: 'USER' }).lean<
      Record<string, unknown>
    >()
    if (!document) return null
    const listing = await this.hydrateUserListing(document)
    if (!listing) return null
    const [user, profile] = await Promise.all([
      UserModel.findById(document.sellerId).lean<Record<string, unknown>>(),
      UserProfileModel.findOne({ userId: document.sellerId }).lean<Record<string, unknown>>(),
    ])
    if (!user) return null
    return {
      ...listing,
      sellerSnapshot: {
        id: String(user._id),
        email: String(user.email),
        displayName: displayName(profile ?? undefined, String(user.email).split('@')[0]),
        profileCompleted: Boolean(user.profileCompleted),
        canSell: Boolean(user.canSell),
        status: user.status as AdminModerationProduct['sellerSnapshot']['status'],
      },
    }
  }

  async moderate(
    productId: string,
    input: ModerateProductInput & {
      status: ProductStatus
      published: boolean
      moderationMessage: string | null
      approvedBy?: string | null
      approvedAt?: Date | null
    },
  ): Promise<AdminModerationProduct | null> {
    const update: Record<string, unknown> = {
      status: input.status,
      published: input.published,
      moderationMessage: input.moderationMessage,
    }
    if (input.approvedBy !== undefined) update.approvedBy = input.approvedBy
    if (input.approvedAt !== undefined) update.approvedAt = input.approvedAt
    const document = await ProductModel.findOneAndUpdate(
      { _id: productId, sellerType: 'USER' },
      { $set: update },
      { new: true, runValidators: true },
    ).lean<Record<string, unknown>>()
    return document ? this.findForModeration(productId) : null
  }

  private async hydrateSummaries(documents: Record<string, unknown>[]): Promise<ProductSummary[]> {
    if (!documents.length) return []
    const productIds = documents.map((document) => document._id)
    const categoryIds = [...new Set(documents.map((document) => String(document.categoryId)))]
    const [categoryDocuments, imageDocuments] = await Promise.all([
      CategoryModel.find({ _id: { $in: categoryIds } }).lean<Record<string, unknown>[]>(),
      ProductImageModel.find({ productId: { $in: productIds } })
        .sort({ displayOrder: 1 })
        .lean<Record<string, unknown>[]>(),
    ])
    const categories = new Map(
      categoryDocuments.map((category) => [String(category._id), mapCategory(category)]),
    )
    const images = new Map<string, ProductImage[]>()
    for (const image of imageDocuments) {
      const productId = String(image.productId)
      images.set(productId, [...(images.get(productId) ?? []), mapImage(image)])
    }
    return documents.flatMap((document) => {
      const category = categories.get(String(document.categoryId))
      if (!category) return []
      const productImages = images.get(String(document._id)) ?? []
      return [this.mapSummary(document, category, productImages)]
    })
  }

  private mapSummary(
    document: Record<string, unknown>,
    category: Category,
    images: ProductImage[],
  ): ProductSummary {
    return {
      id: String(document._id),
      slug: String(document.slug),
      title: String(document.title),
      category: { id: category.id, name: category.name, slug: category.slug },
      price: Number(document.price),
      originalPrice: (document.originalPrice as number | null) ?? null,
      stock: Number(document.stock),
      condition: document.condition as ProductSummary['condition'],
      productType: document.productType as ProductSummary['productType'],
      sellerType: document.sellerType as ProductSummary['sellerType'],
      status: document.status as ProductSummary['status'],
      published: Boolean(document.published),
      isFeatured: Boolean(document.isFeatured),
      pickupLocation: (document.pickupLocation as string | null) ?? null,
      primaryImage: images.find((image) => image.isPrimary) ?? images[0] ?? null,
      viewCount: Number(document.viewCount),
      completedOrderCount: Number(document.completedOrderCount),
      createdAt: (document.createdAt as Date).toISOString(),
    }
  }

  private async hydrateUserListing(document: Record<string, unknown>): Promise<UserListing | null> {
    const [categoryDocument, imageDocuments, historyDocuments, sellerProfile] = await Promise.all([
      CategoryModel.findById(document.categoryId).lean<Record<string, unknown>>(),
      ProductImageModel.find({ productId: document._id })
        .sort({ displayOrder: 1 })
        .lean<Record<string, unknown>[]>(),
      ModerationHistoryModel.find({ productId: document._id })
        .sort({ createdAt: -1 })
        .lean<Record<string, unknown>[]>(),
      UserProfileModel.findOne({ userId: document.sellerId }).lean<Record<string, unknown>>(),
    ])
    if (!categoryDocument) return null
    const category = mapCategory(categoryDocument)
    const images = imageDocuments.map(mapImage)
    const summary = this.mapSummary(document, category, images)
    const history = await this.hydrateHistory(historyDocuments)
    const detail: ProductDetail = {
      ...summary,
      description: String(document.description),
      tags: (document.tags as string[]) ?? [],
      images,
      seller: {
        id: String(document.sellerId),
        displayName: displayName(sellerProfile ?? undefined, 'Campus seller'),
        verified: true,
      },
      updatedAt: (document.updatedAt as Date).toISOString(),
    }
    return {
      ...detail,
      productAge: (document.productAge as string | null) ?? null,
      reasonForSelling: (document.reasonForSelling as string | null) ?? null,
      additionalDetails: (document.additionalDetails as string | null) ?? null,
      moderationMessage: (document.moderationMessage as string | null) ?? null,
      submittedAt: document.submittedAt ? (document.submittedAt as Date).toISOString() : null,
      moderationHistory: history,
    }
  }

  private async hydrateHistory(
    documents: Record<string, unknown>[],
  ): Promise<ModerationHistoryEntry[]> {
    const actorIds = [
      ...new Set(
        documents.flatMap((document) => {
          const actorId = objectIdToString(document.actorId)
          return actorId ? [actorId] : []
        }),
      ),
    ]
    const profiles = actorIds.length
      ? await UserProfileModel.find({ userId: { $in: actorIds } }).lean<Record<string, unknown>[]>()
      : []
    const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]))
    return documents.map((document) => {
      const actorId = objectIdToString(document.actorId)
      return {
        id: String(document._id),
        action: document.action as ModerationHistoryEntry['action'],
        fromStatus: (document.fromStatus as ProductStatus | null) ?? null,
        toStatus: document.toStatus as ProductStatus,
        reason: (document.reason as string | null) ?? null,
        actor: actorId
          ? {
              id: actorId,
              displayName: displayName(profileByUserId.get(actorId), 'Campus Angadi admin'),
            }
          : null,
        createdAt: (document.createdAt as Date).toISOString(),
      }
    })
  }
}

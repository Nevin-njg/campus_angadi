import type {
  AdminModerationProduct,
  AdminModerationQuery,
  CreateSecondHandListingInput,
  ModerateProductInput,
  ModerationAction,
  PaginatedResult,
  ProductStatus,
  ProductSummary,
  UpdateSecondHandListingInput,
  UserListing,
  UserListingQuery,
} from '@campusbaza/contracts'
import type { UploadAssetRecord } from '../../uploads/domain/image-storage.js'

export interface ListingUpdateResult {
  listing: UserListing
  removedStorageKeys: string[]
}

export interface ListingRepository {
  slugExists(slug: string, excludeId?: string): Promise<boolean>
  create(
    sellerId: string,
    input: CreateSecondHandListingInput,
    slug: string,
  ): Promise<{ id: string }>
  attachImages(productId: string, uploads: UploadAssetRecord[], title: string): Promise<void>
  replaceImages(
    productId: string,
    sellerId: string,
    keepImageIds: string[],
    uploads: UploadAssetRecord[],
    title: string,
  ): Promise<string[]>
  hardDeletePending(productId: string, sellerId: string): Promise<void>
  findOwnedById(productId: string, sellerId: string): Promise<UserListing | null>
  listOwned(sellerId: string, query: UserListingQuery): Promise<PaginatedResult<ProductSummary>>
  updateOwned(
    productId: string,
    sellerId: string,
    input: UpdateSecondHandListingInput & {
      slug?: string
      status: ProductStatus
      published: boolean
      moderationMessage: string | null
      submittedAt: Date
    },
  ): Promise<UserListing | null>
  softDelete(productId: string, sellerId: string): Promise<UserListing | null>
  markSold(productId: string, sellerId: string): Promise<UserListing | null>
  addHistory(input: {
    productId: string
    action: ModerationAction
    fromStatus: ProductStatus | null
    toStatus: ProductStatus
    reason: string | null
    actorId: string | null
  }): Promise<void>
  listForModeration(query: AdminModerationQuery): Promise<PaginatedResult<ProductSummary>>
  findForModeration(productId: string): Promise<AdminModerationProduct | null>
  moderate(
    productId: string,
    input: ModerateProductInput & {
      status: ProductStatus
      published: boolean
      moderationMessage: string | null
      approvedBy?: string | null
      approvedAt?: Date | null
    },
  ): Promise<AdminModerationProduct | null>
}

import type {
  AdminModerationProduct,
  AdminModerationQuery,
  Category,
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
import { describe, expect, it } from 'vitest'
import type { CategoryRepository } from '../../categories/domain/category.js'
import type { ImageUploadService } from '../../uploads/application/image-upload.service.js'
import type { UploadAssetRecord } from '../../uploads/domain/image-storage.js'
import { InMemoryUserRepository } from '../../../test/fakes.js'
import type { ListingRepository } from '../domain/listing.js'
import { ListingService } from './listing.service.js'

const category: Category = {
  id: 'category-1',
  name: 'Electronics',
  slug: 'electronics',
  description: null,
  imageUrl: null,
  isActive: true,
  displayOrder: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
}

function makeListing(overrides: Partial<UserListing> = {}): UserListing {
  return {
    id: 'listing-1',
    slug: 'mechanical-keyboard',
    title: 'Mechanical Keyboard',
    category: { id: category.id, name: category.name, slug: category.slug },
    price: 1200,
    originalPrice: 2000,
    stock: 1,
    condition: 'GOOD',
    productType: 'SECOND_HAND',
    sellerType: 'USER',
    status: 'PENDING_APPROVAL',
    published: false,
    isFeatured: false,
    pickupLocation: 'Main Block',
    primaryImage: {
      id: 'image-1',
      url: 'https://res.cloudinary.com/test/image/upload/image-1.jpg',
      altText: 'Mechanical Keyboard',
      displayOrder: 0,
      isPrimary: true,
    },
    viewCount: 0,
    completedOrderCount: 0,
    createdAt: new Date(0).toISOString(),
    description: 'A clean keyboard in good working condition.',
    tags: ['keyboard'],
    images: [
      {
        id: 'image-1',
        url: 'https://res.cloudinary.com/test/image/upload/image-1.jpg',
        altText: 'Mechanical Keyboard',
        displayOrder: 0,
        isPrimary: true,
      },
    ],
    seller: { id: 'seller-1', displayName: 'Student Seller', verified: true },
    updatedAt: new Date(0).toISOString(),
    productAge: '8 months',
    reasonForSelling: null,
    additionalDetails: null,
    moderationMessage: null,
    submittedAt: new Date(0).toISOString(),
    moderationHistory: [],
    ...overrides,
  }
}

class FakeCategoryRepository implements CategoryRepository {
  async listPublic() {
    return [category]
  }
  async listAdmin() {
    return [category]
  }
  async findById(id: string) {
    return id === category.id ? category : null
  }
  async findBySlug() {
    return category
  }
  async create() {
    return category
  }
  async update() {
    return category
  }
  async softDelete() {
    return true
  }
  async slugExists() {
    return false
  }
}

class FakeListingRepository implements ListingRepository {
  current: UserListing | null = null
  histories: Array<{
    action: ModerationAction
    fromStatus: ProductStatus | null
    toStatus: ProductStatus
    reason: string | null
  }> = []
  lastCreate: { sellerId: string; input: CreateSecondHandListingInput; slug: string } | null = null

  async slugExists() {
    return false
  }
  async create(sellerId: string, input: CreateSecondHandListingInput, slug: string) {
    this.lastCreate = { sellerId, input, slug }
    this.current = makeListing({
      id: 'listing-1',
      slug,
      title: input.title,
      description: input.description,
      price: input.price,
      originalPrice: input.originalPrice ?? null,
      stock: input.stock,
      condition: input.condition,
      pickupLocation: input.pickupLocation,
      productAge: input.productAge ?? null,
      reasonForSelling: input.reasonForSelling ?? null,
      additionalDetails: input.additionalDetails ?? null,
      images: [],
      primaryImage: null,
      seller: { id: sellerId, displayName: 'Student Seller', verified: true },
    })
    return { id: this.current.id }
  }
  async attachImages(_productId: string, uploads: UploadAssetRecord[], title: string) {
    if (!this.current) return
    this.current.images = uploads.map((upload, index) => ({
      id: `image-${index + 1}`,
      url: upload.url,
      altText: title,
      displayOrder: index,
      isPrimary: index === 0,
    }))
    this.current.primaryImage = this.current.images[0] ?? null
  }
  async replaceImages(
    _productId: string,
    _sellerId: string,
    keepImageIds: string[],
    uploads: UploadAssetRecord[],
    title: string,
  ) {
    if (!this.current) return []
    const kept = this.current.images.filter((image) => keepImageIds.includes(image.id))
    const next = uploads.map((upload, index) => ({
      id: `new-image-${index + 1}`,
      url: upload.url,
      altText: title,
      displayOrder: kept.length + index,
      isPrimary: false,
    }))
    const removed = this.current.images
      .filter((image) => !keepImageIds.includes(image.id))
      .map((image) => `public-${image.id}`)
    this.current.images = [...kept, ...next].map((image, index) => ({
      ...image,
      displayOrder: index,
      isPrimary: index === 0,
    }))
    this.current.primaryImage = this.current.images[0] ?? null
    return removed
  }
  async hardDeletePending() {
    this.current = null
  }
  async findOwnedById(productId: string) {
    return this.current?.id === productId ? structuredClone(this.current) : null
  }
  async listOwned(
    _sellerId: string,
    query: UserListingQuery,
  ): Promise<PaginatedResult<ProductSummary>> {
    const values =
      this.current && (!query.status || this.current.status === query.status) ? [this.current] : []
    return {
      items: values,
      meta: {
        page: query.page,
        limit: query.limit,
        total: values.length,
        totalPages: values.length ? 1 : 0,
      },
    }
  }
  async updateOwned(
    productId: string,
    _sellerId: string,
    input: UpdateSecondHandListingInput & {
      slug?: string
      status: ProductStatus
      published: boolean
      moderationMessage: string | null
      submittedAt: Date
    },
  ) {
    if (!this.current || this.current.id !== productId) return null
    const current = this.current
    this.current = {
      ...current,
      slug: input.slug ?? current.slug,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      price: input.price ?? current.price,
      originalPrice:
        input.originalPrice === undefined ? current.originalPrice : input.originalPrice,
      stock: input.stock ?? current.stock,
      condition: input.condition ?? current.condition,
      pickupLocation:
        input.pickupLocation === undefined ? current.pickupLocation : input.pickupLocation,
      tags: input.tags ?? current.tags,
      productAge: input.productAge === undefined ? current.productAge : (input.productAge ?? null),
      reasonForSelling:
        input.reasonForSelling === undefined
          ? current.reasonForSelling
          : (input.reasonForSelling ?? null),
      additionalDetails:
        input.additionalDetails === undefined
          ? current.additionalDetails
          : (input.additionalDetails ?? null),
      status: input.status,
      published: input.published,
      moderationMessage: input.moderationMessage,
      submittedAt: input.submittedAt.toISOString(),
      updatedAt: input.submittedAt.toISOString(),
    }
    return structuredClone(this.current)
  }
  async softDelete() {
    if (!this.current) return null
    this.current = { ...this.current, status: 'DELETED', published: false }
    return structuredClone(this.current)
  }
  async markSold() {
    if (!this.current) return null
    this.current = { ...this.current, status: 'SOLD', published: false, stock: 0 }
    return structuredClone(this.current)
  }
  async addHistory(input: {
    productId: string
    action: ModerationAction
    fromStatus: ProductStatus | null
    toStatus: ProductStatus
    reason: string | null
    actorId: string | null
  }) {
    this.histories.push({
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
    })
  }
  async listForModeration(query: AdminModerationQuery): Promise<PaginatedResult<ProductSummary>> {
    const values = this.current?.status === query.status ? [this.current] : []
    return {
      items: values,
      meta: {
        page: query.page,
        limit: query.limit,
        total: values.length,
        totalPages: values.length ? 1 : 0,
      },
    }
  }
  async findForModeration(productId: string): Promise<AdminModerationProduct | null> {
    if (!this.current || this.current.id !== productId) return null
    return {
      ...structuredClone(this.current),
      sellerSnapshot: {
        id: this.current.seller?.id ?? 'seller-1',
        email: 'student@campusbaza.example.edu',
        displayName: 'Student Seller',
        profileCompleted: true,
        canSell: true,
        status: 'ACTIVE',
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
  ) {
    if (!this.current || this.current.id !== productId) return null
    this.current = {
      ...this.current,
      status: input.status,
      published: input.published,
      moderationMessage: input.moderationMessage,
    }
    return this.findForModeration(productId)
  }
}

class FakeUploads {
  record: UploadAssetRecord = {
    id: 'upload-1',
    ownerId: 'seller-1',
    publicId: 'campusbaza/products/upload-1',
    url: 'https://res.cloudinary.com/test/image/upload/upload-1.jpg',
    mimeType: 'image/jpeg',
    bytes: 100,
    width: 800,
    height: 600,
    status: 'TEMPORARY',
    productId: null,
    createdAt: new Date(0),
  }
  async assertOwnedTemporary(_ownerId: string, ids: string[]) {
    return ids.map((id) => ({ ...this.record, id }))
  }
  async attachToProduct(_ownerId: string, ids: string[], productId: string) {
    return ids.map((id) => ({ ...this.record, id, status: 'ATTACHED' as const, productId }))
  }
  async releaseFromProduct() {}
  async deleteStoredImages() {}
}

async function setup(profileCompleted: boolean) {
  const users = new InMemoryUserRepository()
  const user = await users.findOrCreateByEmail('student@campusbaza.example.edu', 'USER')
  if (profileCompleted) {
    await users.updateProfile(user.user.id, {
      fullName: 'Student Seller',
      displayName: 'Student',
      department: 'Computer Science',
    })
  }
  const repository = new FakeListingRepository()
  const service = new ListingService(
    repository,
    new FakeCategoryRepository(),
    users,
    new FakeUploads() as unknown as ImageUploadService,
  )
  return { service, repository, userId: user.user.id }
}

const createInput: CreateSecondHandListingInput = {
  title: 'Mechanical Keyboard',
  description: 'A clean keyboard in good working condition.',
  categoryId: category.id,
  price: 1200,
  originalPrice: 2000,
  condition: 'GOOD',
  productAge: '8 months',
  stock: 1,
  pickupLocation: 'Main Block',
  reasonForSelling: null,
  additionalDetails: null,
  tags: ['keyboard'],
  imageUploadIds: ['upload-1'],
  keepImageIds: [],
}

describe('ListingService', () => {
  it('requires profile completion before a user can submit a listing', async () => {
    const { service, userId } = await setup(false)

    await expect(service.create(userId, createInput)).rejects.toMatchObject({
      code: 'PROFILE_COMPLETION_REQUIRED',
    })
  })

  it('creates a second-hand listing in pending approval state', async () => {
    const { service, repository, userId } = await setup(true)

    const result = await service.create(userId, createInput)

    expect(result.status).toBe('PENDING_APPROVAL')
    expect(result.published).toBe(false)
    expect(result.productType).toBe('SECOND_HAND')
    expect(repository.lastCreate?.sellerId).toBe(userId)
    expect(repository.histories.at(-1)).toMatchObject({
      action: 'SUBMITTED',
      toStatus: 'PENDING_APPROVAL',
    })
  })

  it('returns an approved listing to moderation after an edit', async () => {
    const { service, repository, userId } = await setup(true)
    repository.current = makeListing({
      id: 'listing-1',
      seller: { id: userId, displayName: 'Student Seller', verified: true },
      status: 'APPROVED',
      published: true,
    })

    const result = await service.update(userId, 'listing-1', {
      title: 'Mechanical Keyboard Updated',
      keepImageIds: ['image-1'],
      imageUploadIds: [],
    })

    expect(result.status).toBe('PENDING_APPROVAL')
    expect(result.published).toBe(false)
    expect(repository.histories.at(-1)).toMatchObject({
      action: 'RESUBMITTED',
      fromStatus: 'APPROVED',
      toStatus: 'PENDING_APPROVAL',
    })
  })

  it('approves a pending listing and records the moderation action', async () => {
    const { service, repository, userId } = await setup(true)
    repository.current = makeListing({
      id: 'listing-1',
      seller: { id: userId, displayName: 'Student Seller', verified: true },
      status: 'PENDING_APPROVAL',
      published: false,
    })

    const result = await service.moderate('admin-1', 'listing-1', {
      decision: 'APPROVE',
      reason: null,
    })

    expect(result.status).toBe('APPROVED')
    expect(result.published).toBe(true)
    expect(repository.histories.at(-1)).toMatchObject({
      action: 'APPROVED',
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'APPROVED',
    })
  })

  it('rejects invalid moderation transitions', async () => {
    const { service, repository, userId } = await setup(true)
    repository.current = makeListing({
      id: 'listing-1',
      seller: { id: userId, displayName: 'Student Seller', verified: true },
      status: 'REJECTED',
    })

    await expect(
      service.moderate('admin-1', 'listing-1', { decision: 'HIDE', reason: 'Not allowed' }),
    ).rejects.toMatchObject({ code: 'INVALID_MODERATION_TRANSITION' })
  })
})

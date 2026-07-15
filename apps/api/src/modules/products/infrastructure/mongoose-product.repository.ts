import type {
  AdminProductListQuery,
  Category,
  CreateOfficialProductInput,
  HomepageSectionKey,
  PaginatedResult,
  ProductDetail,
  ProductImage,
  ProductListQuery,
  ProductSummary,
  UpdateOfficialProductInput,
} from '@campusbaza/contracts'
import { Types } from 'mongoose'
import { CategoryModel } from '../../categories/infrastructure/category.model.js'
import { UserModel, UserProfileModel } from '../../users/infrastructure/user.models.js'
import type { ProductRepository } from '../domain/product.js'
import { ProductImageModel, ProductModel } from './product.models.js'

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

type Hydration = {
  categories: Map<string, Category>
  images: Map<string, ProductImage[]>
}

function mapSummary(document: Record<string, unknown>, hydration: Hydration): ProductSummary {
  const category = hydration.categories.get(String(document.categoryId))
  if (!category) throw new Error('Product category could not be hydrated')
  const images = hydration.images.get(String(document._id)) ?? []
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

export class MongooseProductRepository implements ProductRepository {
  async listPublic(query: ProductListQuery): Promise<PaginatedResult<ProductSummary>> {
    const filter = await this.publicFilter(query)
    const sort = this.sortFor(query.sort)
    const skip = (query.page - 1) * query.limit
    const [documents, total] = await Promise.all([
      ProductModel.find(filter)
        .sort(sort)
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

  async listAdmin(query: AdminProductListQuery): Promise<PaginatedResult<ProductSummary>> {
    const filter: Record<string, unknown> = { deletedAt: null }
    await this.applySharedFilters(filter, query)
    if (query.status) filter.status = query.status
    const skip = (query.page - 1) * query.limit
    const [documents, total] = await Promise.all([
      ProductModel.find(filter)
        .sort(this.sortFor(query.sort))
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

  async findPublicBySlug(slug: string): Promise<ProductDetail | null> {
    const activeSellerIds = await UserModel.find({ status: 'ACTIVE' }).distinct('_id')
    const document = await ProductModel.findOne({
      slug,
      deletedAt: null,
      status: 'APPROVED',
      published: true,
      stock: { $gt: 0 },
      sellerId: { $in: activeSellerIds },
    }).lean<Record<string, unknown>>()
    if (!document) return null
    return this.hydrateDetail(document)
  }

  async findAdminById(id: string): Promise<ProductDetail | null> {
    const document = await ProductModel.findOne({ _id: id, deletedAt: null }).lean<
      Record<string, unknown>
    >()
    if (!document) return null
    return this.hydrateDetail(document)
  }

  async findEligibleByIds(ids: string[]): Promise<ProductSummary[]> {
    const activeSellerIds = await UserModel.find({ status: 'ACTIVE' }).distinct('_id')
    const validIds = ids.filter((id) => Types.ObjectId.isValid(id))
    if (!validIds.length) return []
    const documents = await ProductModel.find({
      _id: { $in: validIds },
      deletedAt: null,
      status: 'APPROVED',
      published: true,
      stock: { $gt: 0 },
      sellerId: { $in: activeSellerIds },
    }).lean<Record<string, unknown>[]>()
    const hydrated = await this.hydrateSummaries(documents)
    const byId = new Map(hydrated.map((product) => [product.id, product]))
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  }

  async listAutomaticCandidates(
    section: HomepageSectionKey,
    limit: number,
    excludeIds: string[],
  ): Promise<ProductSummary[]> {
    const activeSellerIds = await UserModel.find({ status: 'ACTIVE' }).distinct('_id')
    const activeCategoryIds = await CategoryModel.find({
      deletedAt: null,
      isActive: true,
    }).distinct('_id')
    const filter: Record<string, unknown> = {
      deletedAt: null,
      status: 'APPROVED',
      published: true,
      stock: { $gt: 0 },
      categoryId: { $in: activeCategoryIds },
      sellerId: { $in: activeSellerIds },
      ...(excludeIds.length
        ? { _id: { $nin: excludeIds.filter((id) => Types.ObjectId.isValid(id)) } }
        : {}),
    }
    if (section === 'OFFICIAL') filter.productType = 'NEW'
    if (section === 'SECOND_HAND') filter.productType = 'SECOND_HAND'
    const sort =
      section === 'RECENT'
        ? { createdAt: -1 as const }
        : {
            isFeatured: -1 as const,
            completedOrderCount: -1 as const,
            viewCount: -1 as const,
            createdAt: -1 as const,
          }
    const documents = await ProductModel.find(filter)
      .sort(sort)
      .limit(limit)
      .lean<Record<string, unknown>[]>()
    return this.hydrateSummaries(documents)
  }

  async createOfficial(
    input: CreateOfficialProductInput,
    adminId: string,
    slug: string,
  ): Promise<ProductDetail> {
    const now = new Date()
    const status = input.stock === 0 ? 'OUT_OF_STOCK' : 'APPROVED'
    const document = await ProductModel.create({
      title: input.title,
      slug,
      description: input.description,
      categoryId: input.categoryId,
      price: input.price,
      originalPrice: input.originalPrice ?? null,
      stock: input.stock,
      condition: 'NEW',
      productType: 'NEW',
      sellerType: 'ADMIN',
      sellerId: adminId,
      status,
      published: input.publish,
      pickupLocation: input.pickupLocation ?? null,
      tags: [...new Set(input.tags.map((tag) => tag.toLowerCase()))],
      isFeatured: input.isFeatured,
      approvedAt: now,
      approvedBy: adminId,
    })
    await this.replaceImages(String(document._id), input.images, input.title)
    const created = await this.findAdminById(String(document._id))
    if (!created) throw new Error('Unable to hydrate created product')
    return created
  }

  async updateOfficial(
    id: string,
    input: UpdateOfficialProductInput & { slug?: string },
  ): Promise<ProductDetail | null> {
    const update: Record<string, unknown> = { ...input }
    delete update.images
    if (input.publish !== undefined) {
      update.published = input.publish
      delete update.publish
    }
    if (input.stock !== undefined) update.status = input.stock === 0 ? 'OUT_OF_STOCK' : 'APPROVED'
    if (input.tags) update.tags = [...new Set(input.tags.map((tag) => tag.toLowerCase()))]
    const document = await ProductModel.findOneAndUpdate(
      { _id: id, deletedAt: null, sellerType: 'ADMIN' },
      { $set: update },
      { new: true, runValidators: true },
    ).lean<Record<string, unknown>>()
    if (!document) return null
    if (input.images) await this.replaceImages(id, input.images, String(document.title))
    return this.findAdminById(id)
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return Boolean(
      await ProductModel.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }),
    )
  }

  async incrementView(id: string): Promise<void> {
    await ProductModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } })
  }

  private async publicFilter(query: ProductListQuery) {
    const activeSellerIds = await UserModel.find({ status: 'ACTIVE' }).distinct('_id')
    const activeCategoryIds = await CategoryModel.find({
      deletedAt: null,
      isActive: true,
    }).distinct('_id')
    const filter: Record<string, unknown> = {
      deletedAt: null,
      status: 'APPROVED',
      published: true,
      stock: { $gt: 0 },
      categoryId: { $in: activeCategoryIds },
      sellerId: { $in: activeSellerIds },
    }
    await this.applySharedFilters(filter, query)
    return filter
  }

  private async applySharedFilters(
    filter: Record<string, unknown>,
    query: ProductListQuery | AdminProductListQuery,
  ) {
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i')
      filter.$or = [{ title: regex }, { description: regex }, { tags: regex }]
    }
    if (query.category) {
      const category = await CategoryModel.findOne({ slug: query.category, deletedAt: null })
        .select('_id')
        .lean()
      filter.categoryId = category?._id ?? new Types.ObjectId()
    }
    if (query.productType) filter.productType = query.productType
    if (query.sellerType) filter.sellerType = query.sellerType
    if (query.condition) filter.condition = query.condition
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      }
    }
  }

  private sortFor(sort: ProductListQuery['sort']) {
    if (sort === 'oldest') return { createdAt: 1 as const }
    if (sort === 'price_asc') return { price: 1 as const, createdAt: -1 as const }
    if (sort === 'price_desc') return { price: -1 as const, createdAt: -1 as const }
    if (sort === 'popular')
      return { completedOrderCount: -1 as const, viewCount: -1 as const, createdAt: -1 as const }
    return { createdAt: -1 as const }
  }

  private async hydrateSummaries(documents: Record<string, unknown>[]): Promise<ProductSummary[]> {
    if (!documents.length) return []
    const productIds = documents.map((document) => document._id)
    const categoryIds = [...new Set(documents.map((document) => String(document.categoryId)))]
    const [categoryDocuments, imageDocuments] = await Promise.all([
      CategoryModel.find({ _id: { $in: categoryIds }, deletedAt: null, isActive: true }).lean<
        Record<string, unknown>[]
      >(),
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
    return documents
      .filter((document) => categories.has(String(document.categoryId)))
      .map((document) => mapSummary(document, { categories, images }))
  }

  private async hydrateDetail(document: Record<string, unknown>): Promise<ProductDetail | null> {
    const summaries = await this.hydrateSummaries([document])
    const summary = summaries[0]
    if (!summary) return null
    const images = await ProductImageModel.find({ productId: document._id })
      .sort({ displayOrder: 1 })
      .lean<Record<string, unknown>[]>()
    let seller: ProductDetail['seller'] = null
    if (document.sellerType === 'USER') {
      const [user, profile] = await Promise.all([
        UserModel.findById(document.sellerId)
          .select('status emailVerified')
          .lean<Record<string, unknown>>(),
        UserProfileModel.findOne({ userId: document.sellerId })
          .select('displayName fullName')
          .lean<Record<string, unknown>>(),
      ])
      if (user?.status === 'ACTIVE') {
        seller = {
          id: String(document.sellerId),
          displayName:
            typeof profile?.displayName === 'string'
              ? profile.displayName
              : typeof profile?.fullName === 'string'
                ? profile.fullName
                : 'Campus seller',
          verified: Boolean(user.emailVerified),
        }
      }
    }
    return {
      ...summary,
      description: String(document.description),
      tags: (document.tags as string[]) ?? [],
      images: images.map(mapImage),
      seller,
      updatedAt: (document.updatedAt as Date).toISOString(),
    }
  }

  private async replaceImages(
    productId: string,
    input: CreateOfficialProductInput['images'],
    title: string,
  ) {
    await ProductImageModel.deleteMany({ productId })
    if (!input.length) return
    const hasPrimary = input.some((image) => image.isPrimary)
    await ProductImageModel.insertMany(
      input.map((image, index) => ({
        productId,
        url: image.url,
        altText: image.altText || title,
        displayOrder: image.displayOrder ?? index,
        isPrimary: hasPrimary ? image.isPrimary : index === 0,
      })),
    )
  }
}

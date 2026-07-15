import type {
  AdminProductListQuery,
  CreateOfficialProductInput,
  ProductListQuery,
  UpdateOfficialProductInput,
} from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import { slugify } from '../../../core/utils/slug.js'
import type { CategoryRepository } from '../../categories/domain/category.js'
import type { ProductRepository } from '../domain/product.js'

export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
  ) {}

  listPublic(query: ProductListQuery) {
    return this.products.listPublic(query)
  }

  listAdmin(query: AdminProductListQuery) {
    return this.products.listAdmin(query)
  }

  async getPublic(slug: string) {
    const product = await this.products.findPublicBySlug(slug)
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found or unavailable.')
    await this.products.incrementView(product.id)
    return { ...product, viewCount: product.viewCount + 1 }
  }

  async getAdmin(id: string) {
    const product = await this.products.findAdminById(id)
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')
    return product
  }

  async createOfficial(input: CreateOfficialProductInput, adminId: string) {
    await this.assertCategory(input.categoryId)
    const slug = await this.uniqueSlug(input.title)
    return this.products.createOfficial(input, adminId, slug)
  }

  async updateOfficial(id: string, input: UpdateOfficialProductInput) {
    const current = await this.products.findAdminById(id)
    if (!current) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')
    if (current.sellerType !== 'ADMIN') {
      throw new AppError(
        409,
        'NOT_OFFICIAL_PRODUCT',
        'User-submitted products are moderated separately.',
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
    const slug = input.title ? await this.uniqueSlug(input.title, id) : undefined
    const updated = await this.products.updateOfficial(id, { ...input, ...(slug ? { slug } : {}) })
    if (!updated) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')
    return updated
  }

  private async assertCategory(categoryId: string) {
    const category = await this.categories.findById(categoryId)
    if (!category || !category.isActive) {
      throw new AppError(400, 'CATEGORY_NOT_AVAILABLE', 'Choose an active category.')
    }
  }

  private async uniqueSlug(title: string, excludeId?: string) {
    const base = slugify(title) || 'product'
    let slug = base
    let suffix = 2
    while (await this.products.slugExists(slug, excludeId)) slug = `${base}-${suffix++}`
    return slug
  }
}

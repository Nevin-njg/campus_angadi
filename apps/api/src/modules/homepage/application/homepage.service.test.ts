import type {
  Category,
  HomepageSectionKey,
  PaginatedResult,
  ProductDetail,
  ProductSummary,
} from '@campusbaza/contracts'
import { describe, expect, it } from 'vitest'
import type { CategoryRepository } from '../../categories/domain/category.js'
import type { ProductRepository } from '../../products/domain/product.js'
import type { HomepageRepository, HomepageSelectionRecord } from '../domain/homepage.js'
import { HomepageService } from './homepage.service.js'

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

function product(id: string, type: 'NEW' | 'SECOND_HAND' = 'NEW'): ProductSummary {
  return {
    id,
    slug: `product-${id}`,
    title: `Product ${id}`,
    category: { id: category.id, name: category.name, slug: category.slug },
    price: 100,
    originalPrice: null,
    stock: 1,
    condition: type === 'NEW' ? 'NEW' : 'GOOD',
    productType: type,
    sellerType: type === 'NEW' ? 'ADMIN' : 'USER',
    status: 'APPROVED',
    published: true,
    isFeatured: true,
    pickupLocation: null,
    primaryImage: null,
    viewCount: 0,
    completedOrderCount: 0,
    createdAt: new Date(0).toISOString(),
  }
}

class FakeHomepageRepository implements HomepageRepository {
  records = new Map<HomepageSectionKey, HomepageSelectionRecord>()

  async list() {
    return [...this.records.values()]
  }
  async find(key: HomepageSectionKey) {
    return this.records.get(key) ?? null
  }
  async save(key: HomepageSectionKey, productIds: string[], adminId: string) {
    const record = { key, productIds, updatedAt: new Date(), updatedBy: adminId }
    this.records.set(key, record)
    return record
  }
  async reset(key: HomepageSectionKey, adminId: string) {
    this.records.set(key, { key, productIds: [], updatedAt: new Date(), updatedBy: adminId })
  }
}

class FakeCategoryRepository implements CategoryRepository {
  async listPublic() {
    return [category]
  }
  async listAdmin() {
    return [category]
  }
  async findById() {
    return category
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

class FakeProductRepository implements ProductRepository {
  constructor(readonly values: ProductSummary[]) {}

  async listPublic(): Promise<PaginatedResult<ProductSummary>> {
    return {
      items: this.values,
      meta: { page: 1, limit: 10, total: this.values.length, totalPages: 1 },
    }
  }
  async listAdmin(): Promise<PaginatedResult<ProductSummary>> {
    return {
      items: this.values,
      meta: { page: 1, limit: 10, total: this.values.length, totalPages: 1 },
    }
  }
  async findPublicBySlug(): Promise<ProductDetail | null> {
    return null
  }
  async findAdminById(): Promise<ProductDetail | null> {
    return null
  }
  async findEligibleByIds(ids: string[]) {
    const map = new Map(this.values.map((value) => [value.id, value]))
    return ids.flatMap((id) => (map.has(id) ? [map.get(id)!] : []))
  }
  async listAutomaticCandidates(section: HomepageSectionKey, limit: number, excludeIds: string[]) {
    return this.values
      .filter((value) => !excludeIds.includes(value.id))
      .filter((value) => section !== 'OFFICIAL' || value.productType === 'NEW')
      .filter((value) => section !== 'SECOND_HAND' || value.productType === 'SECOND_HAND')
      .slice(0, limit)
  }
  async createOfficial(): Promise<ProductDetail> {
    throw new Error('Not used')
  }
  async updateOfficial(): Promise<ProductDetail | null> {
    return null
  }
  async slugExists() {
    return false
  }
  async incrementView() {}
}

function createService(homepage: FakeHomepageRepository, values: ProductSummary[]) {
  return new HomepageService(
    homepage,
    new FakeProductRepository(values),
    new FakeCategoryRepository(),
    { FEATURED: 4, OFFICIAL: 4, SECOND_HAND: 4, RECENT: 4 },
  )
}

describe('HomepageService', () => {
  it('keeps manual order and fills remaining positions automatically', async () => {
    const homepage = new FakeHomepageRepository()
    await homepage.save('FEATURED', ['p2', 'p1'], 'admin')
    const service = createService(homepage, [
      product('p1'),
      product('p2'),
      product('p3'),
      product('p4'),
    ])

    const result = await service.getPublic()

    expect(result.sections.FEATURED.products.map((item) => item.id)).toEqual([
      'p2',
      'p1',
      'p3',
      'p4',
    ])
    expect(result.sections.FEATURED.manualCount).toBe(2)
    expect(result.sections.FEATURED.automaticCount).toBe(2)
  })

  it('rejects products that do not match the selected section', async () => {
    const homepage = new FakeHomepageRepository()
    const service = createService(homepage, [product('used-1', 'SECOND_HAND')])

    await expect(service.updateSelection('OFFICIAL', ['used-1'], 'admin')).rejects.toMatchObject({
      code: 'HOMEPAGE_PRODUCT_INELIGIBLE',
    })
  })

  it('resets a section to fully automatic selection', async () => {
    const homepage = new FakeHomepageRepository()
    await homepage.save('RECENT', ['p2'], 'admin')
    const service = createService(homepage, [product('p1'), product('p2')])

    const result = await service.resetSelection('RECENT', 'admin')

    expect(result.manualProductIds).toEqual([])
    expect(result.manualCount).toBe(0)
    expect(result.products).toHaveLength(2)
  })
})

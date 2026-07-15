import type {
  HomepagePayload,
  HomepageSection,
  HomepageSectionKey,
  ProductSummary,
} from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type { CategoryRepository } from '../../categories/domain/category.js'
import type { ProductRepository } from '../../products/domain/product.js'
import type { HomepageRepository } from '../domain/homepage.js'

export type HomepageLimits = Record<HomepageSectionKey, number>

const keys: HomepageSectionKey[] = ['FEATURED', 'OFFICIAL', 'SECOND_HAND', 'RECENT']

export class HomepageService {
  constructor(
    private readonly homepage: HomepageRepository,
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly limits: HomepageLimits,
  ) {}

  async getPublic(): Promise<HomepagePayload> {
    const [categories, selections] = await Promise.all([
      this.categories.listPublic(),
      this.homepage.list(),
    ])
    const selectionMap = new Map(
      selections.map((selection) => [selection.key, selection.productIds]),
    )
    const sections = {} as Record<HomepageSectionKey, HomepageSection>
    for (const key of keys)
      sections[key] = await this.resolveSection(key, selectionMap.get(key) ?? [])
    return { categories, sections }
  }

  async getAdminConfiguration() {
    const [payload, selections] = await Promise.all([this.getPublic(), this.homepage.list()])
    return {
      ...payload,
      configuration: keys.map((key) => ({
        key,
        limit: this.limits[key],
        manualProductIds: selections.find((selection) => selection.key === key)?.productIds ?? [],
      })),
    }
  }

  async updateSelection(key: HomepageSectionKey, productIds: string[], adminId: string) {
    const unique = [...new Set(productIds)]
    if (unique.length > this.limits[key]) {
      throw new AppError(
        400,
        'HOMEPAGE_LIMIT_EXCEEDED',
        `This section accepts at most ${this.limits[key]} manual products.`,
      )
    }
    const eligible = await this.products.findEligibleByIds(unique)
    const eligibleIds = new Set(
      eligible.filter((product) => this.matchesSection(product, key)).map((product) => product.id),
    )
    const invalid = unique.filter((id) => !eligibleIds.has(id))
    if (invalid.length) {
      throw new AppError(
        400,
        'HOMEPAGE_PRODUCT_INELIGIBLE',
        'One or more selected products are unavailable or do not belong in this section.',
        { productIds: invalid },
      )
    }
    await this.homepage.save(key, unique, adminId)
    return this.resolveSection(key, unique)
  }

  async resetSelection(key: HomepageSectionKey, adminId: string) {
    await this.homepage.reset(key, adminId)
    return this.resolveSection(key, [])
  }

  private async resolveSection(
    key: HomepageSectionKey,
    manualProductIds: string[],
  ): Promise<HomepageSection> {
    const limit = this.limits[key]
    const eligibleManual = (await this.products.findEligibleByIds(manualProductIds))
      .filter((product) => this.matchesSection(product, key))
      .slice(0, limit)
    const remaining = Math.max(0, limit - eligibleManual.length)
    const automatic = remaining
      ? await this.products.listAutomaticCandidates(
          key,
          remaining,
          eligibleManual.map((product) => product.id),
        )
      : []
    const products = [...eligibleManual, ...automatic].slice(0, limit)
    return {
      key,
      limit,
      manualProductIds,
      products,
      manualCount: eligibleManual.length,
      automaticCount: Math.max(0, products.length - eligibleManual.length),
    }
  }

  private matchesSection(product: ProductSummary, key: HomepageSectionKey) {
    if (key === 'OFFICIAL') return product.productType === 'NEW' && product.sellerType === 'ADMIN'
    if (key === 'SECOND_HAND')
      return product.productType === 'SECOND_HAND' && product.sellerType === 'USER'
    return true
  }
}

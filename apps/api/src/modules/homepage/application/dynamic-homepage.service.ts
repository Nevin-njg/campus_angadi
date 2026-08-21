import type {
  AdminDynamicHomepagePayload,
  CreateHomepageSectionInput,
  DynamicHomepagePayload,
  DynamicHomepageSection,
  DynamicHomepageSectionType,
  HomepageDepartmentSummary,
  HomepageStoreSummary,
  ProductSummary,
  UpdateHomepageSectionInput,
} from '@campusbaza/contracts'
import { Types } from 'mongoose'
import { AppError } from '../../../core/errors/app-error.js'
import type { CategoryRepository } from '../../categories/domain/category.js'
import { OrderModel } from '../../orders/infrastructure/order.models.js'
import type { ProductRepository } from '../../products/domain/product.js'
import { ProductModel } from '../../products/infrastructure/product.models.js'
import { StoreDepartmentModel } from '../../stores/infrastructure/store-department.model.js'
import { StoreModel } from '../../stores/infrastructure/store.model.js'
import { UserModel } from '../../users/infrastructure/user.models.js'
import type {
  DynamicHomepageRepository,
  DynamicHomepageSectionRecord,
  UpdateDynamicHomepageSectionRecord,
} from '../domain/homepage.js'

function unique(values: string[]) {
  return [...new Set(values)]
}

function validObjectIds(values: string[]) {
  return values.filter((value) => Types.ObjectId.isValid(value))
}

export class DynamicHomepageService {
  constructor(
    private readonly homepage: DynamicHomepageRepository,
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async getPublic(): Promise<DynamicHomepagePayload> {
    const [categories, records] = await Promise.all([
      this.categories.listPublic(),
      this.homepage.list(),
    ])

    const resolved = await Promise.all(
      records
        .filter((record) => record.enabled)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((record) => this.resolveSection(record)),
    )

    return {
      categories,
      sections: resolved.filter(
        (section): section is DynamicHomepageSection => section !== null,
      ),
    }
  }

  async getAdminConfiguration(): Promise<AdminDynamicHomepagePayload> {
    const [publicPayload, records] = await Promise.all([
      this.getPublic(),
      this.homepage.list(),
    ])

    return {
      ...publicPayload,
      configuration: records
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((record) => ({
          id: record.id,
          type: record.type,
          title: record.title,
          enabled: record.enabled,
          displayOrder: record.displayOrder,
          limit: record.limit,
          departmentId: record.departmentId,
          manualProductIds: record.productIds,
          manualStoreIds: record.storeIds,
        })),
    }
  }

  async createSection(
    input: CreateHomepageSectionInput,
    adminId: string,
  ): Promise<DynamicHomepageSectionRecord> {
    await this.validateSectionConfiguration({
      type: input.type,
      departmentId: input.departmentId ?? null,
      productIds: input.productIds,
      storeIds: input.storeIds,
      limit: input.limit,
    })

    if (input.type !== 'STORE_CATEGORY') {
      const existing = (await this.homepage.list()).some(
        (section) => section.type === input.type,
      )

      if (existing) {
        throw new AppError(
          409,
          'HOMEPAGE_SECTION_EXISTS',
          'This homepage section already exists.',
        )
      }
    }

    if (input.type === 'STORE_CATEGORY' && input.departmentId) {
      const existing = (await this.homepage.list()).some(
        (section) =>
          section.type === 'STORE_CATEGORY' &&
          section.departmentId === input.departmentId,
      )

      if (existing) {
        throw new AppError(
          409,
          'HOMEPAGE_DEPARTMENT_SECTION_EXISTS',
          'This store department already has a homepage section.',
        )
      }
    }

    return this.homepage.create({
      type: input.type,
      title: input.title,
      enabled: input.enabled,
      displayOrder: input.displayOrder,
      limit: input.limit,
      departmentId:
        input.type === 'STORE_CATEGORY'
          ? (input.departmentId ?? null)
          : null,
      productIds:
        input.type === 'FEATURED_PRODUCTS' ||
        input.type === 'SECOND_HAND_PRODUCTS'
          ? unique(input.productIds)
          : [],
      storeIds:
        input.type === 'STORE_CATEGORY'
          ? unique(input.storeIds)
          : [],
      updatedBy: adminId,
    })
  }

  async updateSection(
    id: string,
    input: UpdateHomepageSectionInput,
    adminId: string,
  ): Promise<DynamicHomepageSectionRecord> {
    const current = await this.homepage.findById(id)

    if (!current) {
      throw new AppError(
        404,
        'HOMEPAGE_SECTION_NOT_FOUND',
        'Homepage section not found.',
      )
    }

    const limit = input.limit ?? current.limit
    const departmentId =
      input.departmentId !== undefined
        ? input.departmentId
        : current.departmentId
    const productIds =
      input.productIds !== undefined
        ? unique(input.productIds)
        : current.productIds
    const storeIds =
      input.storeIds !== undefined
        ? unique(input.storeIds)
        : current.storeIds

    await this.validateSectionConfiguration({
      type: current.type,
      departmentId,
      productIds,
      storeIds,
      limit,
    })

    if (
      current.type === 'STORE_CATEGORY' &&
      departmentId &&
      departmentId !== current.departmentId
    ) {
      const duplicate = (await this.homepage.list()).some(
        (section) =>
          section.id !== current.id &&
          section.type === 'STORE_CATEGORY' &&
          section.departmentId === departmentId,
      )

      if (duplicate) {
        throw new AppError(
          409,
          'HOMEPAGE_DEPARTMENT_SECTION_EXISTS',
          'This store department already has a homepage section.',
        )
      }
    }

    const changes: UpdateDynamicHomepageSectionRecord = {
      updatedBy: adminId,
    }

    if (input.title !== undefined) {
      changes.title = input.title
    }

    if (input.enabled !== undefined) {
      changes.enabled = input.enabled
    }

    if (input.displayOrder !== undefined) {
      changes.displayOrder = input.displayOrder
    }

    if (input.limit !== undefined) {
      changes.limit = input.limit
    }

    if (input.departmentId !== undefined) {
      changes.departmentId = input.departmentId
    }

    if (input.productIds !== undefined) {
      changes.productIds = unique(input.productIds)
    }

    if (input.storeIds !== undefined) {
      changes.storeIds = unique(input.storeIds)
    }

    const updated = await this.homepage.update(id, changes)

    if (!updated) {
      throw new AppError(
        404,
        'HOMEPAGE_SECTION_NOT_FOUND',
        'Homepage section not found.',
      )
    }

    return updated
  }

  async removeSection(id: string): Promise<{ id: string }> {
    const removed = await this.homepage.remove(id)

    if (!removed) {
      throw new AppError(
        404,
        'HOMEPAGE_SECTION_NOT_FOUND',
        'Homepage section not found.',
      )
    }

    return { id }
  }

  private async resolveSection(
    record: DynamicHomepageSectionRecord,
  ): Promise<DynamicHomepageSection | null> {
    if (record.type === 'STORE_CATEGORY') {
      return this.resolveStoreSection(record)
    }

    const products = await this.resolveProductSection(record)

    if (!products.length) {
      return null
    }

    return {
      id: record.id,
      type: record.type,
      title: record.title,
      displayOrder: record.displayOrder,
      limit: record.limit,
      department: null,
      products,
      stores: [],
    }
  }

  private async resolveProductSection(
    record: DynamicHomepageSectionRecord,
  ): Promise<ProductSummary[]> {
    if (record.type === 'POPULAR_PRODUCTS') {
      return this.products.listDynamicHomepageCandidates(
        'POPULAR_NEW',
        record.limit,
      )
    }

    if (record.productIds.length > 0) {
      const selected = await this.products.findEligibleByIds(
        record.productIds,
      )

      const filtered = selected.filter((product) =>
        this.productMatchesSection(product, record.type),
      )

      /*
       * Manual mode is intentionally exact.
       *
       * We do not automatically fill missing positions when an admin has
       * manually selected products.
       */
      return filtered.slice(0, record.limit)
    }

    if (record.type === 'FEATURED_PRODUCTS') {
      return this.products.listDynamicHomepageCandidates(
        'NEWEST_NEW',
        record.limit,
      )
    }

    if (record.type === 'SECOND_HAND_PRODUCTS') {
      return this.products.listDynamicHomepageCandidates(
        'NEWEST_SECOND_HAND',
        record.limit,
      )
    }

    return []
  }

  private async resolveStoreSection(
    record: DynamicHomepageSectionRecord,
  ): Promise<DynamicHomepageSection | null> {
    if (!record.departmentId) {
      return null
    }

    const department = await StoreDepartmentModel.findOne({
      _id: record.departmentId,
      isActive: true,
    })
      .lean<Record<string, unknown>>()

    if (!department) {
      return null
    }

    const stores =
      record.storeIds.length > 0
        ? await this.manualStores(
            record.departmentId,
            record.storeIds,
            record.limit,
          )
        : await this.automaticStores(
            record.departmentId,
            record.limit,
          )

    if (!stores.length) {
      return null
    }

    const departmentSummary: HomepageDepartmentSummary = {
      id: String(department._id),
      name: String(department.name),
      slug: String(department.slug),
      description:
        typeof department.description === 'string'
          ? department.description
          : null,
    }

    return {
      id: record.id,
      type: 'STORE_CATEGORY',
      title: record.title,
      displayOrder: record.displayOrder,
      limit: record.limit,
      department: departmentSummary,
      products: [],
      stores,
    }
  }

  private async manualStores(
    departmentId: string,
    storeIds: string[],
    limit: number,
  ): Promise<HomepageStoreSummary[]> {
    const eligible = await this.storeCandidates(
      departmentId,
      storeIds,
    )

    const byId = new Map(
      eligible.map((store) => [store.id, store]),
    )

    return storeIds
      .flatMap((id) => {
        const store = byId.get(id)
        return store ? [store] : []
      })
      .slice(0, limit)
  }

  private async automaticStores(
    departmentId: string,
    limit: number,
  ): Promise<HomepageStoreSummary[]> {
    const stores = await this.storeCandidates(departmentId)

    if (!stores.length) {
      return []
    }

    const ids = stores.map((store) => new Types.ObjectId(store.id))

    const orderStats = await OrderModel.aggregate<{
      _id: Types.ObjectId
      completedOrders: number
      lastCompletedAt: Date | null
    }>([
      {
        $match: {
          storeId: { $in: ids },
          status: 'COMPLETED',
        },
      },
      {
        $group: {
          _id: '$storeId',
          completedOrders: { $sum: 1 },
          lastCompletedAt: { $max: '$completedAt' },
        },
      },
    ])

    const stats = new Map(
      orderStats.map((entry) => [
        String(entry._id),
        {
          completedOrders: entry.completedOrders,
          lastCompletedAt: entry.lastCompletedAt
            ? new Date(entry.lastCompletedAt).getTime()
            : 0,
        },
      ]),
    )

    return [...stores]
      .sort((left, right) => {
        const leftStats = stats.get(left.id) ?? {
          completedOrders: 0,
          lastCompletedAt: 0,
        }

        const rightStats = stats.get(right.id) ?? {
          completedOrders: 0,
          lastCompletedAt: 0,
        }

        if (
          rightStats.completedOrders !== leftStats.completedOrders
        ) {
          return (
            rightStats.completedOrders -
            leftStats.completedOrders
          )
        }

        if (right.productCount !== left.productCount) {
          return right.productCount - left.productCount
        }

        if (
          rightStats.lastCompletedAt !==
          leftStats.lastCompletedAt
        ) {
          return (
            rightStats.lastCompletedAt -
            leftStats.lastCompletedAt
          )
        }

        return left.name.localeCompare(right.name)
      })
      .slice(0, limit)
  }

  private async storeCandidates(
    departmentId: string,
    selectedStoreIds?: string[],
  ): Promise<HomepageStoreSummary[]> {
    if (!Types.ObjectId.isValid(departmentId)) {
      return []
    }

    const activeSellerIds = await UserModel.find({
      status: 'ACTIVE',
    }).distinct('_id')

    const filter: Record<string, unknown> = {
      departmentId,
      status: 'ACTIVE',
      sellerId: { $in: activeSellerIds },
    }

    if (selectedStoreIds?.length) {
      filter._id = {
        $in: validObjectIds(selectedStoreIds),
      }
    }

    const stores = await StoreModel.find(filter)
      .sort({ name: 1 })
      .lean<Record<string, unknown>[]>()

    if (!stores.length) {
      return []
    }

    const storeIds = stores.map((store) => store._id)

    const productCounts = await ProductModel.aggregate<{
      _id: Types.ObjectId
      productCount: number
    }>([
      {
        $match: {
          storeId: { $in: storeIds },
          productType: 'NEW',
          status: 'APPROVED',
          published: true,
          deletedAt: null,
          stock: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$storeId',
          productCount: { $sum: 1 },
        },
      },
    ])

    const productCountByStore = new Map(
      productCounts.map((entry) => [
        String(entry._id),
        entry.productCount,
      ]),
    )

    return stores
      .map((store): HomepageStoreSummary => ({
        id: String(store._id),
        name: String(store.name),
        slug: String(store.slug),
        description:
          typeof store.description === 'string'
            ? store.description
            : null,
        logoUrl:
          typeof store.logoUrl === 'string'
            ? store.logoUrl
            : null,
        bannerUrl:
          typeof store.bannerUrl === 'string'
            ? store.bannerUrl
            : null,
        campusLocation:
          typeof store.campusLocation === 'string'
            ? store.campusLocation
            : null,
        deliveryTimeMinutes: Number(
          store.deliveryTimeMinutes ?? 30,
        ),
        minimumOrderAmount: Number(
          store.minimumOrderAmount ?? 0,
        ),
        productCount:
          productCountByStore.get(String(store._id)) ?? 0,
      }))
      .filter((store) => store.productCount > 0)
  }

  private productMatchesSection(
    product: ProductSummary,
    type: DynamicHomepageSectionType,
  ) {
    if (type === 'FEATURED_PRODUCTS') {
      return product.productType === 'NEW'
    }

    if (type === 'SECOND_HAND_PRODUCTS') {
      return (
        product.productType === 'SECOND_HAND' &&
        product.sellerType === 'USER'
      )
    }

    return false
  }

  private async validateSectionConfiguration(input: {
    type: DynamicHomepageSectionType
    departmentId: string | null
    productIds: string[]
    storeIds: string[]
    limit: number
  }) {
    if (
      input.productIds.length > input.limit ||
      input.storeIds.length > input.limit
    ) {
      throw new AppError(
        400,
        'HOMEPAGE_LIMIT_EXCEEDED',
        `This section accepts at most ${input.limit} manually selected items.`,
      )
    }

    if (input.type === 'POPULAR_PRODUCTS') {
      if (input.productIds.length || input.storeIds.length) {
        throw new AppError(
          400,
          'HOMEPAGE_POPULAR_AUTOMATIC',
          'Popular Products is an automatic section and cannot contain manual selections.',
        )
      }

      return
    }

    if (input.type === 'STORE_CATEGORY') {
      if (!input.departmentId) {
        throw new AppError(
          400,
          'HOMEPAGE_DEPARTMENT_REQUIRED',
          'Select a store department for this homepage section.',
        )
      }

      if (!Types.ObjectId.isValid(input.departmentId)) {
        throw new AppError(
          400,
          'HOMEPAGE_DEPARTMENT_INVALID',
          'Select a valid store department.',
        )
      }

      const department = await StoreDepartmentModel.findOne({
        _id: input.departmentId,
        isActive: true,
      })
        .select('_id')
        .lean()

      if (!department) {
        throw new AppError(
          404,
          'HOMEPAGE_DEPARTMENT_NOT_FOUND',
          'The selected store department is unavailable.',
        )
      }

      if (input.productIds.length) {
        throw new AppError(
          400,
          'HOMEPAGE_STORE_SECTION_PRODUCTS_INVALID',
          'Store category sections cannot contain manually selected products.',
        )
      }

      if (input.storeIds.length) {
        const stores = await this.storeCandidates(
          input.departmentId,
          input.storeIds,
        )

        const eligibleIds = new Set(stores.map((store) => store.id))

        const invalidIds = unique(input.storeIds).filter(
          (id) => !eligibleIds.has(id),
        )

        if (invalidIds.length) {
          throw new AppError(
            400,
            'HOMEPAGE_STORE_INELIGIBLE',
            'One or more selected stores are inactive, unavailable, empty, or do not belong to this department.',
            {
              storeIds: invalidIds,
            },
          )
        }
      }

      return
    }

    if (input.departmentId || input.storeIds.length) {
      throw new AppError(
        400,
        'HOMEPAGE_SECTION_CONFIGURATION_INVALID',
        'Product homepage sections cannot contain a store department or store selections.',
      )
    }

    if (input.productIds.length) {
      const eligible = await this.products.findEligibleByIds(
        unique(input.productIds),
      )

      const eligibleIds = new Set(
        eligible
          .filter((product) =>
            this.productMatchesSection(product, input.type),
          )
          .map((product) => product.id),
      )

      const invalidIds = unique(input.productIds).filter(
        (id) => !eligibleIds.has(id),
      )

      if (invalidIds.length) {
        throw new AppError(
          400,
          'HOMEPAGE_PRODUCT_INELIGIBLE',
          'One or more selected products are unavailable or do not belong in this section.',
          {
            productIds: invalidIds,
          },
        )
      }
    }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import mongoose, { isValidObjectId } from 'mongoose'
import { AppError } from '../../../core/errors/app-error.js'
import { StoreModel } from '../infrastructure/store.model.js'
import { StoreDepartmentModel } from '../infrastructure/store-department.model.js'
import { StoreOfferModel } from '../infrastructure/store-offer.model.js'
import { ProductImageModel, ProductModel } from '../../products/infrastructure/product.models.js'
import {
  OrderItemModel,
  OrderModel,
  OrderStatusHistoryModel,
} from '../../orders/infrastructure/order.models.js'
import { UserModel } from '../../users/infrastructure/user.models.js'
import { CategoryModel } from '../../categories/infrastructure/category.model.js'
import type { ImageUploadService } from '../../uploads/application/image-upload.service.js'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const productSlug = (title: string) => `${slugify(title)}-${Date.now().toString(36)}`

const money = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

type StoreOfferDiscountType = 'PERCENTAGE' | 'FLAT'

const offerDiscountedPrice = (
  basePrice: number,
  discountType: StoreOfferDiscountType,
  discountValue: number,
) => {
  if (discountType === 'PERCENTAGE') {
    if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 90) {
      throw new AppError(
        400,
        'OFFER_PERCENT_INVALID',
        'Percentage discount must be between 1% and 90%.',
      )
    }
    return money(basePrice * (1 - discountValue / 100))
  }

  if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue >= basePrice) {
    throw new AppError(
      400,
      'OFFER_FLAT_INVALID',
      'Flat discount must be greater than zero and lower than the regular price.',
    )
  }

  return money(basePrice - discountValue)
}

const offerDate = (value: unknown, code: string, message: string) => {
  const date = new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) throw new AppError(400, code, message)
  return date
}

const offerSummaryView = (offer: any) => ({
  id: String(offer._id),
  status: offer.status,
  discountType: offer.discountType,
  discountValue: offer.discountValue,
  basePrice: offer.basePrice,
  discountedPrice: offer.discountedPrice,
  startsAt: offer.startsAt,
  endsAt: offer.endsAt,
})

const offerView = (offer: any, product: any, imageUrl: string | null = null) => ({
  id: String(offer._id),
  storeId: String(offer.storeId),
  productId: String(offer.productId),
  productTitle: product?.title ?? 'Deleted product',
  productImage: imageUrl,
  discountType: offer.discountType,
  discountValue: offer.discountValue,
  basePrice: offer.basePrice,
  discountedPrice: offer.discountedPrice,
  startsAt: offer.startsAt,
  endsAt: offer.endsAt,
  status: offer.status,
  isCurrent: Boolean(offer.isCurrent),
  createdAt: offer.createdAt,
  updatedAt: offer.updatedAt,
})

const storeView = (store: any) => ({
  id: String(store._id),
  name: store.name,
  slug: store.slug,
  description: store.description ?? null,
  logoUrl: store.logoUrl ?? null,
  bannerUrl: store.bannerUrl ?? null,
  sellerId: String(store.sellerId),
  departmentId: store.departmentId ? String(store.departmentId) : null,
  commissionPercent: store.commissionPercent,
  status: store.status,
  campusLocation: store.campusLocation ?? null,
  deliveryTimeMinutes: store.deliveryTimeMinutes,
  minimumOrderAmount: store.minimumOrderAmount,
  categories: (store.categories ?? []).map((category: any) => ({
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
  })),
})

const STORE_DEPARTMENT_CARD_THEMES = new Set([
  'FOOD',
  'SPORTS',
  'STATIONERY',
  'ELECTRONICS',
  'GROCERY',
  'FASHION',
  'CUSTOM',
  'GENERAL',
])

function departmentCardTheme(
  value: unknown,
): 'FOOD' | 'SPORTS' | 'STATIONERY' | 'ELECTRONICS' | 'GROCERY' | 'FASHION' | 'CUSTOM' | 'GENERAL' {
  if (value === undefined || value === null || value === '') {
    return 'GENERAL'
  }

  const theme = String(value).trim().toUpperCase()

  if (!STORE_DEPARTMENT_CARD_THEMES.has(theme)) {
    throw new AppError(
      400,
      'STORE_DEPARTMENT_THEME_INVALID',
      'Select a valid store department card theme.',
    )
  }

  return theme as
    | 'FOOD'
    | 'SPORTS'
    | 'STATIONERY'
    | 'ELECTRONICS'
    | 'GROCERY'
    | 'FASHION'
    | 'CUSTOM'
    | 'GENERAL'
}

function departmentCardColor(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const color = String(value).trim()

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new AppError(
      400,
      'STORE_DEPARTMENT_CARD_COLOR_INVALID',
      'Custom card colors must use a valid hex color such as #F5EDFF.',
    )
  }

  return color.toUpperCase()
}

function departmentCardStickers(value: unknown) {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new AppError(
      400,
      'STORE_DEPARTMENT_STICKERS_INVALID',
      'Custom card stickers must be a list.',
    )
  }

  const stickers = value
    .map((item) => String(item).trim())
    .filter(Boolean)

  if (stickers.length > 5) {
    throw new AppError(
      400,
      'STORE_DEPARTMENT_STICKERS_LIMIT',
      'Choose at most 5 custom card stickers.',
    )
  }

  if (stickers.some((sticker) => sticker.length > 16)) {
    throw new AppError(
      400,
      'STORE_DEPARTMENT_STICKER_INVALID',
      'Each custom sticker must be short.',
    )
  }

  return stickers
}

const departmentView = (department: any) => ({
  id: String(department._id),
  name: department.name,
  slug: department.slug,
  description: department.description ?? null,
  cardTheme: department.cardTheme ?? 'GENERAL',
  customBackgroundStart: department.customBackgroundStart ?? null,
  customBackgroundEnd: department.customBackgroundEnd ?? null,
  customStickers: department.customStickers ?? [],
  isActive: department.isActive,
  displayOrder: department.displayOrder,
  createdAt: department.createdAt,
  updatedAt: department.updatedAt,
})

const productView = (product: any, imageUrl: string | null = null) => ({
  id: String(product._id),
  slug: product.slug,
  title: product.title,
  description: product.description,
  price: product.price,
  originalPrice: product.originalPrice ?? null,
  stock: product.stock,
  status: product.status,
  published: product.published,
  productType: product.productType,
  sellerType: product.sellerType,
  storeCategoryId: product.storeCategoryId ? String(product.storeCategoryId) : null,
  primaryImage: imageUrl,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
})

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const discountDetails = (product: any) => {
  const originalPrice = Number(product.originalPrice ?? 0)
  const price = Number(product.price ?? 0)
  if (originalPrice <= price || originalPrice <= 0) {
    return { discountPercent: 0, savings: 0 }
  }
  return {
    discountPercent: Math.round(((originalPrice - price) / originalPrice) * 100),
    savings: money(originalPrice - price),
  }
}

const marketplaceProductView = (product: any, store: any, imageUrl: string | null = null) => {
  const category = (store.categories ?? []).find(
    (item: any) => String(item._id) === String(product.storeCategoryId),
  )
  return {
    ...productView(product, imageUrl),
    ...discountDetails(product),
    storeCategoryName: category?.name ?? null,
    store: {
      id: String(store._id),
      name: store.name,
      slug: store.slug,
      logoUrl: store.logoUrl ?? null,
      campusLocation: store.campusLocation ?? null,
      deliveryTimeMinutes: store.deliveryTimeMinutes,
      minimumOrderAmount: store.minimumOrderAmount,
    },
  }
}

const officialMarketplaceProductView = (
  product: any,
  categoryName: string | null,
  imageUrl: string | null = null,
) => ({
  ...productView(product, imageUrl),
  ...discountDetails(product),
  storeCategoryName: categoryName,
  store: null,
})

const orderView = (order: any, items: any[] = []) => ({
  id: String(order._id),
  orderNumber: order.orderNumber,
  status: order.status,
  totalAmount: order.totalAmount,
  itemCount: order.itemCount,
  fullName: order.fullName,
  phoneNumber: order.phoneNumber,
  pickupLocation: order.pickupLocation,
  preferredPickupTime: order.preferredPickupTime ?? null,
  notes: order.notes ?? null,
  createdAt: order.createdAt,
  completedAt: order.completedAt ?? null,
  cancelledAt: order.cancelledAt ?? null,
  items: items.map((item) => ({
    id: String(item._id),
    productName: item.productName,
    productImageUrl: item.productImageUrl ?? null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
  })),
})

const sellerStatusTransitions: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  WAITING_FOR_DEALER_ASSIGNMENT: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  AWAITING_TEAM_CONFIRMATION: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONTACTED: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  PREPARING: ['COMPLETED', 'CANCELLED'],
  DELIVERING_TO_CAMPUS: ['COMPLETED', 'CANCELLED'],
  ARRIVED_AT_CAMPUS: ['COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
}

function transactionUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('Transaction numbers are only allowed') ||
    message.includes('replica set member or mongos') ||
    message.includes('does not support retryable writes')
  )
}

export class StoreService {
  constructor(private readonly uploads: ImageUploadService) {}

  private async resolveDepartmentId(value: unknown) {
    if (value === undefined) return undefined

    if (value === null || String(value).trim() === '') {
      return null
    }

    const departmentId = String(value).trim()

    if (!isValidObjectId(departmentId)) {
      throw new AppError(
        400,
        'STORE_DEPARTMENT_INVALID',
        'Select a valid store department.',
      )
    }

    const department = await StoreDepartmentModel.findById(departmentId)
      .select('_id')
      .lean()

    if (!department) {
      throw new AppError(
        404,
        'STORE_DEPARTMENT_NOT_FOUND',
        'Selected store department was not found.',
      )
    }

    return department._id
  }

  private async sellerDocument(sellerId: string) {
    const store = await StoreModel.findOne({ sellerId })
    if (!store) {
      throw new AppError(404, 'STORE_NOT_FOUND', 'No store is assigned to this seller.')
    }
    return store
  }

  async list(query = '') {
    const filter: Record<string, unknown> = { status: 'ACTIVE' }
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { slug: { $regex: query, $options: 'i' } },
      ]
    }
    return (await StoreModel.find(filter).sort({ name: 1 }).lean()).map(storeView)
  }

  async searchMarketplace(query = '', departmentId = '') {
    const normalizedQuery = String(query).trim().slice(0, 80)
    const normalizedDepartmentId = String(departmentId).trim()
    const searchPattern = normalizedQuery ? new RegExp(escapeRegExp(normalizedQuery), 'i') : null

    if (normalizedDepartmentId && !isValidObjectId(normalizedDepartmentId)) {
      throw new AppError(
        400,
        'STORE_DEPARTMENT_INVALID',
        'The selected store department is invalid.',
      )
    }

    const activeSellerIds = await UserModel.find({ status: 'ACTIVE' }).distinct('_id')

    const storeFilter: Record<string, unknown> = {
      status: 'ACTIVE',
      sellerId: { $in: activeSellerIds },
    }

    if (normalizedDepartmentId) {
      storeFilter.departmentId = normalizedDepartmentId
    }

    const activeStores: any[] = await StoreModel.find(storeFilter)
      .sort({ name: 1 })
      .lean()
    const activeStoreIds = activeStores.map((store) => store._id)

    const directlyMatchingStores = searchPattern
      ? activeStores.filter((store) =>
          [store.name, store.slug, store.description, store.campusLocation]
            .filter(Boolean)
            .some((value) => searchPattern.test(String(value))),
        )
      : activeStores
    const directlyMatchingStoreIds = directlyMatchingStores.map((store) => store._id)

    const productScope: Record<string, unknown> = normalizedDepartmentId
      ? {
          productType: 'NEW',
          storeId: { $in: activeStoreIds },
        }
      : {
          $or: [
            {
              productType: 'NEW',
              $or: [
                { storeId: { $in: activeStoreIds } },
                { sellerType: 'ADMIN', storeId: null },
              ],
            },
            {
              productType: 'SECOND_HAND',
              sellerType: 'USER',
              storeId: null,
            },
          ],
        }

    const productFilter: Record<string, unknown> = {
      status: 'APPROVED',
      published: true,
      deletedAt: null,
      sellerId: { $in: activeSellerIds },
      $and: [productScope],
    }
    if (searchPattern) {
      ;(productFilter.$and as Record<string, unknown>[]).push({
        $or: [
          { title: searchPattern },
          { description: searchPattern },
          { tags: { $in: [searchPattern] } },
        ],
      })
    }

    const products: any[] = await ProductModel.find(productFilter)
      .sort({ isFeatured: -1, completedOrderCount: -1, createdAt: -1 })
      .limit(80)
      .lean()

    const storeById = new Map(activeStores.map((store) => [String(store._id), store]))
    const visibleProducts = products.filter(
      (product) =>
        storeById.has(String(product.storeId)) ||
        (!product.storeId &&
          product.productType === 'NEW' &&
          product.sellerType === 'ADMIN') ||
        (!product.storeId &&
          product.productType === 'SECOND_HAND' &&
          product.sellerType === 'USER'),
    )
    const nonStoreCategoryIds = visibleProducts
      .filter((product) => !product.storeId)
      .map((product) => product.categoryId)
    const [images, nonStoreCategories] = await Promise.all([
      ProductImageModel.find({
        productId: { $in: visibleProducts.map((product) => product._id) },
        isPrimary: true,
      }).lean(),
      CategoryModel.find({
        _id: { $in: nonStoreCategoryIds },
        deletedAt: null,
        isActive: true,
      })
        .select('_id name')
        .lean(),
    ])
    const imageByProduct = new Map(images.map((image) => [String(image.productId), image.url]))
    const categoryNameById = new Map(
      nonStoreCategories.map((category) => [String(category._id), category.name]),
    )

    const productsByStore = new Map<string, any[]>()
    for (const product of visibleProducts) {
      if (!product.storeId) continue
      const key = String(product.storeId)
      productsByStore.set(key, [...(productsByStore.get(key) ?? []), product])
    }

    const resultStoreIds = new Set([
      ...directlyMatchingStores.map((store) => String(store._id)),
      ...visibleProducts.map((product) => String(product.storeId)),
    ])

    const stores = activeStores
      .filter((store) => resultStoreIds.has(String(store._id)))
      .map((store) => {
        const matchingProducts = productsByStore.get(String(store._id)) ?? []
        const inStockProducts = matchingProducts.filter((product) => Number(product.stock) > 0)
        const prices = matchingProducts
          .map((product) => Number(product.price))
          .filter(Number.isFinite)
        return {
          ...storeView(store),
          matchingProductCount: matchingProducts.length,
          inStockProductCount: inStockProducts.length,
          lowestMatchingPrice: prices.length ? Math.min(...prices) : null,
          highestDiscountPercent: matchingProducts.reduce(
            (highest, product) => Math.max(highest, discountDetails(product).discountPercent),
            0,
          ),
        }
      })
      .sort((left, right) => {
        if (right.matchingProductCount !== left.matchingProductCount) {
          return right.matchingProductCount - left.matchingProductCount
        }
        if (left.deliveryTimeMinutes !== right.deliveryTimeMinutes) {
          return left.deliveryTimeMinutes - right.deliveryTimeMinutes
        }
        return left.name.localeCompare(right.name)
      })

    const productViews = visibleProducts.map((product) => {
      const store = storeById.get(String(product.storeId))
      const imageUrl = imageByProduct.get(String(product._id)) ?? null
      return store
        ? marketplaceProductView(product, store, imageUrl)
        : officialMarketplaceProductView(
            product,
            categoryNameById.get(String(product.categoryId)) ?? null,
            imageUrl,
          )
    })

    return {
      query: normalizedQuery,
      stores,
      products: productViews,
      meta: {
        storeCount: stores.length,
        productCount: productViews.length,
        inStockCount: productViews.filter((product) => product.stock > 0).length,
      },
    }
  }

  async browse(slug: string, query = '') {
    const store: any = await StoreModel.findOne({ slug, status: 'ACTIVE' }).lean()
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found.')

    const filter: Record<string, unknown> = {
      storeId: store._id,
      productType: 'NEW',
      status: 'APPROVED',
      published: true,
      deletedAt: null,
    }
    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } },
      ]
    }

    const products = await ProductModel.find(filter).sort({ isFeatured: -1, createdAt: -1 }).lean()
    const images = await ProductImageModel.find({
      productId: { $in: products.map((product) => product._id) },
      isPrimary: true,
    }).lean()
    const imageByProduct = new Map(images.map((image) => [String(image.productId), image.url]))

    return {
      store: storeView(store),
      products: products.map((product: any) =>
        productView(product, imageByProduct.get(String(product._id)) ?? null),
      ),
    }
  }

  async listDepartments() {
    const departments = await StoreDepartmentModel.find({
      isActive: true,
    })
      .sort({ displayOrder: 1, name: 1 })
      .lean()

    return departments.map(departmentView)
  }

  async adminListDepartments() {
    const departments = await StoreDepartmentModel.find()
      .sort({ displayOrder: 1, name: 1 })
      .lean()

    return departments.map(departmentView)
  }

  async createDepartment(input: any) {
    const name = String(input.name ?? '').trim()

    if (name.length < 2) {
      throw new AppError(
        400,
        'STORE_DEPARTMENT_NAME_INVALID',
        'Enter a valid department name.',
      )
    }

    const slug = slugify(String(input.slug ?? '').trim() || name)

    if (!slug) {
      throw new AppError(
        400,
        'STORE_DEPARTMENT_SLUG_INVALID',
        'Enter a valid department name.',
      )
    }

    const duplicate = await StoreDepartmentModel.exists({
      $or: [
        { name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' } },
        { slug },
      ],
    })

    if (duplicate) {
      throw new AppError(
        409,
        'STORE_DEPARTMENT_EXISTS',
        'A store department with this name already exists.',
      )
    }

    const department = await StoreDepartmentModel.create({
      name,
      slug,
      description: String(input.description ?? '').trim() || null,
      cardTheme: departmentCardTheme(input.cardTheme),
      customBackgroundStart: departmentCardColor(input.customBackgroundStart),
      customBackgroundEnd: departmentCardColor(input.customBackgroundEnd),
      customStickers: departmentCardStickers(input.customStickers),
      isActive: typeof input.isActive === 'boolean' ? input.isActive : true,
      displayOrder: Math.max(0, Number(input.displayOrder ?? 0) || 0),
    })

    return departmentView(department.toObject())
  }

  async updateDepartment(id: string, input: any) {
    const department = await StoreDepartmentModel.findById(id)

    if (!department) {
      throw new AppError(
        404,
        'STORE_DEPARTMENT_NOT_FOUND',
        'Store department not found.',
      )
    }

    if (typeof input.name === 'string') {
      const name = input.name.trim()

      if (name.length < 2) {
        throw new AppError(
          400,
          'STORE_DEPARTMENT_NAME_INVALID',
          'Enter a valid department name.',
        )
      }

      const slug =
        typeof input.slug === 'string' && input.slug.trim()
          ? slugify(input.slug)
          : slugify(name)

      const duplicate = await StoreDepartmentModel.exists({
        _id: { $ne: department._id },
        $or: [
          { name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' } },
          { slug },
        ],
      })

      if (duplicate) {
        throw new AppError(
          409,
          'STORE_DEPARTMENT_EXISTS',
          'A store department with this name already exists.',
        )
      }

      department.name = name
      department.slug = slug
    } else if (typeof input.slug === 'string' && input.slug.trim()) {
      const slug = slugify(input.slug)

      const duplicate = await StoreDepartmentModel.exists({
        _id: { $ne: department._id },
        slug,
      })

      if (duplicate) {
        throw new AppError(
          409,
          'STORE_DEPARTMENT_EXISTS',
          'A store department with this slug already exists.',
        )
      }

      department.slug = slug
    }

    if (typeof input.description === 'string') {
      department.description = input.description.trim() || null
    }

    if (input.cardTheme !== undefined) {
      department.cardTheme = departmentCardTheme(input.cardTheme)
    }

    if (input.customBackgroundStart !== undefined) {
      department.customBackgroundStart = departmentCardColor(
        input.customBackgroundStart,
      )
    }

    if (input.customBackgroundEnd !== undefined) {
      department.customBackgroundEnd = departmentCardColor(
        input.customBackgroundEnd,
      )
    }

    if (input.customStickers !== undefined) {
      department.customStickers = departmentCardStickers(
        input.customStickers,
      )
    }

    if (typeof input.isActive === 'boolean') {
      department.isActive = input.isActive
    }

    if (input.displayOrder !== undefined) {
      const displayOrder = Number(input.displayOrder)

      if (!Number.isFinite(displayOrder) || displayOrder < 0) {
        throw new AppError(
          400,
          'STORE_DEPARTMENT_ORDER_INVALID',
          'Display order must be zero or greater.',
        )
      }

      department.displayOrder = Math.floor(displayOrder)
    }

    await department.save()
    return departmentView(department.toObject())
  }

  async removeDepartment(id: string) {
    const department = await StoreDepartmentModel.findById(id)

    if (!department) {
      throw new AppError(
        404,
        'STORE_DEPARTMENT_NOT_FOUND',
        'Store department not found.',
      )
    }

    const assignedStores = await StoreModel.countDocuments({
      departmentId: department._id,
    })

    if (assignedStores > 0) {
      throw new AppError(
        409,
        'STORE_DEPARTMENT_IN_USE',
        'Remove or change this department from its assigned stores before deleting it.',
      )
    }

    await StoreDepartmentModel.deleteOne({ _id: department._id })

    return {
      id: String(department._id),
    }
  }

  async adminList() {
    return (await StoreModel.find().sort({ createdAt: -1 }).lean()).map(storeView)
  }

  async create(input: any) {
    const seller = await UserModel.findById(input.sellerId)
    if (!seller) throw new AppError(404, 'SELLER_NOT_FOUND', 'Selected user was not found.')

    const exists = await StoreModel.exists({ sellerId: seller._id })
    if (exists) throw new AppError(409, 'SELLER_HAS_STORE', 'A seller can manage only one store.')

    const departmentId = await this.resolveDepartmentId(input.departmentId)

    seller.role = 'SELLER'
    seller.canSell = true
    await seller.save()

    const store = await StoreModel.create({
      ...input,
      departmentId: departmentId ?? null,
      slug: slugify(input.slug || input.name),
    })

    return storeView(store.toObject())
  }

  async update(id: string, input: any) {
    const changes = { ...input }

    if (Object.prototype.hasOwnProperty.call(input, 'departmentId')) {
      changes.departmentId = await this.resolveDepartmentId(input.departmentId)
    }

    const store: any = await StoreModel.findByIdAndUpdate(id, changes, {
      new: true,
      runValidators: true,
    }).lean()

    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found.')

    return storeView(store)
  }

  async remove(id: string, actorId: string) {
    const store = await StoreModel.findById(id)
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found.')

    const openOrders = await OrderModel.countDocuments({
      storeId: store._id,
      status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
    })
    if (openOrders > 0) {
      throw new AppError(
        409,
        'STORE_HAS_OPEN_ORDERS',
        'Complete, cancel, or reject this store’s open orders before deleting it.',
      )
    }

    const now = new Date()
    await ProductModel.updateMany(
      { storeId: store._id, deletedAt: null },
      { $set: { deletedAt: now, deletedBy: actorId, status: 'DELETED', published: false } },
    )
    await UserModel.updateOne(
      { _id: store.sellerId, role: 'SELLER' },
      { $set: { role: 'USER', canSell: true } },
    )
    await StoreModel.deleteOne({ _id: store._id })
    return { id: String(store._id) }
  }

  async addCategory(sellerId: string, input: any) {
    const store = await this.sellerDocument(sellerId)
    const name = String(input.name ?? '').trim()
    if (name.length < 2) throw new AppError(400, 'CATEGORY_NAME_INVALID', 'Enter a category name.')
    if (
      store.categories.some((category: any) => category.name.toLowerCase() === name.toLowerCase())
    ) {
      throw new AppError(409, 'CATEGORY_EXISTS', 'This category already exists in your store.')
    }

    store.categories.push({
      name,
      slug: slugify(name),
      description: String(input.description ?? '').trim() || null,
      displayOrder: Number(input.displayOrder ?? store.categories.length),
      isActive: true,
    })
    await store.save()
    return storeView(store.toObject())
  }

  async updateCategory(sellerId: string, categoryId: string, input: any) {
    const store = await this.sellerDocument(sellerId)
    const category: any = store.categories.id(categoryId)
    if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.')

    if (typeof input.name === 'string' && input.name.trim()) {
      category.name = input.name.trim()
      category.slug = slugify(category.name)
    }
    if (typeof input.description === 'string')
      category.description = input.description.trim() || null
    if (typeof input.isActive === 'boolean') category.isActive = input.isActive
    if (Number.isFinite(Number(input.displayOrder)))
      category.displayOrder = Number(input.displayOrder)
    await store.save()
    return storeView(store.toObject())
  }

  async reorderCategories(sellerId: string, input: any) {
    const store = await this.sellerDocument(sellerId)
    const categoryIds: string[] = Array.isArray(input.categoryIds)
      ? input.categoryIds
          .map((id: unknown) => String(id).trim())
          .filter((id: string) => id.length > 0)
      : []

    const currentIds = store.categories.map((category: any) => String(category._id))
    const uniqueIds = [...new Set(categoryIds)]

    if (
      uniqueIds.length !== currentIds.length ||
      currentIds.some((id: string) => !uniqueIds.includes(id))
    ) {
      throw new AppError(
        400,
        'CATEGORY_ORDER_INVALID',
        'Category order must include every store category exactly once.',
      )
    }

    uniqueIds.forEach((categoryId, displayOrder) => {
      const category: any = store.categories.id(categoryId)
      if (category) category.displayOrder = displayOrder
    })

    await store.save()
    return storeView(store.toObject())
  }

  async deleteCategory(sellerId: string, categoryId: string) {
    const store = await this.sellerDocument(sellerId)
    const category: any = store.categories.id(categoryId)

    if (!category) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.')
    }

    const productCount = await ProductModel.countDocuments({
      storeId: store._id,
      storeCategoryId: category._id,
      deletedAt: null,
    })

    if (productCount > 0) {
      throw new AppError(
        409,
        'CATEGORY_IN_USE',
        `${productCount} product${productCount === 1 ? '' : 's'} still ${
          productCount === 1 ? 'uses' : 'use'
        } this category. Move or delete ${
          productCount === 1 ? 'it' : 'them'
        } first.`,
      )
    }

    store.categories.pull(category._id)

    // Normalize display order after removal.
    const ordered = [...store.categories].sort(
      (left: any, right: any) => Number(left.displayOrder) - Number(right.displayOrder),
    )
    ordered.forEach((item: any, displayOrder: number) => {
      item.displayOrder = displayOrder
    })

    await store.save()
    return storeView(store.toObject())
  }

  async sellerStore(sellerId: string) {
    const store: any = await StoreModel.findOne({ sellerId }).lean()
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'No store is assigned to this seller.')

    const [productCount, orders, lowStockCount] = await Promise.all([
      ProductModel.countDocuments({ storeId: store._id, deletedAt: null }),
      OrderModel.find({ storeId: store._id }).sort({ createdAt: -1 }).lean(),
      ProductModel.countDocuments({ storeId: store._id, deletedAt: null, stock: { $lte: 5 } }),
    ])

    const completedOrders = orders.filter((order: any) => order.status === 'COMPLETED')
    const activeOrders = orders.filter(
      (order: any) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status),
    )
    const grossSales = completedOrders.reduce(
      (sum: number, order: any) => sum + (order.totalAmount || 0),
      0,
    )
    const pendingRevenue = activeOrders.reduce(
      (sum: number, order: any) => sum + (order.totalAmount || 0),
      0,
    )
    const commissionAmount = money((grossSales * store.commissionPercent) / 100)

    return {
      store: storeView(store),
      analytics: {
        productCount,
        orderCount: orders.length,
        activeOrderCount: activeOrders.length,
        completedOrderCount: completedOrders.length,
        lowStockCount,
        grossSales: money(grossSales),
        pendingRevenue: money(pendingRevenue),
        commissionAmount,
        netEarnings: money(grossSales - commissionAmount),
      },
      recentOrders: orders.slice(0, 5).map((order: any) => orderView(order)),
    }
  }

  async sellerProducts(sellerId: string, query = '') {
    const store = await this.sellerDocument(sellerId)
    const filter: Record<string, unknown> = { storeId: store._id, deletedAt: null }
    if (query) filter.title = { $regex: query, $options: 'i' }
    const products = await ProductModel.find(filter).sort({ createdAt: -1 }).lean()
    const productIds = products.map((product) => product._id)

    const [images, currentOffers] = await Promise.all([
      ProductImageModel.find({
        productId: { $in: productIds },
        isPrimary: true,
      }).lean(),
      StoreOfferModel.find({
        productId: { $in: productIds },
        isCurrent: true,
      }).lean(),
    ])

    const imageByProduct = new Map(
      images.map((image) => [String(image.productId), image.url]),
    )
    const offerByProduct = new Map(
      currentOffers.map((offer: any) => [String(offer.productId), offer]),
    )

    return products.map((product: any) => {
      const currentOffer = offerByProduct.get(String(product._id))
      return {
        ...productView(product, imageByProduct.get(String(product._id)) ?? null),
        currentOffer: currentOffer ? offerSummaryView(currentOffer) : null,
      }
    })
  }

  async createProduct(sellerId: string, input: any) {
    const store = await this.sellerDocument(sellerId)
    const title = String(input.title ?? '').trim()
    const description = String(input.description ?? '').trim()
    const price = money(input.price)
    const stock = Number(input.stock)
    const categoryId = String(input.storeCategoryId ?? '')
    const category: any = store.categories.id(categoryId)

    if (title.length < 2) throw new AppError(400, 'PRODUCT_TITLE_INVALID', 'Enter a product name.')
    if (description.length < 5)
      throw new AppError(400, 'PRODUCT_DESCRIPTION_INVALID', 'Add a short description.')
    if (!category) throw new AppError(400, 'STORE_CATEGORY_REQUIRED', 'Select a store category.')
    if (price <= 0)
      throw new AppError(400, 'PRODUCT_PRICE_INVALID', 'Price must be greater than zero.')
    if (!Number.isInteger(stock) || stock < 0)
      throw new AppError(400, 'PRODUCT_STOCK_INVALID', 'Stock must be zero or more.')

    const rawImageUploadIds: string[] = Array.isArray(input.imageUploadIds)
      ? (input.imageUploadIds as unknown[])
          .map((id) => String(id).trim())
          .filter((id) => id.length > 0)
      : []

    const imageUploadIds: string[] = [...new Set(rawImageUploadIds)]

    if (!imageUploadIds.length) {
      const legacyImageUploadId = String(input.imageUploadId ?? '').trim()
      if (legacyImageUploadId) imageUploadIds.push(legacyImageUploadId)
    }

    if (imageUploadIds.length > 8) {
      throw new AppError(
        400,
        'PRODUCT_IMAGE_LIMIT_EXCEEDED',
        'A product can have a maximum of 8 images.',
      )
    }

    const uploadedImages = imageUploadIds.length
      ? await this.uploads.assertOwnedTemporary(sellerId, imageUploadIds)
      : []

    const fallbackImageUrl =
      uploadedImages.length === 0 ? String(input.imageUrl ?? '').trim() : ''

    const primaryImageUrl = uploadedImages[0]?.url ?? fallbackImageUrl

    let product: any = null

    try {
      product = await ProductModel.create({
        title,
        slug: productSlug(title),
        description,
        categoryId: category._id,
        storeCategoryId: category._id,
        price,
        originalPrice: null,
        stock,
        condition: 'NEW',
        productType: 'NEW',
        sellerType: 'ADMIN',
        storeId: store._id,
        sellerId,
        status: stock > 0 ? 'APPROVED' : 'OUT_OF_STOCK',
        published: input.published !== false,
        pickupLocation: store.campusLocation,
        tags: Array.isArray(input.tags)
          ? input.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
          : [],
        approvedAt: new Date(),
        approvedBy: sellerId,
      })

      if (uploadedImages.length) {
        await ProductImageModel.insertMany(
          uploadedImages.map((image, index) => ({
            productId: product._id,
            url: image.url,
            altText: title,
            displayOrder: index,
            isPrimary: index === 0,
          })),
        )

        await this.uploads.attachToProduct(
          sellerId,
          uploadedImages.map((image) => image.id),
          String(product._id),
        )
      } else if (fallbackImageUrl) {
        await ProductImageModel.create({
          productId: product._id,
          url: fallbackImageUrl,
          altText: title,
          displayOrder: 0,
          isPrimary: true,
        })
      }

      return productView(product.toObject(), primaryImageUrl || null)
    } catch (error) {
      if (product?._id) {
        await Promise.allSettled([
          ProductImageModel.deleteMany({ productId: product._id }),
          ProductModel.deleteOne({ _id: product._id }),
        ])
      }
      throw error
    }
  }

  async updateProduct(sellerId: string, productId: string, input: any) {
    const store = await this.sellerDocument(sellerId)

    const rawImageUploadIds: string[] = Array.isArray(input.imageUploadIds)
      ? (input.imageUploadIds as unknown[])
          .map((id) => String(id).trim())
          .filter((id) => id.length > 0)
      : []

    const imageUploadIds: string[] = [...new Set(rawImageUploadIds)]

    if (!imageUploadIds.length) {
      const legacyImageUploadId = String(input.imageUploadId ?? '').trim()
      if (legacyImageUploadId) imageUploadIds.push(legacyImageUploadId)
    }

    if (imageUploadIds.length > 8) {
      throw new AppError(
        400,
        'PRODUCT_IMAGE_LIMIT_EXCEEDED',
        'A product can have a maximum of 8 images.',
      )
    }

    const uploadedImages = imageUploadIds.length
      ? await this.uploads.assertOwnedTemporary(sellerId, imageUploadIds)
      : []

    const product: any = await ProductModel.findOne({
      _id: productId,
      storeId: store._id,
      deletedAt: null,
    })

    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')

    const currentOffer: any = await StoreOfferModel.findOne({
      productId: product._id,
      isCurrent: true,
    })

    if (typeof input.title === 'string' && input.title.trim()) {
      product.title = input.title.trim()
    }

    if (typeof input.description === 'string' && input.description.trim()) {
      product.description = input.description.trim()
    }

    if (input.price !== undefined) {
      const price = money(input.price)
      if (price <= 0)
        throw new AppError(400, 'PRODUCT_PRICE_INVALID', 'Price must be greater than zero.')

      if (currentOffer) {
        const discountedPrice = offerDiscountedPrice(
          price,
          currentOffer.discountType as StoreOfferDiscountType,
          Number(currentOffer.discountValue),
        )
        currentOffer.basePrice = price
        currentOffer.discountedPrice = discountedPrice

        if (currentOffer.status === 'ACTIVE') {
          product.originalPrice = price
          product.price = discountedPrice
        } else {
          product.originalPrice = null
          product.price = price
        }
      } else {
        product.price = price
      }
    }

    if (input.stock !== undefined) {
      const stock = Number(input.stock)
      if (!Number.isInteger(stock) || stock < 0)
        throw new AppError(400, 'PRODUCT_STOCK_INVALID', 'Stock must be zero or more.')

      product.stock = stock
      product.status = stock > 0 ? 'APPROVED' : 'OUT_OF_STOCK'
    }

    if (typeof input.published === 'boolean') {
      product.published = input.published
    }

    if (typeof input.storeCategoryId === 'string') {
      const category: any = store.categories.id(input.storeCategoryId)

      if (!category) {
        throw new AppError(400, 'STORE_CATEGORY_REQUIRED', 'Select a valid category.')
      }

      product.storeCategoryId = category._id
      product.categoryId = category._id
    }

    if (currentOffer) await currentOffer.save()
    await product.save()

    const currentPrimaryImage = await ProductImageModel.findOne({
      productId: product._id,
      isPrimary: true,
    }).lean()

    let imageUrl: string | null = currentPrimaryImage?.url ?? null

    if (uploadedImages.length) {
      await this.uploads.attachToProduct(
        sellerId,
        uploadedImages.map((image) => image.id),
        String(product._id),
      )

      await ProductImageModel.deleteMany({
        productId: product._id,
      })

      await ProductImageModel.insertMany(
        uploadedImages.map((image, index) => ({
          productId: product._id,
          url: image.url,
          altText: product.title,
          displayOrder: index,
          isPrimary: index === 0,
        })),
      )

      imageUrl = uploadedImages[0]?.url ?? null
    } else if (typeof input.imageUrl === 'string') {
      const requestedImageUrl = input.imageUrl.trim()
      const currentImageUrl = currentPrimaryImage?.url ?? ''

      if (requestedImageUrl !== currentImageUrl) {
        await ProductImageModel.deleteMany({
          productId: product._id,
        })

        if (requestedImageUrl) {
          await ProductImageModel.create({
            productId: product._id,
            url: requestedImageUrl,
            altText: product.title,
            displayOrder: 0,
            isPrimary: true,
          })
        }

        imageUrl = requestedImageUrl || null
      }
    }

    return productView(product.toObject(), imageUrl)
  }

  async deleteProduct(sellerId: string, productId: string) {
    const store = await this.sellerDocument(sellerId)
    const product = await ProductModel.findOneAndUpdate(
      { _id: productId, storeId: store._id, deletedAt: null },
      { deletedAt: new Date(), deletedBy: sellerId, status: 'DELETED', published: false },
      { new: true },
    )
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')
    return { id: String(product._id) }
  }

  async sellerOrders(sellerId: string, status = '') {
    const store = await this.sellerDocument(sellerId)
    const filter: Record<string, unknown> = { storeId: store._id }
    if (status) filter.status = status
    const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).lean()
    const items = await OrderItemModel.find({
      orderId: { $in: orders.map((order) => order._id) },
    }).lean()
    const itemsByOrder = new Map<string, any[]>()
    for (const item of items) {
      const key = String(item.orderId)
      itemsByOrder.set(key, [...(itemsByOrder.get(key) ?? []), item])
    }
    return orders.map((order: any) => orderView(order, itemsByOrder.get(String(order._id)) ?? []))
  }

  async decideOrder(sellerId: string, orderId: string, decision: string) {
    const store = await this.sellerDocument(sellerId)
    const normalizedDecision = String(decision).trim().toUpperCase()

    if (normalizedDecision !== 'ACCEPT' && normalizedDecision !== 'REJECT') {
      throw new AppError(
        400,
        'ORDER_DECISION_INVALID',
        'Choose either ACCEPT or REJECT for this order.',
      )
    }

    const nextStatus = normalizedDecision === 'ACCEPT' ? 'COMPLETED' : 'REJECTED'
    const session = await mongoose.startSession()
    let changed = false

    try {
      await session.withTransaction(async () => {
        changed = false
        const now = new Date()
        const set: Record<string, unknown> = {
          status: nextStatus,
          ...(nextStatus === 'COMPLETED'
            ? { completedAt: now }
            : { cancelledAt: now }),
        }

        const previousOrder: any = await OrderModel.findOneAndUpdate(
          {
            _id: orderId,
            storeId: store._id,
            status: 'PENDING',
          },
          { $set: set },
          { new: false, session },
        ).lean()

        if (!previousOrder) return
        changed = true

        const items: any[] = await OrderItemModel.find({ orderId })
          .session(session)
          .lean()

        if (nextStatus === 'REJECTED' && !previousOrder.stockRestored) {
          await Promise.all(
            items.map((item) =>
              ProductModel.updateOne(
                { _id: item.productId, deletedAt: null },
                [
                  { $set: { stock: { $add: ['$stock', Number(item.quantity)] } } },
                  {
                    $set: {
                      status: {
                        $cond: [
                          { $eq: ['$status', 'OUT_OF_STOCK'] },
                          'APPROVED',
                          '$status',
                        ],
                      },
                    },
                  },
                ],
                { session },
              ),
            ),
          )

          await OrderModel.updateOne(
            { _id: orderId },
            { $set: { stockRestored: true } },
            { session },
          )
        }

        if (nextStatus === 'COMPLETED') {
          await Promise.all(
            items.map((item) =>
              ProductModel.updateOne(
                { _id: item.productId },
                { $inc: { completedOrderCount: 1 } },
                { session },
              ),
            ),
          )
        }

        await OrderStatusHistoryModel.create(
          [
            {
              orderId,
              fromStatus: 'PENDING',
              toStatus: nextStatus,
              note:
                nextStatus === 'COMPLETED'
                  ? 'Accepted from seller mobile app.'
                  : 'Rejected from seller mobile app.',
              actorId: sellerId,
            },
          ],
          { session },
        )
      })
    } catch (error) {
      if (transactionUnavailable(error)) {
        throw new AppError(
          503,
          'DATABASE_TRANSACTIONS_REQUIRED',
          'Seller order decisions require MongoDB replica-set transactions.',
        )
      }
      throw error
    } finally {
      await session.endSession()
    }

    if (!changed) {
      const existing: any = await OrderModel.findOne({
        _id: orderId,
        storeId: store._id,
      }).lean()
      if (!existing) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.')

      throw new AppError(
        409,
        'ORDER_ALREADY_DECIDED',
        `This order is already ${String(existing.status).toLowerCase().replaceAll('_', ' ')}.`,
      )
    }

    const updated: any = await OrderModel.findOne({
      _id: orderId,
      storeId: store._id,
    }).lean()
    if (!updated) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.')

    const items = await OrderItemModel.find({ orderId }).lean()
    return orderView(updated, items)
  }

  async updateOrderStatus(sellerId: string, orderId: string, nextStatus: string, note = '') {
    const store = await this.sellerDocument(sellerId)
    const order: any = await OrderModel.findOne({ _id: orderId, storeId: store._id })
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.')

    const allowed = sellerStatusTransitions[String(order.status)] ?? []
    if (!allowed.includes(nextStatus)) {
      throw new AppError(
        409,
        'ORDER_STATUS_INVALID',
        'This order cannot move to the selected status.',
      )
    }

    const previousStatus = order.status
    order.status = nextStatus
    if (nextStatus === 'COMPLETED') order.completedAt = new Date()
    if (nextStatus === 'CANCELLED') order.cancelledAt = new Date()
    await order.save()
    await OrderStatusHistoryModel.create({
      orderId: order._id,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      note: String(note).trim() || null,
      actorId: sellerId,
    })
    return orderView(order.toObject())
  }

  async sellerOffers(sellerId: string) {
    const store = await this.sellerDocument(sellerId)
    const offers: any[] = await StoreOfferModel.find({ storeId: store._id })
      .sort({ isCurrent: -1, createdAt: -1 })
      .lean()

    const productIds = [...new Set(offers.map((offer) => String(offer.productId)))]
    const [products, images] = await Promise.all([
      ProductModel.find({ _id: { $in: productIds } }).lean(),
      ProductImageModel.find({ productId: { $in: productIds }, isPrimary: true }).lean(),
    ])

    const productById = new Map(
      products.map((product: any) => [String(product._id), product]),
    )
    const imageByProduct = new Map(
      images.map((image: any) => [String(image.productId), image.url]),
    )

    return offers.map((offer) =>
      offerView(
        offer,
        productById.get(String(offer.productId)),
        imageByProduct.get(String(offer.productId)) ?? null,
      ),
    )
  }

  async createOffer(sellerId: string, input: any) {
    const store = await this.sellerDocument(sellerId)
    const productId = String(input.productId ?? '').trim()

    if (!isValidObjectId(productId)) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')
    }

    const product: any = await ProductModel.findOne({
      _id: productId,
      storeId: store._id,
      sellerType: 'ADMIN',
      deletedAt: null,
    })
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')

    const existing = await StoreOfferModel.findOne({
      productId: product._id,
      isCurrent: true,
    }).lean()

    if (existing) {
      throw new AppError(
        409,
        'OFFER_ALREADY_EXISTS',
        'This product already has an active or scheduled offer.',
      )
    }

    const discountType = String(input.discountType ?? '').trim().toUpperCase()
    if (discountType !== 'PERCENTAGE' && discountType !== 'FLAT') {
      throw new AppError(400, 'OFFER_TYPE_INVALID', 'Choose a percentage or flat discount.')
    }

    const basePrice = money(product.originalPrice ?? product.price)
    const discountValue = Number(input.discountValue)
    const discountedPrice = offerDiscountedPrice(basePrice, discountType, discountValue)
    const startsAt = offerDate(input.startsAt, 'OFFER_START_INVALID', 'Choose a valid offer start time.')
    const endsAt = offerDate(input.endsAt, 'OFFER_END_INVALID', 'Choose a valid offer end time.')

    if (endsAt <= startsAt) {
      throw new AppError(400, 'OFFER_SCHEDULE_INVALID', 'Offer end time must be after the start time.')
    }

    const now = new Date()
    if (endsAt <= now) {
      throw new AppError(400, 'OFFER_END_INVALID', 'Offer end time must be in the future.')
    }

    const status = startsAt <= now ? 'ACTIVE' : 'SCHEDULED'
    const offer: any = await StoreOfferModel.create({
      storeId: store._id,
      sellerId,
      productId: product._id,
      discountType,
      discountValue,
      basePrice,
      discountedPrice,
      startsAt,
      endsAt,
      status,
      isCurrent: true,
    })

    if (status === 'ACTIVE') {
      product.originalPrice = basePrice
      product.price = discountedPrice
    } else {
      product.originalPrice = null
      product.price = basePrice
    }
    await product.save()

    const image = await ProductImageModel.findOne({
      productId: product._id,
      isPrimary: true,
    }).lean()

    return offerView(offer.toObject(), product.toObject(), image?.url ?? null)
  }

  async updateOffer(sellerId: string, offerId: string, input: any) {
    const store = await this.sellerDocument(sellerId)
    const offer: any = await StoreOfferModel.findOne({ _id: offerId, storeId: store._id })

    if (!offer) throw new AppError(404, 'OFFER_NOT_FOUND', 'Offer not found.')
    if (!offer.isCurrent || offer.status === 'EXPIRED') {
      throw new AppError(409, 'OFFER_EXPIRED', 'Expired offers cannot be edited.')
    }

    const product: any = await ProductModel.findOne({
      _id: offer.productId,
      storeId: store._id,
      deletedAt: null,
    })
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')

    const discountType =
      input.discountType === undefined
        ? String(offer.discountType)
        : String(input.discountType).trim().toUpperCase()

    if (discountType !== 'PERCENTAGE' && discountType !== 'FLAT') {
      throw new AppError(400, 'OFFER_TYPE_INVALID', 'Choose a percentage or flat discount.')
    }

    const discountValue =
      input.discountValue === undefined ? Number(offer.discountValue) : Number(input.discountValue)

    const discountedPrice = offerDiscountedPrice(
      Number(offer.basePrice),
      discountType,
      discountValue,
    )

    const startsAt =
      input.startsAt === undefined
        ? new Date(offer.startsAt)
        : offerDate(input.startsAt, 'OFFER_START_INVALID', 'Choose a valid offer start time.')

    const endsAt =
      input.endsAt === undefined
        ? new Date(offer.endsAt)
        : offerDate(input.endsAt, 'OFFER_END_INVALID', 'Choose a valid offer end time.')

    if (endsAt <= startsAt) {
      throw new AppError(400, 'OFFER_SCHEDULE_INVALID', 'Offer end time must be after the start time.')
    }

    const now = new Date()
    if (endsAt <= now) {
      throw new AppError(400, 'OFFER_END_INVALID', 'Offer end time must be in the future.')
    }

    offer.discountType = discountType
    offer.discountValue = discountValue
    offer.discountedPrice = discountedPrice
    offer.startsAt = startsAt
    offer.endsAt = endsAt
    offer.status = startsAt <= now ? 'ACTIVE' : 'SCHEDULED'
    offer.isCurrent = true

    if (offer.status === 'ACTIVE') {
      product.originalPrice = offer.basePrice
      product.price = discountedPrice
    } else {
      product.originalPrice = null
      product.price = offer.basePrice
    }

    await Promise.all([offer.save(), product.save()])

    const image = await ProductImageModel.findOne({
      productId: product._id,
      isPrimary: true,
    }).lean()

    return offerView(offer.toObject(), product.toObject(), image?.url ?? null)
  }

  async deleteOffer(sellerId: string, offerId: string) {
    const store = await this.sellerDocument(sellerId)
    const offer: any = await StoreOfferModel.findOne({ _id: offerId, storeId: store._id })

    if (!offer) throw new AppError(404, 'OFFER_NOT_FOUND', 'Offer not found.')

    if (offer.isCurrent) {
      await ProductModel.updateOne(
        { _id: offer.productId, storeId: store._id, deletedAt: null },
        { $set: { price: offer.basePrice, originalPrice: null } },
      )
    }

    await StoreOfferModel.deleteOne({ _id: offer._id })
    return { id: String(offer._id) }
  }

}

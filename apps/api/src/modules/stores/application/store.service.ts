import { AppError } from '../../../core/errors/app-error.js'
import { StoreModel } from '../infrastructure/store.model.js'
import { ProductImageModel, ProductModel } from '../../products/infrastructure/product.models.js'
import {
  OrderItemModel,
  OrderModel,
  OrderStatusHistoryModel,
} from '../../orders/infrastructure/order.models.js'
import { UserModel } from '../../users/infrastructure/user.models.js'
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

const storeView = (store: any) => ({
  id: String(store._id),
  name: store.name,
  slug: store.slug,
  description: store.description ?? null,
  logoUrl: store.logoUrl ?? null,
  bannerUrl: store.bannerUrl ?? null,
  sellerId: String(store.sellerId),
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

const marketplaceProductView = (
  product: any,
  store: any,
  imageUrl: string | null = null,
) => {
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
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['DELIVERING_TO_CAMPUS', 'CANCELLED'],
  DELIVERING_TO_CAMPUS: ['ARRIVED_AT_CAMPUS'],
  ARRIVED_AT_CAMPUS: ['READY_FOR_PICKUP'],
  READY_FOR_PICKUP: ['COMPLETED'],
}

export class StoreService {
  constructor(private readonly uploads: ImageUploadService) {}

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

  async searchMarketplace(query = '') {
    const normalizedQuery = String(query).trim().slice(0, 80)
    const searchPattern = normalizedQuery
      ? new RegExp(escapeRegExp(normalizedQuery), 'i')
      : null

    const activeStores: any[] = await StoreModel.find({ status: 'ACTIVE' })
      .sort({ name: 1 })
      .lean()
    const activeStoreIds = activeStores.map((store) => store._id)

    if (!activeStoreIds.length) {
      return {
        query: normalizedQuery,
        stores: [],
        products: [],
        meta: { storeCount: 0, productCount: 0, inStockCount: 0 },
      }
    }

    const directlyMatchingStores = searchPattern
      ? activeStores.filter((store) =>
          [store.name, store.slug, store.description, store.campusLocation]
            .filter(Boolean)
            .some((value) => searchPattern.test(String(value))),
        )
      : activeStores
    const directlyMatchingStoreIds = directlyMatchingStores.map((store) => store._id)

    const productFilter: Record<string, unknown> = {
      storeId: { $in: activeStoreIds },
      productType: 'NEW',
      status: 'APPROVED',
      published: true,
      deletedAt: null,
    }
    if (searchPattern) {
      productFilter.$or = [
        { title: searchPattern },
        { description: searchPattern },
        { tags: { $in: [searchPattern] } },
        ...(directlyMatchingStoreIds.length
          ? [{ storeId: { $in: directlyMatchingStoreIds } }]
          : []),
      ]
    }

    const products: any[] = await ProductModel.find(productFilter)
      .sort({ isFeatured: -1, completedOrderCount: -1, createdAt: -1 })
      .limit(80)
      .lean()

    const storeById = new Map(activeStores.map((store) => [String(store._id), store]))
    const visibleProducts = products.filter((product) => storeById.has(String(product.storeId)))
    const images = await ProductImageModel.find({
      productId: { $in: visibleProducts.map((product) => product._id) },
      isPrimary: true,
    }).lean()
    const imageByProduct = new Map(images.map((image) => [String(image.productId), image.url]))

    const productsByStore = new Map<string, any[]>()
    for (const product of visibleProducts) {
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
        const prices = matchingProducts.map((product) => Number(product.price)).filter(Number.isFinite)
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

    const productViews = visibleProducts.map((product) =>
      marketplaceProductView(
        product,
        storeById.get(String(product.storeId)),
        imageByProduct.get(String(product._id)) ?? null,
      ),
    )

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

  async adminList() {
    return (await StoreModel.find().sort({ createdAt: -1 }).lean()).map(storeView)
  }

  async create(input: any) {
    const seller = await UserModel.findById(input.sellerId)
    if (!seller) throw new AppError(404, 'SELLER_NOT_FOUND', 'Selected user was not found.')
    const exists = await StoreModel.exists({ sellerId: seller._id })
    if (exists) throw new AppError(409, 'SELLER_HAS_STORE', 'A seller can manage only one store.')

    seller.role = 'SELLER' as any
    seller.canSell = true
    await seller.save()

    const store = await StoreModel.create({ ...input, slug: slugify(input.slug || input.name) })
    return storeView(store.toObject())
  }

  async update(id: string, input: any) {
    const store: any = await StoreModel.findByIdAndUpdate(id, input, {
      new: true,
      runValidators: true,
    }).lean()
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found.')
    return storeView(store)
  }

  async addCategory(sellerId: string, input: any) {
    const store = await this.sellerDocument(sellerId)
    const name = String(input.name ?? '').trim()
    if (name.length < 2) throw new AppError(400, 'CATEGORY_NAME_INVALID', 'Enter a category name.')
    if (store.categories.some((category: any) => category.name.toLowerCase() === name.toLowerCase())) {
      throw new AppError(409, 'CATEGORY_EXISTS', 'This category already exists in your store.')
    }

    store.categories.push({
      name,
      slug: slugify(name),
      description: String(input.description ?? '').trim() || null,
      displayOrder: Number(input.displayOrder ?? store.categories.length),
      isActive: true,
    } as any)
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
    if (typeof input.description === 'string') category.description = input.description.trim() || null
    if (typeof input.isActive === 'boolean') category.isActive = input.isActive
    if (Number.isFinite(Number(input.displayOrder))) category.displayOrder = Number(input.displayOrder)
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
    const activeOrders = orders.filter((order: any) =>
      ['PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING_TO_CAMPUS', 'ARRIVED_AT_CAMPUS', 'READY_FOR_PICKUP'].includes(order.status),
    )
    const grossSales = completedOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0)
    const pendingRevenue = activeOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0)
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
    const images = await ProductImageModel.find({
      productId: { $in: products.map((product) => product._id) },
      isPrimary: true,
    }).lean()
    const imageByProduct = new Map(images.map((image) => [String(image.productId), image.url]))
    return products.map((product: any) =>
      productView(product, imageByProduct.get(String(product._id)) ?? null),
    )
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
    if (description.length < 5) throw new AppError(400, 'PRODUCT_DESCRIPTION_INVALID', 'Add a short description.')
    if (!category) throw new AppError(400, 'STORE_CATEGORY_REQUIRED', 'Select a store category.')
    if (price <= 0) throw new AppError(400, 'PRODUCT_PRICE_INVALID', 'Price must be greater than zero.')
    if (!Number.isInteger(stock) || stock < 0) throw new AppError(400, 'PRODUCT_STOCK_INVALID', 'Stock must be zero or more.')

    const imageUploadId = String(input.imageUploadId ?? '').trim()
    const uploadedImage = imageUploadId
      ? (await this.uploads.assertOwnedTemporary(sellerId, [imageUploadId]))[0]
      : null
    const imageUrl = uploadedImage?.url ?? String(input.imageUrl ?? '').trim()
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

      if (imageUrl) {
        await ProductImageModel.create({
          productId: product._id,
          url: imageUrl,
          altText: title,
          displayOrder: 0,
          isPrimary: true,
        })
      }
      if (uploadedImage) {
        await this.uploads.attachToProduct(sellerId, [uploadedImage.id], String(product._id))
      }
      return productView(product.toObject(), imageUrl || null)
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
    const imageUploadId = String(input.imageUploadId ?? '').trim()
    const uploadedImage = imageUploadId
      ? (await this.uploads.assertOwnedTemporary(sellerId, [imageUploadId]))[0]
      : null
    const product: any = await ProductModel.findOne({
      _id: productId,
      storeId: store._id,
      deletedAt: null,
    })
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.')

    if (typeof input.title === 'string' && input.title.trim()) product.title = input.title.trim()
    if (typeof input.description === 'string' && input.description.trim()) {
      product.description = input.description.trim()
    }
    if (input.price !== undefined) {
      const price = money(input.price)
      if (price <= 0) throw new AppError(400, 'PRODUCT_PRICE_INVALID', 'Price must be greater than zero.')
      product.price = price
    }
    if (input.stock !== undefined) {
      const stock = Number(input.stock)
      if (!Number.isInteger(stock) || stock < 0) throw new AppError(400, 'PRODUCT_STOCK_INVALID', 'Stock must be zero or more.')
      product.stock = stock
      product.status = stock > 0 ? 'APPROVED' : 'OUT_OF_STOCK'
    }
    if (typeof input.published === 'boolean') product.published = input.published
    if (typeof input.storeCategoryId === 'string') {
      const category: any = store.categories.id(input.storeCategoryId)
      if (!category) throw new AppError(400, 'STORE_CATEGORY_REQUIRED', 'Select a valid category.')
      product.storeCategoryId = category._id
      product.categoryId = category._id
    }
    await product.save()

    let imageUrl: string | null = null
    if (uploadedImage || typeof input.imageUrl === 'string') {
      imageUrl = uploadedImage?.url ?? (input.imageUrl.trim() || null)
      if (uploadedImage) {
        await this.uploads.attachToProduct(sellerId, [uploadedImage.id], String(product._id))
      }
      await ProductImageModel.deleteMany({ productId: product._id, isPrimary: true })
      if (imageUrl) {
        await ProductImageModel.create({
          productId: product._id,
          url: imageUrl,
          altText: product.title,
          displayOrder: 0,
          isPrimary: true,
        })
      }
    } else {
      imageUrl = (await ProductImageModel.findOne({ productId: product._id, isPrimary: true }).lean())?.url ?? null
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
    const items = await OrderItemModel.find({ orderId: { $in: orders.map((order) => order._id) } }).lean()
    const itemsByOrder = new Map<string, any[]>()
    for (const item of items) {
      const key = String(item.orderId)
      itemsByOrder.set(key, [...(itemsByOrder.get(key) ?? []), item])
    }
    return orders.map((order: any) => orderView(order, itemsByOrder.get(String(order._id)) ?? []))
  }

  async updateOrderStatus(sellerId: string, orderId: string, nextStatus: string, note = '') {
    const store = await this.sellerDocument(sellerId)
    const order: any = await OrderModel.findOne({ _id: orderId, storeId: store._id })
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.')

    const allowed = sellerStatusTransitions[String(order.status)] ?? []
    if (!allowed.includes(nextStatus)) {
      throw new AppError(409, 'ORDER_STATUS_INVALID', 'This order cannot move to the selected status.')
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

  async applyOffer(sellerId: string, input: any) {
    const store = await this.sellerDocument(sellerId)
    const discountPercent = Number(input.discountPercent)
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 90) {
      throw new AppError(400, 'OFFER_PERCENT_INVALID', 'Discount must be between 0% and 90%.')
    }

    const filter: Record<string, unknown> = { storeId: store._id, deletedAt: null }
    if (input.scope === 'PRODUCT') {
      filter._id = String(input.targetId ?? '')
    } else if (input.scope === 'CATEGORY') {
      const category: any = store.categories.id(String(input.targetId ?? ''))
      if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.')
      filter.storeCategoryId = category._id
    } else {
      throw new AppError(400, 'OFFER_SCOPE_INVALID', 'Choose a product or category offer.')
    }

    const products: any[] = await ProductModel.find(filter)
    if (!products.length) throw new AppError(404, 'OFFER_TARGET_EMPTY', 'No products matched this offer.')

    for (const product of products) {
      if (discountPercent === 0) {
        if (product.originalPrice) product.price = product.originalPrice
        product.originalPrice = null
      } else {
        const basePrice = product.originalPrice || product.price
        product.originalPrice = basePrice
        product.price = money(basePrice * (1 - discountPercent / 100))
      }
      await product.save()
    }

    return { updatedCount: products.length, discountPercent }
  }
}

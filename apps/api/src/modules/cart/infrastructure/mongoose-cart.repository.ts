import type { Cart, CartIssue, ProductImage, ProductSummary } from '@campusbaza/contracts'
import { Types } from 'mongoose'
import { CategoryModel } from '../../categories/infrastructure/category.model.js'
import { ProductImageModel, ProductModel } from '../../products/infrastructure/product.models.js'
import { UserModel } from '../../users/infrastructure/user.models.js'
import type {
  CartMapper,
  CartRecord,
  CartRepository,
  CheckoutCatalogRepository,
  CheckoutProduct,
} from '../domain/cart.js'
import { CartModel } from './cart.model.js'

function mapRecord(document: Record<string, unknown>): CartRecord {
  const items = Array.isArray(document.items) ? document.items : []
  return {
    id: String(document._id),
    userId: String(document.userId),
    items: items.map((item) => {
      const value = item as Record<string, unknown>
      return {
        productId: String(value.productId),
        quantity: Number(value.quantity),
        priceAtAddition: Number(value.priceAtAddition),
      }
    }),
    updatedAt: document.updatedAt as Date,
  }
}

export class MongooseCartRepository implements CartRepository {
  async findOrCreate(userId: string): Promise<CartRecord> {
    const document = await CartModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, items: [] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!document) throw new Error('Unable to load cart')
    return mapRecord(document)
  }

  async setItem(
    userId: string,
    productId: string,
    quantity: number,
    priceAtAddition: number,
  ): Promise<CartRecord> {
    const updated = await CartModel.findOneAndUpdate(
      { userId, 'items.productId': productId },
      { $set: { 'items.$.quantity': quantity, 'items.$.priceAtAddition': priceAtAddition } },
      { new: true },
    ).lean<Record<string, unknown>>()
    if (updated) return mapRecord(updated)
    const inserted = await CartModel.findOneAndUpdate(
      { userId },
      { $push: { items: { productId, quantity, priceAtAddition } } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!inserted) throw new Error('Unable to update cart')
    return mapRecord(inserted)
  }

  async removeItem(userId: string, productId: string): Promise<CartRecord> {
    const document = await CartModel.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId } } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!document) throw new Error('Unable to update cart')
    return mapRecord(document)
  }

  async clear(userId: string): Promise<CartRecord> {
    const document = await CartModel.findOneAndUpdate(
      { userId },
      { $set: { items: [] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!document) throw new Error('Unable to clear cart')
    return mapRecord(document)
  }
}

export class MongooseCheckoutCatalogRepository implements CheckoutCatalogRepository {
  async findProducts(productIds: string[]): Promise<CheckoutProduct[]> {
    const validIds = productIds.filter((id) => Types.ObjectId.isValid(id))
    if (!validIds.length) return []
    const products = await ProductModel.find({ _id: { $in: validIds }, deletedAt: null }).lean<
      Record<string, unknown>[]
    >()
    const categoryIds = [...new Set(products.map((product) => String(product.categoryId)))]
    const sellerIds = [...new Set(products.map((product) => String(product.sellerId)))]
    const [categories, sellers, images] = await Promise.all([
      CategoryModel.find({ _id: { $in: categoryIds }, deletedAt: null }).lean<
        Record<string, unknown>[]
      >(),
      UserModel.find({ _id: { $in: sellerIds } }).lean<Record<string, unknown>[]>(),
      ProductImageModel.find({ productId: { $in: validIds } })
        .sort({ displayOrder: 1 })
        .lean<Record<string, unknown>[]>(),
    ])
    const categoryById = new Map(categories.map((category) => [String(category._id), category]))
    const sellerById = new Map(sellers.map((seller) => [String(seller._id), seller]))
    const imagesByProduct = new Map<string, ProductImage[]>()
    for (const image of images) {
      const id = String(image.productId)
      const current = imagesByProduct.get(id) ?? []
      current.push({
        id: String(image._id),
        url: String(image.url),
        altText: typeof image.altText === 'string' ? image.altText : '',
        displayOrder: Number(image.displayOrder),
        isPrimary: Boolean(image.isPrimary),
      })
      imagesByProduct.set(id, current)
    }
    const mapped = products.flatMap((product): CheckoutProduct[] => {
      const category = categoryById.get(String(product.categoryId))
      const seller = sellerById.get(String(product.sellerId))
      if (!category || !seller) return []
      const productImages = imagesByProduct.get(String(product._id)) ?? []
      const summary: ProductSummary = {
        id: String(product._id),
        slug: String(product.slug),
        title: String(product.title),
        category: {
          id: String(category._id),
          name: String(category.name),
          slug: String(category.slug),
        },
        price: Number(product.price),
        originalPrice: (product.originalPrice as number | null) ?? null,
        stock: Number(product.stock),
        condition: product.condition as ProductSummary['condition'],
        productType: product.productType as ProductSummary['productType'],
        sellerType: product.sellerType as ProductSummary['sellerType'],
        status: product.status as ProductSummary['status'],
        published: Boolean(product.published),
        isFeatured: Boolean(product.isFeatured),
        pickupLocation: (product.pickupLocation as string | null) ?? null,
        primaryImage: productImages.find((image) => image.isPrimary) ?? productImages[0] ?? null,
        viewCount: Number(product.viewCount),
        completedOrderCount: Number(product.completedOrderCount),
        createdAt: (product.createdAt as Date).toISOString(),
      }
      return [
        {
          summary,
          sellerId: String(product.sellerId),
          categoryActive: Boolean(category.isActive),
          sellerActive: seller.status === 'ACTIVE',
        },
      ]
    })
    const byId = new Map(mapped.map((product) => [product.summary.id, product]))
    return productIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  }
}

export class DefaultCartMapper implements CartMapper {
  map(record: CartRecord, products: CheckoutProduct[], currentUserId: string): Cart {
    const productById = new Map(products.map((value) => [value.summary.id, value]))
    const issues: CartIssue[] = []
    const items = record.items.flatMap((recordItem) => {
      const value = productById.get(recordItem.productId)
      if (!value) {
        issues.push({
          productId: recordItem.productId,
          code: 'PRODUCT_UNAVAILABLE',
          message: 'A product in your cart is no longer available.',
        })
        return []
      }
      const product = value.summary
      if (
        product.status !== 'APPROVED' ||
        !product.published ||
        !value.categoryActive ||
        !value.sellerActive ||
        product.stock < 1
      ) {
        issues.push({
          productId: product.id,
          code: 'PRODUCT_UNAVAILABLE',
          message: `${product.title} is no longer available.`,
        })
        return []
      }
      if (product.sellerType === 'USER' && value.sellerId === currentUserId) {
        issues.push({
          productId: product.id,
          code: 'OWN_PRODUCT',
          message: `${product.title} is your own listing and cannot be purchased.`,
        })
        return []
      }
      const quantity = Math.min(recordItem.quantity, product.stock)
      if (recordItem.quantity > product.stock) {
        issues.push({
          productId: product.id,
          code: 'INSUFFICIENT_STOCK',
          message: `${product.title} now has only ${product.stock} available.`,
        })
      }
      if (recordItem.priceAtAddition !== product.price) {
        issues.push({
          productId: product.id,
          code: 'PRICE_CHANGED',
          message: `The price of ${product.title} has changed.`,
        })
      }
      return [{ product, quantity, lineTotal: product.price * quantity }]
    })
    return {
      id: record.id,
      userId: record.userId,
      items,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
      issues,
      updatedAt: record.updatedAt.toISOString(),
    }
  }
}

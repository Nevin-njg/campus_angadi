import type { AddCartItemInput, Cart, UpdateCartItemInput } from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type {
  CartMapper,
  CartRepository,
  CheckoutCatalogRepository,
  CheckoutProduct,
} from '../domain/cart.js'

export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly catalog: CheckoutCatalogRepository,
    private readonly mapper: CartMapper,
  ) {}

  async get(userId: string): Promise<Cart> {
    const record = await this.carts.findOrCreate(userId)
    const products = await this.catalog.findProducts(record.items.map((item) => item.productId))
    return this.mapper.map(record, products, userId)
  }

  async add(userId: string, input: AddCartItemInput): Promise<Cart> {
    const product = await this.requirePurchasable(input.productId, userId)
    const existing = await this.carts.findOrCreate(userId)
    const currentQuantity =
      existing.items.find((item) => item.productId === input.productId)?.quantity ?? 0
    const quantity = currentQuantity + input.quantity
    if (quantity > product.summary.stock) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Only ${product.summary.stock} unit${product.summary.stock === 1 ? '' : 's'} are available.`,
      )
    }
    await this.carts.setItem(userId, input.productId, quantity, product.summary.price)
    return this.get(userId)
  }

  async update(userId: string, productId: string, input: UpdateCartItemInput): Promise<Cart> {
    const existing = await this.carts.findOrCreate(userId)
    if (!existing.items.some((item) => item.productId === productId)) {
      throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'This product is not in your cart.')
    }
    const product = await this.requirePurchasable(productId, userId)
    if (input.quantity > product.summary.stock) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Only ${product.summary.stock} unit${product.summary.stock === 1 ? '' : 's'} are available.`,
      )
    }
    await this.carts.setItem(userId, productId, input.quantity, product.summary.price)
    return this.get(userId)
  }

  async remove(userId: string, productId: string): Promise<Cart> {
    await this.carts.removeItem(userId, productId)
    return this.get(userId)
  }

  async clear(userId: string): Promise<Cart> {
    await this.carts.clear(userId)
    return this.get(userId)
  }

  async review(userId: string): Promise<Cart> {
    const record = await this.carts.findOrCreate(userId)
    const products = await this.catalog.findProducts(record.items.map((item) => item.productId))
    const byId = new Map(products.map((product) => [product.summary.id, product]))
    for (const item of record.items) {
      const product = byId.get(item.productId)
      if (
        !product ||
        product.summary.status !== 'APPROVED' ||
        !product.summary.published ||
        product.summary.stock < 1 ||
        !product.categoryActive ||
        !product.sellerActive ||
        (product.summary.sellerType === 'USER' && product.sellerId === userId)
      ) {
        await this.carts.removeItem(userId, item.productId)
        continue
      }
      await this.carts.setItem(
        userId,
        item.productId,
        Math.min(item.quantity, product.summary.stock),
        product.summary.price,
      )
    }
    return this.get(userId)
  }

  private async requirePurchasable(productId: string, userId: string): Promise<CheckoutProduct> {
    const product = (await this.catalog.findProducts([productId]))[0]
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'This product could not be found.')
    }
    if (
      product.summary.status !== 'APPROVED' ||
      !product.summary.published ||
      product.summary.stock < 1 ||
      !product.categoryActive ||
      !product.sellerActive
    ) {
      throw new AppError(409, 'PRODUCT_NOT_AVAILABLE', 'This product is not currently available.')
    }
    if (product.summary.sellerType === 'USER' && product.sellerId === userId) {
      throw new AppError(
        409,
        'OWN_PRODUCT_NOT_PURCHASABLE',
        'You cannot purchase your own listing.',
      )
    }
    return product
  }
}

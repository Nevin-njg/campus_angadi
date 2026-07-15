import type { Cart, ProductSummary } from '@campusbaza/contracts'
import { describe, expect, it } from 'vitest'
import type {
  CartMapper,
  CartRecord,
  CartRepository,
  CheckoutCatalogRepository,
  CheckoutProduct,
} from '../domain/cart.js'
import { CartService } from './cart.service.js'

function summary(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id: 'product-1',
    slug: 'product-1',
    title: 'Product one',
    category: { id: 'category-1', name: 'Electronics', slug: 'electronics' },
    price: 500,
    originalPrice: null,
    stock: 3,
    condition: 'GOOD',
    productType: 'SECOND_HAND',
    sellerType: 'USER',
    status: 'APPROVED',
    published: true,
    isFeatured: false,
    pickupLocation: 'Main block',
    primaryImage: null,
    viewCount: 0,
    completedOrderCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

class MemoryCart implements CartRepository {
  record: CartRecord = { id: 'cart-1', userId: 'buyer-1', items: [], updatedAt: new Date() }
  async findOrCreate() {
    return this.record
  }
  async setItem(_userId: string, productId: string, quantity: number, priceAtAddition: number) {
    this.record.items = [
      ...this.record.items.filter((item) => item.productId !== productId),
      { productId, quantity, priceAtAddition },
    ]
    return this.record
  }
  async removeItem(_userId: string, productId: string) {
    this.record.items = this.record.items.filter((item) => item.productId !== productId)
    return this.record
  }
  async clear() {
    this.record.items = []
    return this.record
  }
}

class Catalog implements CheckoutCatalogRepository {
  constructor(readonly product: CheckoutProduct) {}
  async findProducts(ids: string[]) {
    return ids.includes(this.product.summary.id) ? [this.product] : []
  }
}

const mapper: CartMapper = {
  map(record, products): Cart {
    return {
      id: record.id,
      userId: record.userId,
      items: record.items.map((item) => {
        const product = products.find((value) => value.summary.id === item.productId)!.summary
        return { product, quantity: item.quantity, lineTotal: product.price * item.quantity }
      }),
      totalItems: record.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: record.items.reduce((sum, item) => sum + item.quantity * item.priceAtAddition, 0),
      issues: [],
      updatedAt: record.updatedAt.toISOString(),
    }
  },
}

describe('CartService', () => {
  it('adds quantities to an existing cart line without trusting the client price', async () => {
    const carts = new MemoryCart()
    const service = new CartService(
      carts,
      new Catalog({
        summary: summary(),
        sellerId: 'seller-1',
        categoryActive: true,
        sellerActive: true,
      }),
      mapper,
    )
    await service.add('buyer-1', { productId: 'product-1', quantity: 1 })
    const result = await service.add('buyer-1', { productId: 'product-1', quantity: 2 })
    expect(result.totalItems).toBe(3)
    expect(result.subtotal).toBe(1500)
    expect(carts.record.items[0]?.priceAtAddition).toBe(500)
  })

  it('rejects attempts to add the buyers own listing', async () => {
    const service = new CartService(
      new MemoryCart(),
      new Catalog({
        summary: summary(),
        sellerId: 'buyer-1',
        categoryActive: true,
        sellerActive: true,
      }),
      mapper,
    )
    await expect(
      service.add('buyer-1', { productId: 'product-1', quantity: 1 }),
    ).rejects.toMatchObject({
      code: 'OWN_PRODUCT_NOT_PURCHASABLE',
    })
  })

  it('rejects quantities above current stock', async () => {
    const service = new CartService(
      new MemoryCart(),
      new Catalog({
        summary: summary({ stock: 1 }),
        sellerId: 'seller-1',
        categoryActive: true,
        sellerActive: true,
      }),
      mapper,
    )
    await expect(
      service.add('buyer-1', { productId: 'product-1', quantity: 2 }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    })
  })
})

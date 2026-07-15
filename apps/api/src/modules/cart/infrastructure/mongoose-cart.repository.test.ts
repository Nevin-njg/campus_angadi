import type { ProductSummary } from '@campusbaza/contracts'
import { describe, expect, it } from 'vitest'
import type { CartRecord, CheckoutProduct } from '../domain/cart.js'
import { DefaultCartMapper } from './mongoose-cart.repository.js'

function checkoutProduct(overrides: Partial<ProductSummary> = {}): CheckoutProduct {
  return {
    sellerId: 'seller-1',
    categoryActive: true,
    sellerActive: true,
    summary: {
      id: 'product-1',
      slug: 'product-1',
      title: 'Campus product',
      category: { id: 'category-1', name: 'Books', slug: 'books' },
      price: 250,
      originalPrice: null,
      stock: 2,
      condition: 'GOOD',
      productType: 'SECOND_HAND',
      sellerType: 'USER',
      status: 'APPROVED',
      published: true,
      isFeatured: false,
      pickupLocation: null,
      primaryImage: null,
      viewCount: 0,
      completedOrderCount: 0,
      createdAt: new Date().toISOString(),
      ...overrides,
    },
  }
}

const record: CartRecord = {
  id: 'cart-1',
  userId: 'buyer-1',
  items: [{ productId: 'product-1', quantity: 3, priceAtAddition: 200 }],
  updatedAt: new Date(),
}

describe('DefaultCartMapper', () => {
  it('uses current backend price, clamps visible quantity and reports both changes', () => {
    const cart = new DefaultCartMapper().map(record, [checkoutProduct()], 'buyer-1')
    expect(cart.items[0]).toMatchObject({ quantity: 2, lineTotal: 500 })
    expect(cart.issues.map((issue) => issue.code)).toEqual(['INSUFFICIENT_STOCK', 'PRICE_CHANGED'])
  })

  it('removes ineligible products from totals and reports availability', () => {
    const cart = new DefaultCartMapper().map(
      record,
      [checkoutProduct({ status: 'HIDDEN', published: false })],
      'buyer-1',
    )
    expect(cart.items).toHaveLength(0)
    expect(cart.subtotal).toBe(0)
    expect(cart.issues[0]?.code).toBe('PRODUCT_UNAVAILABLE')
  })
})

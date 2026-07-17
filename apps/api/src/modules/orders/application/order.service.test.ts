import type {
  CheckoutInput,
  CheckoutResult,
  OrderDetail,
  OrderStatus,
  PaginatedResult,
  ProductSummary,
} from '@campusbaza/contracts'
import { describe, expect, it } from 'vitest'
import type {
  CartRecord,
  CartRepository,
  CheckoutCatalogRepository,
  CheckoutProduct,
} from '../../cart/domain/cart.js'
import type { CheckoutPlanGroup, OrderRepository } from '../domain/order.js'
import { OrderService } from './order.service.js'

function product(id: string, sellerId: string, sellerType: 'ADMIN' | 'USER'): CheckoutProduct {
  const summary: ProductSummary = {
    id,
    slug: id,
    title: id,
    category: { id: 'category', name: 'Category', slug: 'category' },
    price: 100,
    originalPrice: null,
    stock: 5,
    condition: sellerType === 'ADMIN' ? 'NEW' : 'GOOD',
    productType: sellerType === 'ADMIN' ? 'NEW' : 'SECOND_HAND',
    sellerType,
    status: 'APPROVED',
    published: true,
    isFeatured: false,
    pickupLocation: null,
    primaryImage: null,
    viewCount: 0,
    completedOrderCount: 0,
    createdAt: new Date().toISOString(),
  }
  return { summary, sellerId, categoryActive: true, sellerActive: true }
}

class CartFake implements CartRepository {
  constructor(readonly record: CartRecord) {}
  async findOrCreate() {
    return this.record
  }
  async setItem() {
    return this.record
  }
  async removeItem() {
    return this.record
  }
  async clear() {
    return this.record
  }
}

class CatalogFake implements CheckoutCatalogRepository {
  constructor(readonly products: CheckoutProduct[]) {}
  async findProducts(ids: string[]) {
    return this.products.filter((item) => ids.includes(item.summary.id))
  }
}

function order(status: OrderStatus = 'PENDING'): OrderDetail {
  return {
    id: 'order-1',
    checkoutGroupId: 'group',
    orderNumber: 'CBZ-1',
    buyerId: 'buyer',
    sellerType: 'ADMIN',
    sellerId: null,
    status,
    subtotal: 100,
    totalAmount: 100,
    itemCount: 1,
    productPreview: [],
    pickupLocation: 'Main block',
    assignedDealerId: null,
    assignedDealer: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fullName: 'Buyer',
    phoneNumber: '9999999999',
    campusId: null,
    department: null,
    building: null,
    preferredPickupTime: null,
    notes: null,
    internalNotes: null,
    items: [],
    statusHistory: [],
    dealerAssignmentHistory: [],
    cancelledAt: null,
    completedAt: null,
  }
}

class OrderFake implements OrderRepository {
  groups: CheckoutPlanGroup[] = []
  current = order()
  async createCheckout(
    _buyerId: string,
    _input: CheckoutInput,
    checkoutGroupId: string,
    groups: CheckoutPlanGroup[],
  ): Promise<CheckoutResult> {
    this.groups = groups
    return { checkoutGroupId, orders: [this.current] }
  }
  async listOwned(): Promise<PaginatedResult<OrderDetail>> {
    return { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }
  }
  async findOwnedById() {
    return this.current
  }
  async listAdmin(): Promise<PaginatedResult<OrderDetail>> {
    return { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }
  }
  async findAdminById() {
    return this.current
  }
  async assignDealer() {
    return this.current
  }
  async transition(_id: string, expected: OrderStatus, status: OrderStatus) {
    if (this.current.status !== expected) return null
    this.current = { ...this.current, status }
    return this.current
  }
}

const checkoutInput: CheckoutInput = {
  fullName: 'Buyer Name',
  phoneNumber: '9999999999',
  pickupLocation: 'Main block',
  campusId: null,
  department: null,
  building: null,
  preferredPickupTime: null,
  notes: null,
}

describe('OrderService', () => {
  it('splits official products together and user products by seller', async () => {
    const products = [
      product('official-1', 'admin-a', 'ADMIN'),
      product('official-2', 'admin-b', 'ADMIN'),
      product('user-a', 'seller-a', 'USER'),
      product('user-b', 'seller-b', 'USER'),
    ]
    const cart = new CartFake({
      id: 'cart',
      userId: 'buyer',
      updatedAt: new Date(),
      items: products.map((item) => ({
        productId: item.summary.id,
        quantity: 1,
        priceAtAddition: 100,
      })),
    })
    const orders = new OrderFake()
    await new OrderService(orders, cart, new CatalogFake(products)).checkout('buyer', checkoutInput)
    expect(orders.groups).toHaveLength(3)
    expect(orders.groups.find((group) => group.sellerType === 'ADMIN')?.items).toHaveLength(2)
  })

  it('rejects checkout when a product has become unavailable', async () => {
    const unavailable = product('product', 'seller', 'USER')
    unavailable.summary.stock = 0
    const cart = new CartFake({
      id: 'cart',
      userId: 'buyer',
      updatedAt: new Date(),
      items: [{ productId: 'product', quantity: 1, priceAtAddition: 100 }],
    })
    await expect(
      new OrderService(new OrderFake(), cart, new CatalogFake([unavailable])).checkout(
        'buyer',
        checkoutInput,
      ),
    ).rejects.toMatchObject({ code: 'CART_REQUIRES_REVIEW' })
  })

  it('allows buyers to cancel only early-stage orders', async () => {
    const orders = new OrderFake()
    const service = new OrderService(
      orders,
      new CartFake({ id: 'cart', userId: 'buyer', items: [], updatedAt: new Date() }),
      new CatalogFake([]),
    )
    expect((await service.cancelOwned('order-1', 'buyer', { reason: 'Changed mind' })).status).toBe(
      'CANCELLED',
    )
    orders.current = order('PREPARING')
    await expect(service.cancelOwned('order-1', 'buyer', { reason: null })).rejects.toMatchObject({
      code: 'ORDER_CANNOT_BE_CANCELLED',
    })
  })

  it('enforces the admin order transition state machine', async () => {
    const orders = new OrderFake()
    const service = new OrderService(
      orders,
      new CartFake({ id: 'cart', userId: 'buyer', items: [], updatedAt: new Date() }),
      new CatalogFake([]),
    )
    expect(
      (await service.updateStatus('order-1', 'admin', { status: 'CONFIRMED', note: null })).status,
    ).toBe('CONFIRMED')
    await expect(
      service.updateStatus('order-1', 'admin', { status: 'COMPLETED', note: null }),
    ).rejects.toMatchObject({ code: 'INVALID_ORDER_TRANSITION' })
  })
})

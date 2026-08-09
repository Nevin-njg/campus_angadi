import { randomUUID } from 'node:crypto'
import type {
  AdminOrderListQuery,
  AssignOrderDealerInput,
  AssignOrderModeratorInput,
  BuyNowInput,
  CancelOrderInput,
  CheckoutInput,
  CheckoutResult,
  OrderDetail,
  OrderListQuery,
  OrderStatus,
  PaginatedResult,
  UpdateOrderStatusInput,
  UserRole,
} from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type { CartRepository, CheckoutCatalogRepository } from '../../cart/domain/cart.js'
import type { CheckoutPlanGroup, OrderRepository } from '../domain/order.js'
import type { NotificationRepository } from '../../notifications/domain/notification.js'

const ADMIN_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  WAITING_FOR_DEALER_ASSIGNMENT: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  AWAITING_TEAM_CONFIRMATION: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONTACTED: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  PREPARING: ['COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
}

const USER_CANCELLABLE: readonly OrderStatus[] = [
  'PENDING',
  'WAITING_FOR_DEALER_ASSIGNMENT',
  'AWAITING_TEAM_CONFIRMATION',
  'CONTACTED',
]

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly carts: CartRepository,
    private readonly catalog: CheckoutCatalogRepository,
    private readonly appName = 'Campus Angadi',
    private readonly notifications: NotificationRepository | null = null,
  ) {}

  async checkout(buyerId: string, input: CheckoutInput): Promise<CheckoutResult> {
    const cart = await this.carts.findOrCreate(buyerId)
    if (!cart.items.length) throw new AppError(409, 'CART_EMPTY', 'Your cart is empty.')
    return this.createCheckout(buyerId, input, cart.items, cart.id)
  }

  async buyNow(buyerId: string, input: BuyNowInput): Promise<CheckoutResult> {
    const { productId, quantity, ...checkoutInput } = input
    return this.createCheckout(buyerId, checkoutInput, [{ productId, quantity }], null)
  }

  private async createCheckout(
    buyerId: string,
    input: CheckoutInput,
    selectedItems: Array<{ productId: string; quantity: number }>,
    cartIdToClear: string | null,
  ): Promise<CheckoutResult> {
    const products = await this.catalog.findProducts(selectedItems.map((item) => item.productId))
    const productById = new Map(products.map((product) => [product.summary.id, product]))
    const groups = new Map<string, CheckoutPlanGroup>()

    for (const selectedItem of selectedItems) {
      const product = productById.get(selectedItem.productId)
      if (!product) {
        throw new AppError(409, 'PRODUCT_NOT_AVAILABLE', 'The selected product is unavailable.')
      }
      if (
        product.summary.status !== 'APPROVED' ||
        !product.summary.published ||
        !product.categoryActive ||
        !product.sellerActive ||
        product.summary.stock < selectedItem.quantity
      ) {
        throw new AppError(
          409,
          'CART_REQUIRES_REVIEW',
          `${product.summary.title} is unavailable or does not have enough stock.`,
        )
      }
      if (product.summary.sellerType === 'USER' && product.sellerId === buyerId) {
        throw new AppError(
          409,
          'OWN_PRODUCT_NOT_PURCHASABLE',
          'You cannot purchase your own listing.',
        )
      }
      const groupKey = product.storeId
        ? `STORE:${product.storeId}`
        : product.summary.sellerType === 'ADMIN'
          ? 'ADMIN'
          : product.sellerId
      const group: CheckoutPlanGroup = groups.get(groupKey) ?? {
        sellerType: product.summary.sellerType,
        sellerId: product.storeId
          ? product.sellerId
          : product.summary.sellerType === 'ADMIN'
            ? null
            : product.sellerId,
        storeId: product.storeId ?? null,
        items: [],
      }
      group.items.push({ product, quantity: selectedItem.quantity })
      groups.set(groupKey, group)
    }

    for (const group of groups.values()) {
      if (!group.storeId) continue
      const minimum = Math.max(
        ...group.items.map((item) => item.product.storeMinimumOrderAmount ?? 0),
      )
      const subtotal = group.items.reduce(
        (total, item) => total + item.product.summary.price * item.quantity,
        0,
      )
      if (minimum > 0 && subtotal < minimum) {
        const storeName = group.items[0]?.product.storeName ?? 'This store'
        throw new AppError(
          409,
          'STORE_MINIMUM_NOT_MET',
          `${storeName} requires a minimum order of ₹${minimum.toLocaleString('en-IN')}. Add ₹${(minimum - subtotal).toLocaleString('en-IN')} more from this store.`,
        )
      }
    }

    const result = await this.orders.createCheckout(
      buyerId,
      input,
      randomUUID(),
      [...groups.values()],
      cartIdToClear,
    )
    const assignedContacts = result.orders
      .flatMap((order) => (order.assignedDealer ? [order.assignedDealer] : []))
      .filter(
        (contact, index, contacts) =>
          contacts.findIndex((candidate) => candidate.id === contact.id) === index,
      )
    const contactMessage = assignedContacts.length
      ? ` Your order contact${assignedContacts.length === 1 ? ' is' : 's are'} ${assignedContacts
          .map((contact) => `${contact.displayName} (${contact.phoneNumber})`)
          .join(', ')}.`
      : ' An administrator will assign an order contact shortly.'
    await this.notifications?.sendToUser(buyerId, {
      type: 'ORDER',
      title: 'Order created',
      message: `${result.orders.length} order${result.orders.length === 1 ? '' : 's'} created successfully.${contactMessage}`,
      referenceType: 'CHECKOUT',
      referenceId: result.checkoutGroupId,
    })
    return result
  }

  listOwned(buyerId: string, query: OrderListQuery): Promise<PaginatedResult<OrderDetail>> {
    return this.orders.listOwned(buyerId, query)
  }

  async getOwned(orderId: string, buyerId: string): Promise<OrderDetail> {
    const order = await this.orders.findOwnedById(orderId, buyerId)
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'This order could not be found.')
    return order
  }

  async cancelOwned(
    orderId: string,
    buyerId: string,
    input: CancelOrderInput,
  ): Promise<OrderDetail> {
    const order = await this.getOwned(orderId, buyerId)
    if (!USER_CANCELLABLE.includes(order.status)) {
      throw new AppError(
        409,
        'ORDER_CANNOT_BE_CANCELLED',
        'This order can no longer be cancelled online.',
      )
    }
    const updated = await this.orders.transition(
      orderId,
      order.status,
      'CANCELLED',
      buyerId,
      input.reason ?? 'Cancelled by buyer',
    )
    if (!updated)
      throw new AppError(
        409,
        'ORDER_STATUS_CHANGED',
        'The order status changed. Refresh and try again.',
      )
    return updated
  }

  listAdmin(
    query: AdminOrderListQuery,
    actor?: { id: string; role: UserRole },
  ): Promise<PaginatedResult<OrderDetail>> {
    return this.orders.listAdmin(query, actor?.role === 'MODERATOR' ? actor.id : undefined)
  }

  async getAdmin(orderId: string, actor?: { id: string; role: UserRole }): Promise<OrderDetail> {
    const order = await this.orders.findAdminById(
      orderId,
      actor?.role === 'MODERATOR' ? actor.id : undefined,
    )
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'This order could not be found.')
    return order
  }

  async assignDealer(orderId: string, actorId: string, input: AssignOrderDealerInput) {
    const order = await this.orders.assignDealer(orderId, actorId, input)
    await this.notifications?.sendToUser(order.buyerId, {
      type: 'ORDER',
      title: 'Order contact assigned',
      message: `${order.assignedDealer?.displayName ?? 'A Campus Angadi contact'} is ready to coordinate order ${order.orderNumber}.`,
      referenceType: 'ORDER',
      referenceId: order.id,
    })
    return order
  }

  async assignModerator(orderId: string, actorId: string, input: AssignOrderModeratorInput) {
    const order = await this.orders.assignModerator(orderId, actorId, input)
    await this.notifications?.sendToUser(input.moderatorId, {
      type: 'ORDER',
      title: 'Conversation assigned',
      message: `You are assigned to assist with order ${order.orderNumber}.`,
      referenceType: 'ORDER',
      referenceId: order.id,
    })
    return order
  }

  async updateStatus(
    orderId: string,
    actorId: string,
    input: UpdateOrderStatusInput,
  ): Promise<OrderDetail> {
    const order = await this.getAdmin(orderId)
    if (order.status === input.status) return order
    if (!ADMIN_TRANSITIONS[order.status].includes(input.status)) {
      throw new AppError(
        409,
        'INVALID_ORDER_TRANSITION',
        `An order cannot move from ${order.status} to ${input.status}.`,
      )
    }
    const updated = await this.orders.transition(
      orderId,
      order.status,
      input.status,
      actorId,
      input.note ?? null,
    )
    if (!updated)
      throw new AppError(
        409,
        'ORDER_STATUS_CHANGED',
        'The order status changed. Refresh and try again.',
      )
    await this.notifications?.sendToUser(updated.buyerId, {
      type: 'ORDER',
      title: `Order ${input.status.toLowerCase().replaceAll('_', ' ')}`,
      message: `Order ${updated.orderNumber} is now ${input.status.toLowerCase().replaceAll('_', ' ')}.`,
      referenceType: 'ORDER',
      referenceId: updated.id,
    })
    return updated
  }
}

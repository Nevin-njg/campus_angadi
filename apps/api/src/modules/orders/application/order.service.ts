import { randomUUID } from 'node:crypto'
import type {
  AdminOrderDetail,
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
import type { PushService } from '../../push/application/push.service.js'

const ADMIN_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  WAITING_FOR_DEALER_ASSIGNMENT: ['CANCELLED', 'REJECTED'],
  AWAITING_TEAM_CONFIRMATION: ['CONTACTED', 'CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONTACTED: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
}

const MODERATOR_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: [],
  WAITING_FOR_DEALER_ASSIGNMENT: [],
  AWAITING_TEAM_CONFIRMATION: ['COMPLETED', 'CANCELLED'],
  CONTACTED: ['COMPLETED', 'CANCELLED'],
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
]

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly carts: CartRepository,
    private readonly catalog: CheckoutCatalogRepository,
    private readonly appName = 'Campus Angadi',
    private readonly notifications: NotificationRepository | null = null,
    private readonly push: PushService | null = null,
  ) {}

  async checkout(buyerId: string, input: CheckoutInput): Promise<CheckoutResult> {
    const cart = await this.carts.findOrCreate(buyerId)

    if (!cart.items.length) {
      throw new AppError(409, 'CART_EMPTY', 'Your cart is empty.')
    }

    return this.createCheckout(buyerId, input, cart.items, cart.id)
  }

  async buyNow(buyerId: string, input: BuyNowInput): Promise<CheckoutResult> {
    const { productId, quantity, ...checkoutInput } = input

    return this.createCheckout(
      buyerId,
      checkoutInput,
      [{ productId, quantity }],
      null,
    )
  }

  private async createCheckout(
    buyerId: string,
    input: CheckoutInput,
    selectedItems: Array<{ productId: string; quantity: number }>,
    cartIdToClear: string | null,
  ): Promise<CheckoutResult> {
    const products = await this.catalog.findProducts(
      selectedItems.map((item) => item.productId),
    )

    const productById = new Map(
      products.map((product) => [product.summary.id, product]),
    )

    const groups = new Map<string, CheckoutPlanGroup>()

    for (const selectedItem of selectedItems) {
      const product = productById.get(selectedItem.productId)

      if (!product) {
        throw new AppError(
          409,
          'PRODUCT_NOT_AVAILABLE',
          'The selected product is unavailable.',
        )
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

      if (
        product.summary.sellerType === 'USER' &&
        product.sellerId === buyerId
      ) {
        throw new AppError(
          409,
          'OWN_PRODUCT_NOT_PURCHASABLE',
          'You cannot purchase your own listing.',
        )
      }

      const storeId = product.storeId ?? null

      const groupKey =
        product.summary.sellerType === 'ADMIN'
          ? `ADMIN:${storeId ?? 'PLATFORM'}`
          : `USER:${product.sellerId}`

      const group = groups.get(groupKey) ?? {
        sellerType: product.summary.sellerType,
        sellerId:
          product.summary.sellerType === 'ADMIN'
            ? null
            : product.sellerId,
        storeId,
        items: [],
      }

      group.items.push({
        product,
        quantity: selectedItem.quantity,
      })

      groups.set(groupKey, group)
    }

    const checkoutGroups = [...groups.values()]

    const result = await this.orders.createCheckout(
      buyerId,
      input,
      randomUUID(),
      checkoutGroups,
      cartIdToClear,
    )

    await this.notifications?.sendToUser(buyerId, {
      type: 'ORDER',
      title: 'Order created',
      message: `${result.orders.length} order${
        result.orders.length === 1 ? '' : 's'
      } created successfully.`,
      referenceType: 'CHECKOUT',
      referenceId: result.checkoutGroupId,
    })

    const sellerNotifications = result.orders.map(async (order, index) => {
      const checkoutGroup = checkoutGroups[index]

      // Official-store orders only.
      // Second-hand USER orders must not trigger seller notifications.
      if (!checkoutGroup || checkoutGroup.sellerType !== 'ADMIN') return

      const sellerId = checkoutGroup.items[0]?.product.sellerId
      if (!sellerId) return

      const message = `${order.orderNumber} · ₹${order.totalAmount.toFixed(2)} · ${
        order.itemCount
      } item${order.itemCount === 1 ? '' : 's'}`

      await this.notifications?.sendToUser(sellerId, {
        type: 'ORDER',
        title: 'New order received',
        message,
        referenceType: 'ORDER',
        referenceId: order.id,
      })

      await this.push?.sendToUser(sellerId, {
        title: 'New order received',
        body: message,
        url: `/seller?section=orders&order=${encodeURIComponent(order.id)}`,
        tag: `order-${order.id}`,
        orderId: order.id,
      })
    })

    await Promise.allSettled(sellerNotifications)

    return result
  }

  listOwned(
    buyerId: string,
    query: OrderListQuery,
  ): Promise<PaginatedResult<OrderDetail>> {
    return this.orders.listOwned(buyerId, query)
  }

  async getOwned(
    orderId: string,
    buyerId: string,
  ): Promise<OrderDetail> {
    const order = await this.orders.findOwnedById(orderId, buyerId)

    if (!order) {
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'This order could not be found.',
      )
    }

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

    if (!updated) {
      throw new AppError(
        409,
        'ORDER_STATUS_CHANGED',
        'The order status changed. Refresh and try again.',
      )
    }

    return updated
  }

  listAdmin(
    query: AdminOrderListQuery,
    actor?: { id: string; role: UserRole },
  ): Promise<PaginatedResult<AdminOrderDetail>> {
    return this.orders.listAdmin(
      query,
      actor?.role === 'MODERATOR' ? actor.id : undefined,
    )
  }

  async getAdmin(
    orderId: string,
    actor?: { id: string; role: UserRole },
  ): Promise<AdminOrderDetail> {
    const order = await this.orders.findAdminById(
      orderId,
      actor?.role === 'MODERATOR' ? actor.id : undefined,
    )

    if (!order) {
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'This order could not be found.',
      )
    }

    return order
  }

  async assignDealer(
    orderId: string,
    actorId: string,
    input: AssignOrderDealerInput,
  ) {
    const order = await this.orders.assignDealer(
      orderId,
      actorId,
      input,
    )

    await this.notifications?.sendToUser(order.buyerId, {
      type: 'ORDER',
      title: 'Sales dealer assigned',
      message: `${
        order.assignedDealer?.displayName ?? 'A sales dealer'
      } is ready to assist with order ${order.orderNumber}.`,
      referenceType: 'ORDER',
      referenceId: order.id,
    })

    return order
  }

  async assignModerator(
    orderId: string,
    actorId: string,
    input: AssignOrderModeratorInput,
  ) {
    const order = await this.orders.assignModerator(
      orderId,
      actorId,
      input,
    )

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
    actor: { id: string; role: UserRole },
    input: UpdateOrderStatusInput,
  ): Promise<OrderDetail> {
    const order = await this.getAdmin(orderId, actor)

    if (order.status === input.status) {
      return order
    }

    const allowedTransitions =
      actor.role === 'MODERATOR'
        ? MODERATOR_TRANSITIONS[order.status]
        : ADMIN_TRANSITIONS[order.status]

    if (!allowedTransitions.includes(input.status)) {
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
      actor.id,
      input.note ?? null,
    )

    if (!updated) {
      throw new AppError(
        409,
        'ORDER_STATUS_CHANGED',
        'The order status changed. Refresh and try again.',
      )
    }

    const statusLabel = input.status
      .toLowerCase()
      .replaceAll('_', ' ')

    await this.notifications?.sendToUser(updated.buyerId, {
      type: 'ORDER',
      title: `Order ${statusLabel}`,
      message: `Order ${updated.orderNumber} is now ${statusLabel}.`,
      referenceType: 'ORDER',
      referenceId: updated.id,
    })

    // Notify the second-hand seller when the order status changes.
    if (updated.sellerType === 'USER' && updated.sellerId) {
      await this.notifications?.sendToUser(updated.sellerId, {
        type: 'ORDER',
        title: `Second-hand order ${statusLabel}`,
        message: `Order ${updated.orderNumber} is now ${statusLabel}.`,
        referenceType: 'ORDER',
        referenceId: updated.id,
      })
    }

    return updated
  }
}
import { randomUUID } from 'node:crypto'
import type {
  AdminOrderListQuery,
  AssignOrderDealerInput,
  AssignOrderModeratorInput,
  CheckoutInput,
  CheckoutResult,
  DealerAssignmentHistory,
  OrderDetail,
  OrderItem,
  OrderListQuery,
  OrderStatus,
  OrderStatusHistory,
  OrderSummary,
  PaginatedResult,
} from '@campusbaza/contracts'
import mongoose, { Types, type ClientSession } from 'mongoose'
import { AppError } from '../../../core/errors/app-error.js'
import { CartModel } from '../../cart/infrastructure/cart.model.js'
import { CategoryModel } from '../../categories/infrastructure/category.model.js'
import { ProductModel } from '../../products/infrastructure/product.models.js'
import { UserModel, UserProfileModel } from '../../users/infrastructure/user.models.js'
import {
  DealerAssignmentHistoryModel,
  DealerModel,
} from '../../dealers/infrastructure/dealer.models.js'
import type { CheckoutPlanGroup, OrderRepository } from '../domain/order.js'
import type { CartRecord } from '../../cart/domain/cart.js'
import { OrderItemModel, OrderModel, OrderStatusHistoryModel } from './order.models.js'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function objectIdToString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value instanceof Types.ObjectId) return value.toHexString()
  return null
}

function makeOrderNumber() {
  return `CBZ-${new Date().getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`
}

function isWithinWorkingHours(hours: Record<string, unknown>, now = new Date()) {
  const timeZone = typeof hours.timeZone === 'string' ? hours.timeZone : 'Asia/Kolkata'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0) % 24
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday ?? '')
  const days = (hours.days as number[] | undefined) ?? [0, 1, 2, 3, 4, 5, 6]
  if (!days.includes(dayIndex)) return false
  const toMinutes = (value: unknown) => {
    const [h = '0', m = '0'] = String(value).split(':')
    return Number(h) * 60 + Number(m)
  }
  const current = hour * 60 + minute
  const start = toMinutes(hours.startTime ?? '00:00')
  const end = toMinutes(hours.endTime ?? '23:59')
  return start <= end ? current >= start && current <= end : current >= start || current <= end
}

function transactionUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('Transaction numbers are only allowed') ||
    message.includes('replica set member or mongos') ||
    message.includes('does not support retryable writes')
  )
}

export class MongooseOrderRepository implements OrderRepository {
  async createCheckout(
    buyerId: string,
    input: CheckoutInput,
    checkoutGroupId: string,
    groups: CheckoutPlanGroup[],
    cart: CartRecord,
  ): Promise<CheckoutResult> {
    const session = await mongoose.startSession()
    const createdOrderIds: string[] = []
    try {
      await session.withTransaction(async () => {
        createdOrderIds.length = 0
        const productIds = groups.flatMap((group) =>
          group.items.map((item) => item.product.summary.id),
        )
        const currentProducts = await ProductModel.find({
          _id: { $in: productIds },
          deletedAt: null,
        })
          .session(session)
          .lean<Record<string, unknown>[]>()
        const productById = new Map(
          currentProducts.map((product) => [String(product._id), product]),
        )
        const sellerIds = [...new Set(currentProducts.map((product) => String(product.sellerId)))]
        const categoryIds = [
          ...new Set(currentProducts.map((product) => String(product.categoryId))),
        ]
        const [activeSellers, activeCategories] = await Promise.all([
          UserModel.find({ _id: { $in: sellerIds }, status: 'ACTIVE' })
            .session(session)
            .distinct('_id'),
          CategoryModel.find({ _id: { $in: categoryIds }, isActive: true, deletedAt: null })
            .session(session)
            .distinct('_id'),
        ])
        const activeSellerSet = new Set(activeSellers.map(String))
        const activeCategorySet = new Set(activeCategories.map(String))

        for (const group of groups) {
          let subtotal = 0
          for (const item of group.items) {
            const current = productById.get(item.product.summary.id)
            if (
              !current ||
              current.status !== 'APPROVED' ||
              !current.published ||
              Number(current.price) !== item.product.summary.price ||
              !activeSellerSet.has(String(current.sellerId)) ||
              !activeCategorySet.has(String(current.categoryId)) ||
              (current.sellerType === 'USER' && String(current.sellerId) === buyerId)
            ) {
              throw new AppError(
                409,
                'CART_REQUIRES_REVIEW',
                `${item.product.summary.title} changed before checkout. Review your cart and try again.`,
              )
            }
            const updated = await ProductModel.findOneAndUpdate(
              {
                _id: item.product.summary.id,
                deletedAt: null,
                status: 'APPROVED',
                published: true,
                stock: { $gte: item.quantity },
              },
              [
                { $set: { stock: { $subtract: ['$stock', item.quantity] } } },
                {
                  $set: {
                    status: { $cond: [{ $eq: ['$stock', 0] }, 'OUT_OF_STOCK', '$status'] },
                  },
                },
              ],
              { new: true, session },
            ).lean<Record<string, unknown>>()
            if (!updated) {
              throw new AppError(
                409,
                'INSUFFICIENT_STOCK',
                `${item.product.summary.title} no longer has enough stock.`,
              )
            }
            subtotal += item.product.summary.price * item.quantity
          }

          const [order] = await OrderModel.create(
            [
              {
                checkoutGroupId,
                orderNumber: makeOrderNumber(),
                buyerId,
                sellerType: group.sellerType,
                sellerId: group.sellerId,
                status: 'WAITING_FOR_DEALER_ASSIGNMENT',
                subtotal,
                totalAmount: subtotal,
                itemCount: group.items.reduce((sum, item) => sum + item.quantity, 0),
                fullName: input.fullName,
                phoneNumber: input.phoneNumber,
                campusId: input.campusId ?? null,
                department: input.department ?? null,
                building: input.building ?? null,
                pickupLocation: input.pickupLocation,
                preferredPickupTime: input.preferredPickupTime ?? null,
                notes: input.notes ?? null,
              },
            ],
            { session },
          )
          if (!order) throw new Error('Unable to create order')
          const orderId = String(order._id)
          const dealer = await this.acquireAutomaticDealer(session)
          const initialStatus: OrderStatus = dealer
            ? 'AWAITING_TEAM_CONFIRMATION'
            : 'WAITING_FOR_DEALER_ASSIGNMENT'
          if (dealer) {
            await OrderModel.updateOne(
              { _id: orderId },
              {
                $set: {
                  status: initialStatus,
                  assignedDealerId: dealer._id,
                  assignedDealerName: dealer.displayName,
                  assignedDealerPhone: dealer.phoneNumber,
                  assignedModeratorId: dealer.mediatorUserId,
                  assignedModeratorName: dealer.displayName,
                  moderatorAssignedAt: new Date(),
                  dealerAssignedAt: new Date(),
                  dealerReleased: false,
                },
              },
              { session },
            )
            await DealerAssignmentHistoryModel.create(
              [
                {
                  orderId,
                  previousDealerId: null,
                  newDealerId: dealer._id,
                  newDealerName: dealer.displayName,
                  newDealerPhone: dealer.phoneNumber,
                  reason: 'Automatically assigned during checkout.',
                  mode: 'AUTO',
                  actorId: buyerId,
                },
              ],
              { session },
            )
          }
          createdOrderIds.push(orderId)
          await OrderItemModel.insertMany(
            group.items.map((item) => ({
              orderId,
              productId: item.product.summary.id,
              productName: item.product.summary.title,
              productSlug: item.product.summary.slug,
              productImageUrl: item.product.summary.primaryImage?.url ?? null,
              sellerId: item.product.sellerId,
              productType: item.product.summary.productType,
              quantity: item.quantity,
              unitPrice: item.product.summary.price,
              totalPrice: item.product.summary.price * item.quantity,
            })),
            { session },
          )
          await OrderStatusHistoryModel.create(
            [
              {
                orderId,
                fromStatus: null,
                toStatus: initialStatus,
                note: dealer
                  ? 'Order created and assigned to a sales dealer.'
                  : 'Order created and waiting for an available sales dealer.',
                actorId: buyerId,
              },
            ],
            { session },
          )
        }
        await CartModel.updateOne(
          { _id: cart.id, userId: buyerId },
          { $set: { items: [] } },
          { session },
        )
      })
    } catch (error) {
      if (transactionUnavailable(error)) {
        throw new AppError(
          503,
          'DATABASE_TRANSACTIONS_REQUIRED',
          'Checkout requires MongoDB replica-set transactions. Configure a replica set and try again.',
        )
      }
      throw error
    } finally {
      await session.endSession()
    }
    const orders = await this.hydrateOrders(createdOrderIds)
    return { checkoutGroupId, orders }
  }

  async listOwned(buyerId: string, query: OrderListQuery): Promise<PaginatedResult<OrderDetail>> {
    return this.list(
      { buyerId, ...(query.status ? { status: query.status } : {}) },
      query.page,
      query.limit,
    )
  }

  async findOwnedById(orderId: string, buyerId: string): Promise<OrderDetail | null> {
    const document = await OrderModel.findOne({ _id: orderId, buyerId }).lean<
      Record<string, unknown>
    >()
    return document ? await this.hydrateOrder(document) : null
  }

  async listAdmin(
    query: AdminOrderListQuery,
    moderatorId?: string,
  ): Promise<PaginatedResult<OrderDetail>> {
    const filter: Record<string, unknown> = moderatorId ? { assignedModeratorId: moderatorId } : {}
    if (query.status) filter.status = query.status
    if (query.sellerType) filter.sellerType = query.sellerType
    if (query.dealerId) filter.assignedDealerId = query.dealerId
    if (query.assignment === 'ASSIGNED') filter.assignedDealerId = { $ne: null }
    if (query.assignment === 'UNASSIGNED') filter.assignedDealerId = null
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i')
      filter.$or = [{ orderNumber: regex }, { fullName: regex }, { phoneNumber: regex }]
    }
    return this.list(filter, query.page, query.limit)
  }

  async findAdminById(orderId: string, moderatorId?: string): Promise<OrderDetail | null> {
    const document = await OrderModel.findOne({
      _id: orderId,
      ...(moderatorId ? { assignedModeratorId: moderatorId } : {}),
    }).lean<Record<string, unknown>>()
    return document ? this.hydrateOrder(document) : null
  }

  async assignDealer(
    orderId: string,
    actorId: string,
    input: AssignOrderDealerInput,
  ): Promise<OrderDetail> {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const order = await OrderModel.findById(orderId)
          .session(session)
          .lean<Record<string, unknown>>()
        if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'This order could not be found.')
        if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(order.status))) {
          throw new AppError(
            409,
            'ORDER_IS_TERMINAL',
            'A completed or cancelled order cannot be reassigned.',
          )
        }
        const previousDealerId = objectIdToString(order.assignedDealerId)
        const previousName = (order.assignedDealerName as string | null) ?? null
        const previousPhone = (order.assignedDealerPhone as string | null) ?? null
        if (input.mode === 'MANUAL' && input.dealerId === previousDealerId) return
        let dealer: Record<string, unknown> | null = null
        if (input.mode === 'AUTO') {
          dealer = await this.acquireAutomaticDealer(session, previousDealerId ?? undefined)
        } else {
          if (!input.dealerId) {
            throw new AppError(400, 'DEALER_REQUIRED', 'Choose a dealer for manual assignment.')
          }
          dealer = await this.acquireSpecificDealer(input.dealerId, session)
        }
        if (!dealer)
          throw new AppError(409, 'NO_DEALER_AVAILABLE', 'No eligible dealer is available.')
        const newDealerId = String(dealer._id)
        if (newDealerId === previousDealerId) return
        if (previousDealerId && !order.dealerReleased) {
          await DealerModel.updateOne(
            { _id: previousDealerId, currentOpenOrders: { $gt: 0 } },
            { $inc: { currentOpenOrders: -1 } },
            { session },
          )
        }
        const previousStatus = order.status as OrderStatus
        const newStatus: OrderStatus =
          previousStatus === 'WAITING_FOR_DEALER_ASSIGNMENT'
            ? 'AWAITING_TEAM_CONFIRMATION'
            : previousStatus
        await OrderModel.updateOne(
          { _id: orderId },
          {
            $set: {
              assignedDealerId: dealer._id,
              assignedDealerName: dealer.displayName,
              assignedDealerPhone: dealer.phoneNumber,
              assignedModeratorId: dealer.mediatorUserId,
              assignedModeratorName: dealer.displayName,
              moderatorAssignedAt: new Date(),
              dealerAssignedAt: new Date(),
              dealerReleased: false,
              status: newStatus,
            },
          },
          { session },
        )
        await DealerAssignmentHistoryModel.create(
          [
            {
              orderId,
              previousDealerId,
              previousDealerName: previousName,
              previousDealerPhone: previousPhone,
              newDealerId: dealer._id,
              newDealerName: dealer.displayName,
              newDealerPhone: dealer.phoneNumber,
              reason: input.reason,
              mode: input.mode,
              actorId,
            },
          ],
          { session },
        )
        if (newStatus !== previousStatus) {
          await OrderStatusHistoryModel.create(
            [
              {
                orderId,
                fromStatus: previousStatus,
                toStatus: newStatus,
                note: 'Sales dealer assigned.',
                actorId,
              },
            ],
            { session },
          )
        }
      })
    } catch (error) {
      if (transactionUnavailable(error)) {
        throw new AppError(
          503,
          'DATABASE_TRANSACTIONS_REQUIRED',
          'Dealer assignment requires MongoDB replica-set transactions.',
        )
      }
      throw error
    } finally {
      await session.endSession()
    }
    const order = await this.findAdminById(orderId)
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'This order could not be found.')
    return order
  }

  async assignModerator(
    orderId: string,
    _actorId: string,
    input: AssignOrderModeratorInput,
  ): Promise<OrderDetail> {
    const moderator = await UserModel.findOne({
      _id: input.moderatorId,
      status: 'ACTIVE',
      $or: [
        { role: 'MODERATOR' },
        { canMediateOrders: true, role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
      ],
    }).lean<Record<string, unknown>>()
    if (!moderator) {
      throw new AppError(400, 'MODERATOR_NOT_AVAILABLE', 'Choose an active moderator account.')
    }
    const profile = await UserProfileModel.findOne({ userId: moderator._id }).lean<
      Record<string, unknown>
    >()
    const displayName =
      (profile?.displayName as string | undefined) ??
      (profile?.fullName as string | undefined) ??
      String(moderator.email).split('@')[0] ??
      'Moderator'
    const updated = await OrderModel.findOneAndUpdate(
      { _id: orderId, status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
      {
        $set: {
          assignedModeratorId: moderator._id,
          assignedModeratorName: displayName,
          moderatorAssignedAt: new Date(),
        },
      },
      { new: true },
    ).lean<Record<string, unknown>>()
    if (!updated) {
      throw new AppError(
        409,
        'ORDER_NOT_ASSIGNABLE',
        'The order is unavailable or its conversation is already closed.',
      )
    }
    return this.hydrateOrder(updated)
  }

  async transition(
    orderId: string,
    expectedStatus: OrderStatus,
    status: OrderStatus,
    actorId: string,
    note: string | null,
  ): Promise<OrderDetail | null> {
    const session = await mongoose.startSession()
    let changed = false
    try {
      await session.withTransaction(async () => {
        changed = false
        const set: Record<string, unknown> = { status }
        if (status === 'COMPLETED') set.completedAt = new Date()
        if (status === 'CANCELLED' || status === 'REJECTED') set.cancelledAt = new Date()
        const order = await OrderModel.findOneAndUpdate(
          { _id: orderId, status: expectedStatus },
          { $set: set },
          { new: true, session },
        ).lean<Record<string, unknown>>()
        if (!order) return
        changed = true
        if (
          ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(status) &&
          order.assignedDealerId &&
          !order.dealerReleased
        ) {
          await DealerModel.updateOne(
            { _id: order.assignedDealerId, currentOpenOrders: { $gt: 0 } },
            {
              $inc: {
                currentOpenOrders: -1,
                ...(status === 'COMPLETED' ? { completedOrders: 1 } : {}),
              },
            },
            { session },
          )
          await OrderModel.updateOne(
            { _id: orderId },
            { $set: { dealerReleased: true } },
            { session },
          )
        }
        const items = await OrderItemModel.find({ orderId })
          .session(session)
          .lean<Record<string, unknown>[]>()
        if ((status === 'CANCELLED' || status === 'REJECTED') && !order.stockRestored) {
          await this.restoreStock(items, session)
          await OrderModel.updateOne(
            { _id: orderId },
            { $set: { stockRestored: true } },
            { session },
          )
        }
        if (status === 'COMPLETED') {
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
          [{ orderId, fromStatus: expectedStatus, toStatus: status, note, actorId }],
          { session },
        )
      })
    } catch (error) {
      if (transactionUnavailable(error)) {
        throw new AppError(
          503,
          'DATABASE_TRANSACTIONS_REQUIRED',
          'Order updates require MongoDB replica-set transactions.',
        )
      }
      throw error
    } finally {
      await session.endSession()
    }
    return changed ? this.findAdminById(orderId) : null
  }

  private async acquireSpecificDealer(dealerId: string, session: ClientSession) {
    const dealer = await DealerModel.findOneAndUpdate(
      {
        _id: dealerId,
        isActive: true,
        deletedAt: null,
        mediatorUserId: { $ne: null },
        $expr: { $lt: ['$currentOpenOrders', '$maxOpenOrders'] },
      },
      { $inc: { currentOpenOrders: 1 }, $set: { lastAssignedAt: new Date() } },
      { new: true, session },
    ).lean<Record<string, unknown>>()
    if (!dealer) return null
    const mediator = await UserModel.exists({
      _id: dealer.mediatorUserId,
      status: 'ACTIVE',
      $or: [
        { role: 'MODERATOR' },
        { canMediateOrders: true, role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
      ],
    }).session(session)
    if (mediator) return dealer
    await DealerModel.updateOne(
      { _id: dealer._id, currentOpenOrders: { $gt: 0 } },
      { $inc: { currentOpenOrders: -1 }, $set: { isActive: false } },
      { session },
    )
    return null
  }

  private async acquireAutomaticDealer(session: ClientSession, excludeId?: string) {
    const candidates = await DealerModel.find({
      isActive: true,
      deletedAt: null,
      mediatorUserId: { $ne: null },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      $expr: { $lt: ['$currentOpenOrders', '$maxOpenOrders'] },
    })
      .sort({ currentOpenOrders: 1, lastAssignedAt: 1, createdAt: 1 })
      .session(session)
      .lean<Record<string, unknown>[]>()
    for (const candidate of candidates) {
      if (!isWithinWorkingHours(candidate.workingHours as Record<string, unknown>)) continue
      const acquired = await this.acquireSpecificDealer(String(candidate._id), session)
      if (acquired) return acquired
    }
    return null
  }

  private async acquireAutomaticModerator(session: ClientSession) {
    const candidates = await UserModel.find({
      status: 'ACTIVE',
      $or: [
        { role: 'MODERATOR' },
        { canMediateOrders: true, role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
      ],
    })
      .sort({ createdAt: 1 })
      .session(session)
      .lean<Record<string, unknown>[]>()
    if (!candidates.length) return null
    const candidateIds = candidates.map((candidate) => candidate._id)
    const workloads = await OrderModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          assignedModeratorId: { $in: candidateIds },
          status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
        },
      },
      { $group: { _id: '$assignedModeratorId', count: { $sum: 1 } } },
    ]).session(session)
    const workloadById = new Map(workloads.map((entry) => [String(entry._id), entry.count]))
    candidates.sort(
      (left, right) =>
        (workloadById.get(String(left._id)) ?? 0) - (workloadById.get(String(right._id)) ?? 0),
    )
    const selected = candidates[0]!
    const profile = await UserProfileModel.findOne({ userId: selected._id })
      .session(session)
      .lean<Record<string, unknown>>()
    return {
      _id: selected._id,
      displayName:
        (profile?.displayName as string | undefined) ??
        (profile?.fullName as string | undefined) ??
        String(selected.email).split('@')[0] ??
        'Moderator',
    }
  }

  private async restoreStock(items: Record<string, unknown>[], session: ClientSession) {
    await Promise.all(
      items.map((item) =>
        ProductModel.updateOne(
          { _id: item.productId, deletedAt: null },
          [
            { $set: { stock: { $add: ['$stock', Number(item.quantity)] } } },
            {
              $set: {
                status: {
                  $cond: [{ $eq: ['$status', 'OUT_OF_STOCK'] }, 'APPROVED', '$status'],
                },
              },
            },
          ],
          { session },
        ),
      ),
    )
  }

  private async list(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<OrderDetail>> {
    const skip = (page - 1) * limit
    const [documents, total] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<Record<string, unknown>[]>(),
      OrderModel.countDocuments(filter),
    ])
    return {
      items: await Promise.all(documents.map((document) => this.hydrateOrder(document))),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  private async hydrateOrders(ids: string[]): Promise<OrderSummary[]> {
    const documents = await OrderModel.find({ _id: { $in: ids } }).lean<Record<string, unknown>[]>()
    const details = await Promise.all(documents.map((document) => this.hydrateOrder(document)))
    const byId = new Map(details.map((order) => [order.id, order]))
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  }

  private async hydrateOrder(document: Record<string, unknown>): Promise<OrderDetail> {
    const orderId = String(document._id)
    const [itemDocuments, historyDocuments, assignmentDocuments] = await Promise.all([
      OrderItemModel.find({ orderId }).sort({ createdAt: 1 }).lean<Record<string, unknown>[]>(),
      OrderStatusHistoryModel.find({ orderId })
        .sort({ createdAt: 1 })
        .lean<Record<string, unknown>[]>(),
      DealerAssignmentHistoryModel.find({ orderId })
        .sort({ createdAt: 1 })
        .lean<Record<string, unknown>[]>(),
    ])
    const items: OrderItem[] = itemDocuments.map((item) => ({
      id: String(item._id),
      productId: String(item.productId),
      productName: String(item.productName),
      productSlug: String(item.productSlug),
      productImageUrl: (item.productImageUrl as string | null) ?? null,
      sellerId: String(item.sellerId),
      productType: item.productType as OrderItem['productType'],
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    }))
    const statusHistory: OrderStatusHistory[] = historyDocuments.map((entry) => ({
      id: String(entry._id),
      fromStatus: (entry.fromStatus as OrderStatus | null) ?? null,
      toStatus: entry.toStatus as OrderStatus,
      note: (entry.note as string | null) ?? null,
      actorId: objectIdToString(entry.actorId),
      createdAt: (entry.createdAt as Date).toISOString(),
    }))
    const dealerAssignmentHistory: DealerAssignmentHistory[] = assignmentDocuments.map((entry) => ({
      id: String(entry._id),
      previousDealer: entry.previousDealerId
        ? {
            id: objectIdToString(entry.previousDealerId) ?? '',
            displayName: String(entry.previousDealerName),
            phoneNumber: String(entry.previousDealerPhone),
          }
        : null,
      newDealer: entry.newDealerId
        ? {
            id: objectIdToString(entry.newDealerId) ?? '',
            displayName: String(entry.newDealerName),
            phoneNumber: String(entry.newDealerPhone),
          }
        : null,
      reason: String(entry.reason),
      mode: entry.mode as 'AUTO' | 'MANUAL',
      actorId: objectIdToString(entry.actorId),
      createdAt: (entry.createdAt as Date).toISOString(),
    }))
    return {
      id: orderId,
      checkoutGroupId: String(document.checkoutGroupId),
      orderNumber: String(document.orderNumber),
      buyerId: String(document.buyerId),
      sellerType: document.sellerType as OrderDetail['sellerType'],
      sellerId: objectIdToString(document.sellerId),
      status: document.status as OrderStatus,
      subtotal: Number(document.subtotal),
      totalAmount: Number(document.totalAmount),
      itemCount: Number(document.itemCount),
      productPreview: items.slice(0, 3),
      pickupLocation: String(document.pickupLocation),
      assignedDealerId: objectIdToString(document.assignedDealerId),
      assignedDealer: document.assignedDealerId
        ? {
            id: objectIdToString(document.assignedDealerId) ?? '',
            displayName: String(document.assignedDealerName),
          }
        : null,
      assignedModeratorId: objectIdToString(document.assignedModeratorId),
      assignedModerator: document.assignedModeratorId
        ? {
            id: objectIdToString(document.assignedModeratorId) ?? '',
            displayName: String(document.assignedModeratorName),
          }
        : null,
      createdAt: (document.createdAt as Date).toISOString(),
      updatedAt: (document.updatedAt as Date).toISOString(),
      fullName: String(document.fullName),
      phoneNumber: String(document.phoneNumber),
      campusId: (document.campusId as string | null) ?? null,
      department: (document.department as string | null) ?? null,
      building: (document.building as string | null) ?? null,
      preferredPickupTime: (document.preferredPickupTime as string | null) ?? null,
      notes: (document.notes as string | null) ?? null,
      internalNotes: (document.internalNotes as string | null) ?? null,
      items,
      statusHistory,
      dealerAssignmentHistory,
      cancelledAt: document.cancelledAt ? (document.cancelledAt as Date).toISOString() : null,
      completedAt: document.completedAt ? (document.completedAt as Date).toISOString() : null,
    }
  }
}

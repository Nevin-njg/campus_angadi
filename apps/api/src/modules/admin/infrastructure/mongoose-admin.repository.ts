import type {
  AdminDashboard,
  AdminUserDetail,
  AdminUserListQuery,
  AdminUserSummary,
  PaginatedResult,
  SalesAnalytics,
  SalesAnalyticsQuery,
  UpdateAdminUserInput,
} from '@campusbaza/contracts'
import { Types } from 'mongoose'
import { UserModel, UserProfileModel } from '../../users/infrastructure/user.models.js'
import { ProductModel } from '../../products/infrastructure/product.models.js'
import { OrderItemModel, OrderModel } from '../../orders/infrastructure/order.models.js'
import { DealerModel } from '../../dealers/infrastructure/dealer.models.js'
import { ReportModel } from '../../reports/infrastructure/report.model.js'
import { SessionModel } from '../../auth/infrastructure/session.model.js'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function dateFloor(days: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days + 1)
  return d
}
function monthFloor() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function display(profile: Record<string, unknown> | undefined, email: string) {
  if (typeof profile?.displayName === 'string' && profile.displayName) return profile.displayName
  if (typeof profile?.fullName === 'string' && profile.fullName) return profile.fullName
  return email.split('@')[0] ?? 'Campus user'
}
function objectIdToString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value instanceof Types.ObjectId) return value.toHexString()
  return null
}

export class MongooseAdminRepository {
  async dashboardBase(): Promise<Omit<AdminDashboard, 'recentOrders'>> {
    const today = dateFloor(1),
      week = dateFloor(7),
      month = monthFloor()
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      newUsers,
      totalProducts,
      official,
      second,
      pending,
      sold,
      todayOrders,
      weekOrders,
      monthOrders,
      completed,
      cancelled,
      waiting,
      completedAgg,
      monthAgg,
      officialAgg,
      secondAgg,
      activeDealers,
      capacity,
      openAssignments,
      openReports,
      inReview,
      recentDocs,
    ] = await Promise.all([
      UserModel.countDocuments({ status: { $ne: 'DELETED' } }),
      UserModel.countDocuments({ status: 'ACTIVE' }),
      UserModel.countDocuments({ status: 'BLOCKED' }),
      UserModel.countDocuments({ createdAt: { $gte: month } }),
      ProductModel.countDocuments({ deletedAt: null }),
      ProductModel.countDocuments({ sellerType: 'ADMIN', deletedAt: null }),
      ProductModel.countDocuments({ sellerType: 'USER', deletedAt: null }),
      ProductModel.countDocuments({ status: 'PENDING_APPROVAL', deletedAt: null }),
      ProductModel.countDocuments({ status: 'SOLD', deletedAt: null }),
      OrderModel.countDocuments({ createdAt: { $gte: today } }),
      OrderModel.countDocuments({ createdAt: { $gte: week } }),
      OrderModel.countDocuments({ createdAt: { $gte: month } }),
      OrderModel.countDocuments({ status: 'COMPLETED' }),
      OrderModel.countDocuments({ status: { $in: ['CANCELLED', 'REJECTED'] } }),
      OrderModel.countDocuments({ status: 'WAITING_FOR_DEALER_ASSIGNMENT' }),
      this.sumOrders({ status: 'COMPLETED' }),
      this.sumOrders({ status: 'COMPLETED', completedAt: { $gte: month } }),
      this.sumOrders({ status: 'COMPLETED', sellerType: 'ADMIN' }),
      this.sumOrders({ status: 'COMPLETED', sellerType: 'USER' }),
      DealerModel.countDocuments({ isActive: true, deletedAt: null }),
      DealerModel.countDocuments({
        isActive: true,
        deletedAt: null,
        $expr: { $gte: ['$currentOpenOrders', '$maxOpenOrders'] },
      }),
      DealerModel.aggregate<{ value: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: null, value: { $sum: '$currentOpenOrders' } } },
      ]),
      ReportModel.countDocuments({ status: 'OPEN' }),
      ReportModel.countDocuments({ status: 'IN_REVIEW' }),
      UserModel.find({ status: { $ne: 'DELETED' } })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean<Record<string, unknown>[]>(),
    ])
    const profiles = await UserProfileModel.find({
      userId: { $in: recentDocs.map((d) => d._id) },
    }).lean<Record<string, unknown>[]>()
    const byUser = new Map(profiles.map((p) => [String(p.userId), p]))
    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: blockedUsers,
        newThisMonth: newUsers,
      },
      products: {
        total: totalProducts,
        official,
        secondHand: second,
        pendingApproval: pending,
        sold,
      },
      orders: {
        today: todayOrders,
        thisWeek: weekOrders,
        thisMonth: monthOrders,
        completed,
        cancelled,
        waitingForDealer: waiting,
      },
      sales: {
        completedValue: completedAgg,
        thisMonthValue: monthAgg,
        officialValue: officialAgg,
        secondHandValue: secondAgg,
      },
      dealers: {
        active: activeDealers,
        atCapacity: capacity,
        openAssignments: openAssignments[0]?.value ?? 0,
      },
      reports: { open: openReports, inReview },
      recentUsers: recentDocs.map((d) => ({
        id: String(d._id),
        email: String(d.email),
        displayName: display(byUser.get(String(d._id)), String(d.email)),
        role: d.role as AdminDashboard['recentUsers'][number]['role'],
        status: d.status as AdminDashboard['recentUsers'][number]['status'],
        createdAt: (d.createdAt as Date).toISOString(),
      })),
    }
  }
  private async sumOrders(match: Record<string, unknown>) {
    const r = await OrderModel.aggregate<{ value: number }>([
      { $match: match },
      { $group: { _id: null, value: { $sum: '$totalAmount' } } },
    ])
    return r[0]?.value ?? 0
  }

  async listUsers(q: AdminUserListQuery): Promise<PaginatedResult<AdminUserSummary>> {
    const filter: Record<string, unknown> = {}
    if (q.role) filter.role = q.role
    if (q.status) filter.status = q.status
    if (q.canSell !== undefined) filter.canSell = q.canSell
    if (q.canMediateOrders !== undefined) {
      filter.$or = q.canMediateOrders
        ? [{ canMediateOrders: true }, { role: 'MODERATOR' }]
        : [{ canMediateOrders: { $ne: true }, role: { $ne: 'MODERATOR' } }]
    }
    if (q.q) {
      const regex = new RegExp(escapeRegex(q.q), 'i')
      const profiles = await UserProfileModel.find({
        $or: [{ displayName: regex }, { fullName: regex }],
      }).distinct('userId')
      const search = [{ email: regex }, { _id: { $in: profiles } }]
      if (filter.$or) filter.$and = [{ $or: filter.$or }, { $or: search }]
      else filter.$or = search
    }
    const [docs, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<Record<string, unknown>[]>(),
      UserModel.countDocuments(filter),
    ])
    return {
      items: await this.hydrateUsers(docs),
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    }
  }
  async getUser(id: string): Promise<AdminUserDetail | null> {
    if (!Types.ObjectId.isValid(id)) return null
    const d = await UserModel.findById(id).lean<Record<string, unknown>>()
    if (!d) return null
    const summary = (await this.hydrateUsers([d]))[0]!
    const p = await UserProfileModel.findOne({ userId: id }).lean<Record<string, unknown>>()
    return {
      ...summary,
      phoneNumber: (p?.phoneNumber as string | null) ?? null,
      department: (p?.department as string | null) ?? null,
      graduationYear: (p?.graduationYear as number | null) ?? null,
      campusRole: (p?.campusRole as string | null) ?? null,
      bio: (p?.bio as string | null) ?? null,
      internalNotes: (d.internalNotes as string | null) ?? null,
    }
  }
  private async hydrateUsers(docs: Record<string, unknown>[]): Promise<AdminUserSummary[]> {
    const ids = docs.map((d) => d._id)
    const [profiles, listings, orders, sales] = await Promise.all([
      UserProfileModel.find({ userId: { $in: ids } }).lean<Record<string, unknown>[]>(),
      ProductModel.aggregate<{ _id: unknown; count: number }>([
        { $match: { sellerId: { $in: ids }, deletedAt: null } },
        { $group: { _id: '$sellerId', count: { $sum: 1 } } },
      ]),
      OrderModel.aggregate<{ _id: unknown; count: number }>([
        { $match: { buyerId: { $in: ids } } },
        { $group: { _id: '$buyerId', count: { $sum: 1 } } },
      ]),
      OrderModel.aggregate<{ _id: unknown; count: number }>([
        { $match: { sellerId: { $in: ids }, status: 'COMPLETED' } },
        { $group: { _id: '$sellerId', count: { $sum: 1 } } },
      ]),
    ])
    const pmap = new Map(profiles.map((p) => [String(p.userId), p])),
      lmap = new Map(listings.map((x) => [String(x._id), x.count])),
      omap = new Map(orders.map((x) => [String(x._id), x.count])),
      smap = new Map(sales.map((x) => [String(x._id), x.count]))
    return docs.map((d) => {
      const p = pmap.get(String(d._id))
      return {
        id: String(d._id),
        email: String(d.email),
        displayName: display(p, String(d.email)),
        fullName: (p?.fullName as string | null) ?? null,
        role: d.role as AdminUserSummary['role'],
        status: d.status as AdminUserSummary['status'],
        canSell: Boolean(d.canSell),
        canMediateOrders: Boolean(d.canMediateOrders) || d.role === 'MODERATOR',
        profileCompleted: Boolean(d.profileCompleted),
        listingCount: lmap.get(String(d._id)) ?? 0,
        orderCount: omap.get(String(d._id)) ?? 0,
        completedSalesCount: smap.get(String(d._id)) ?? 0,
        createdAt: (d.createdAt as Date).toISOString(),
        lastActiveAt: d.lastActiveAt ? (d.lastActiveAt as Date).toISOString() : null,
      }
    })
  }
  async updateUser(id: string, input: UpdateAdminUserInput) {
    const set: Record<string, unknown> = {}
    if (input.status) set.status = input.status
    if (input.canSell !== undefined) set.canSell = input.canSell
    if (input.canMediateOrders !== undefined) set.canMediateOrders = input.canMediateOrders
    if (input.role) {
      set.role = input.role
      if (input.role === 'MODERATOR') set.canMediateOrders = true
      if (input.role === 'USER' && input.canMediateOrders === undefined)
        set.canMediateOrders = false
    }
    if (input.internalNotes !== undefined) set.internalNotes = input.internalNotes
    const d = await UserModel.findByIdAndUpdate(id, { $set: set }, { new: true }).lean<
      Record<string, unknown>
    >()
    if (!d) return null
    if (input.status && input.status !== 'ACTIVE')
      await SessionModel.updateMany(
        { userId: id, revokedAt: null },
        { $set: { revokedAt: new Date(), revokeReason: `Account changed to ${input.status}` } },
      )
    return this.getUser(id)
  }
  async superAdminCount() {
    return UserModel.countDocuments({ role: 'SUPER_ADMIN', status: 'ACTIVE' })
  }

  async getUserByEmail(email: string): Promise<AdminUserDetail | null> {
    const document = await UserModel.findOne({ email }).lean<Record<string, unknown>>()
    return document ? this.getUser(String(document._id)) : null
  }

  async enrollMediator(email: string, role: 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN') {
    const now = new Date()
    const document = await UserModel.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          emailVerified: false,
          status: 'ACTIVE',
          canSell: true,
          profileCompleted: false,
          createdAt: now,
        },
        $set: { role, canMediateOrders: true },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!document) return null
    return this.getUser(String(document._id))
  }

  async sales(q: SalesAnalyticsQuery): Promise<SalesAnalytics> {
    const now = new Date()
    let start: Date
    if (q.period === '7d') start = dateFloor(7)
    else if (q.period === '30d') start = dateFloor(30)
    else if (q.period === '90d') start = dateFloor(90)
    else start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
    const orders = await OrderModel.find({ createdAt: { $gte: start, $lte: now } }).lean<
      Record<string, unknown>[]
    >()
    const orderIds = orders.map((o) => o._id)
    const items = await OrderItemModel.find({ orderId: { $in: orderIds } }).lean<
      Record<string, unknown>[]
    >()
    const orderMap = new Map(orders.map((o) => [String(o._id), o]))
    const orderValue = orders.reduce((s, o) => s + Number(o.totalAmount), 0),
      confirmedValue = orders
        .filter((o) =>
          ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'].includes(String(o.status)),
        )
        .reduce((s, o) => s + Number(o.totalAmount), 0),
      completedOrders = orders.filter((o) => o.status === 'COMPLETED'),
      completedValue = completedOrders.reduce((s, o) => s + Number(o.totalAmount), 0),
      cancelledValue = orders
        .filter((o) => ['CANCELLED', 'REJECTED'].includes(String(o.status)))
        .reduce((s, o) => s + Number(o.totalAmount), 0)
    const official = completedOrders
      .filter((o) => o.sellerType === 'ADMIN')
      .reduce((s, o) => s + Number(o.totalAmount), 0)
    const second = completedValue - official
    const timelineMap = new Map<
      string,
      { label: string; orderCount: number; completedCount: number; completedValue: number }
    >()
    for (const o of orders) {
      const d = o.createdAt as Date
      const label =
        q.period === '12m'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          : d.toISOString().slice(0, 10)
      const x = timelineMap.get(label) ?? {
        label,
        orderCount: 0,
        completedCount: 0,
        completedValue: 0,
      }
      x.orderCount++
      if (o.status === 'COMPLETED') {
        x.completedCount++
        x.completedValue += Number(o.totalAmount)
      }
      timelineMap.set(label, x)
    }
    const productMap = new Map<
      string,
      { productId: string; name: string; quantity: number; value: number }
    >()
    for (const i of items) {
      const o = orderMap.get(String(i.orderId))
      if (o?.status !== 'COMPLETED') continue
      const id = String(i.productId),
        x = productMap.get(id) ?? {
          productId: id,
          name: String(i.productName),
          quantity: 0,
          value: 0,
        }
      x.quantity += Number(i.quantity)
      x.value += Number(i.totalPrice)
      productMap.set(id, x)
    }
    const dealerMap = new Map<
      string,
      { dealerId: string; name: string; completedOrders: number; completedValue: number }
    >()
    for (const o of completedOrders) {
      if (!o.assignedDealerId) continue
      const id = objectIdToString(o.assignedDealerId) ?? '',
        x = dealerMap.get(id) ?? {
          dealerId: id,
          name: typeof o.assignedDealerName === 'string' ? o.assignedDealerName : 'Dealer',
          completedOrders: 0,
          completedValue: 0,
        }
      x.completedOrders++
      x.completedValue += Number(o.totalAmount)
      dealerMap.set(id, x)
    }
    return {
      period: q.period,
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      totals: {
        orderValue,
        confirmedValue,
        completedValue,
        cancelledValue,
        completedOrders: completedOrders.length,
        averageOrderValue: completedOrders.length ? completedValue / completedOrders.length : 0,
      },
      bySellerType: { official, secondHand: second },
      timeline: [...timelineMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
      topProducts: [...productMap.values()].sort((a, b) => b.value - a.value).slice(0, 10),
      dealerPerformance: [...dealerMap.values()].sort(
        (a, b) => b.completedValue - a.completedValue,
      ),
    }
  }
}

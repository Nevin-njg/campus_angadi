import { Types } from 'mongoose'
import { AppError } from '../../../core/errors/app-error.js'
import { OrderModel } from '../../orders/infrastructure/order.models.js'
import { StoreModel } from '../infrastructure/store.model.js'
import { StoreSettlementModel } from '../infrastructure/store-settlement.model.js'

const IST_OFFSET_MS = 330 * 60 * 1000
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const ACTIVE_STATUSES = [
  'PENDING',
  'WAITING_FOR_DEALER_ASSIGNMENT',
  'AWAITING_TEAM_CONFIRMATION',
  'CONTACTED',
  'CONFIRMED',
  'PREPARING',
  'DELIVERING_TO_CAMPUS',
  'ARRIVED_AT_CAMPUS',
  'READY_FOR_PICKUP',
] as const
const CONFIRMED_STATUSES = [
  'CONFIRMED',
  'PREPARING',
  'DELIVERING_TO_CAMPUS',
  'ARRIVED_AT_CAMPUS',
  'READY_FOR_PICKUP',
  'COMPLETED',
] as const
const CANCELLED_STATUSES = ['CANCELLED', 'REJECTED'] as const

const money = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function currentMonthIst(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS)
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

function normalizeMonth(value: string) {
  const month = value.trim() || currentMonthIst()
  if (!MONTH_PATTERN.test(month)) {
    throw new AppError(400, 'STORE_FINANCE_MONTH_INVALID', 'Month must use YYYY-MM format.')
  }
  return month
}

function monthRangeIst(month: string) {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  return {
    start: new Date(Date.UTC(year, monthIndex, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(year, monthIndex + 1, 1) - IST_OFFSET_MS),
  }
}

async function requireStore(storeId: string) {
  if (!Types.ObjectId.isValid(storeId)) {
    throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found.')
  }
  const store = await StoreModel.findById(storeId).lean()
  if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found.')
  return store
}

interface OverviewAggregate {
  orderValue: number
  confirmedValue: number
  completedSales: number
  cancelledValue: number
  activeOrderValue: number
  orderCount: number
  activeOrderCount: number
  completedOrderCount: number
  cancelledOrderCount: number
}

async function calculateOverview(storeObjectId: Types.ObjectId, commissionPercent: number) {
  const rows = await OrderModel.aggregate<OverviewAggregate>([
    { $match: { storeId: storeObjectId, sellerType: 'ADMIN' } },
    {
      $group: {
        _id: null,
        orderValue: { $sum: '$totalAmount' },
        confirmedValue: {
          $sum: {
            $cond: [{ $in: ['$status', [...CONFIRMED_STATUSES]] }, '$totalAmount', 0],
          },
        },
        completedSales: {
          $sum: {
            $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$totalAmount', 0],
          },
        },
        cancelledValue: {
          $sum: {
            $cond: [{ $in: ['$status', [...CANCELLED_STATUSES]] }, '$totalAmount', 0],
          },
        },
        activeOrderValue: {
          $sum: {
            $cond: [{ $in: ['$status', [...ACTIVE_STATUSES]] }, '$totalAmount', 0],
          },
        },
        orderCount: { $sum: 1 },
        activeOrderCount: {
          $sum: { $cond: [{ $in: ['$status', [...ACTIVE_STATUSES]] }, 1, 0] },
        },
        completedOrderCount: {
          $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
        },
        cancelledOrderCount: {
          $sum: {
            $cond: [{ $in: ['$status', [...CANCELLED_STATUSES]] }, 1, 0],
          },
        },
      },
    },
  ])

  const row = rows[0] ?? {
    orderValue: 0,
    confirmedValue: 0,
    completedSales: 0,
    cancelledValue: 0,
    activeOrderValue: 0,
    orderCount: 0,
    activeOrderCount: 0,
    completedOrderCount: 0,
    cancelledOrderCount: 0,
  }
  const completedSales = money(row.completedSales)
  const commissionAmount = money((completedSales * commissionPercent) / 100)

  return {
    orderValue: money(row.orderValue),
    confirmedValue: money(row.confirmedValue),
    completedSales,
    cancelledValue: money(row.cancelledValue),
    activeOrderValue: money(row.activeOrderValue),
    orderCount: Number(row.orderCount || 0),
    activeOrderCount: Number(row.activeOrderCount || 0),
    completedOrderCount: Number(row.completedOrderCount || 0),
    cancelledOrderCount: Number(row.cancelledOrderCount || 0),
    averageCompletedOrder:
      row.completedOrderCount > 0 ? money(completedSales / row.completedOrderCount) : 0,
    commissionPercent: money(commissionPercent),
    commissionAmount,
    storeEarnings: money(completedSales - commissionAmount),
  }
}

async function calculateMonth(
  storeObjectId: Types.ObjectId,
  month: string,
  commissionPercent: number,
) {
  const range = monthRangeIst(month)
  const rows = await OrderModel.aggregate<{
    grossSales: number
    completedOrderCount: number
  }>([
    {
      $match: {
        storeId: storeObjectId,
        sellerType: 'ADMIN',
        status: 'COMPLETED',
        completedAt: { $gte: range.start, $lt: range.end },
      },
    },
    {
      $group: {
        _id: null,
        grossSales: { $sum: '$totalAmount' },
        completedOrderCount: { $sum: 1 },
      },
    },
  ])
  const row = rows[0] ?? { grossSales: 0, completedOrderCount: 0 }
  const grossSales = money(row.grossSales)
  const commissionAmount = money((grossSales * commissionPercent) / 100)
  return {
    grossSales,
    completedOrderCount: Number(row.completedOrderCount || 0),
    averageOrder: row.completedOrderCount > 0 ? money(grossSales / row.completedOrderCount) : 0,
    commissionPercent: money(commissionPercent),
    commissionAmount,
    payableToStore: money(grossSales - commissionAmount),
  }
}

function settlementView(settlement: {
  month: string
  grossSales: number
  completedOrderCount: number
  commissionPercent: number
  commissionAmount: number
  payableToStore: number
  settledAt: Date
}) {
  return {
    month: settlement.month,
    grossSales: money(settlement.grossSales),
    completedOrderCount: Number(settlement.completedOrderCount || 0),
    averageOrder:
      settlement.completedOrderCount > 0
        ? money(settlement.grossSales / settlement.completedOrderCount)
        : 0,
    commissionPercent: money(settlement.commissionPercent),
    commissionAmount: money(settlement.commissionAmount),
    payableToStore: money(settlement.payableToStore),
    status: 'SETTLED' as const,
    settledAt: settlement.settledAt.toISOString(),
    usesSnapshot: true,
  }
}

export async function getAdminStoreFinance(storeId: string, requestedMonth = '') {
  const store = await requireStore(storeId)
  const month = normalizeMonth(requestedMonth)
  const currentMonth = currentMonthIst()
  const storeObjectId = new Types.ObjectId(String(store._id))
  const commissionPercent = money(store.commissionPercent)

  const [overview, settlement, liveMonth] = await Promise.all([
    calculateOverview(storeObjectId, commissionPercent),
    StoreSettlementModel.findOne({ storeId: store._id, month }).lean(),
    calculateMonth(storeObjectId, month, commissionPercent),
  ])

  const monthly = settlement
    ? settlementView(settlement)
    : {
        month,
        ...liveMonth,
        status: 'PENDING' as const,
        settledAt: null,
        usesSnapshot: false,
      }

  return {
    storeId: String(store._id),
    month,
    currentMonth,
    periodClosed: month < currentMonth,
    canSettle: month < currentMonth && monthly.status === 'PENDING',
    overview,
    monthly,
  }
}

export async function getSellerStoreFinance(sellerId: string, requestedMonth = '') {
  const store = await StoreModel.findOne({ sellerId }).select('_id').lean()

  if (!store) {
    throw new AppError(404, 'STORE_NOT_FOUND', 'No store is assigned to this seller.')
  }

  return getAdminStoreFinance(String(store._id), requestedMonth)
}

export async function settleAdminStoreMonth(
  storeId: string,
  requestedMonth: string,
  actorId: string,
) {
  const store = await requireStore(storeId)
  const month = normalizeMonth(requestedMonth)
  const currentMonth = currentMonthIst()
  if (month >= currentMonth) {
    throw new AppError(
      409,
      'STORE_SETTLEMENT_PERIOD_OPEN',
      'A month can be settled only after that month has ended.',
    )
  }
  if (!Types.ObjectId.isValid(actorId)) {
    throw new AppError(400, 'SETTLEMENT_ACTOR_INVALID', 'Settlement actor is invalid.')
  }

  const existing = await StoreSettlementModel.findOne({
    storeId: store._id,
    month,
  }).lean()
  if (existing) return settlementView(existing)

  const storeObjectId = new Types.ObjectId(String(store._id))
  const calculated = await calculateMonth(storeObjectId, month, money(store.commissionPercent))

  try {
    const created = await StoreSettlementModel.create({
      storeId: store._id,
      month,
      grossSales: calculated.grossSales,
      completedOrderCount: calculated.completedOrderCount,
      commissionPercent: calculated.commissionPercent,
      commissionAmount: calculated.commissionAmount,
      payableToStore: calculated.payableToStore,
      status: 'SETTLED',
      settledAt: new Date(),
      settledBy: new Types.ObjectId(actorId),
    })
    return settlementView(created.toObject())
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const concurrent = await StoreSettlementModel.findOne({
        storeId: store._id,
        month,
      }).lean()
      if (concurrent) return settlementView(concurrent)
    }
    throw error
  }
}

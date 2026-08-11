import 'dotenv/config'
import type { Types } from 'mongoose'
import '../infrastructure/database/model-registry.js'
import { env } from '../config/env.js'
import { logger } from '../core/http/logger.js'
import { connectMongo, disconnectMongo } from '../infrastructure/database/mongoose.connection.js'
import { DealerModel } from '../modules/dealers/infrastructure/dealer.models.js'
import { OrderModel, OrderStatusHistoryModel } from '../modules/orders/infrastructure/order.models.js'

const DEALER_ONLY_STATUSES = [
  'WAITING_FOR_DEALER_ASSIGNMENT',
  'AWAITING_TEAM_CONFIRMATION',
]
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED']

async function cleanupOfficialOrderDealers() {
  await connectMongo(env.MONGODB_URI, logger, {
    autoIndex: env.MONGODB_AUTO_INDEX,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  })

  try {
    const officialOrdersWithDealerStatus = await OrderModel.find({
      sellerType: 'ADMIN',
      status: { $in: DEALER_ONLY_STATUSES },
    })
      .select({ _id: 1, status: 1 })
      .lean()

    if (officialOrdersWithDealerStatus.length) {
      await OrderStatusHistoryModel.insertMany(
        officialOrdersWithDealerStatus.map((order) => ({
          orderId: order._id,
          fromStatus: order.status,
          toStatus: 'PENDING',
          note: 'Official-store order removed from the second-hand dealer workflow.',
          actorId: null,
        })),
      )
    }

    const statusResult = await OrderModel.updateMany(
      { sellerType: 'ADMIN', status: { $in: DEALER_ONLY_STATUSES } },
      { $set: { status: 'PENDING' } },
    )

    const assignmentResult = await OrderModel.updateMany(
      {
        sellerType: 'ADMIN',
        $or: [
          { assignedDealerId: { $ne: null } },
          { assignedModeratorId: { $ne: null } },
        ],
      },
      {
        $set: {
          assignedDealerId: null,
          assignedDealerName: null,
          assignedDealerPhone: null,
          dealerAssignedAt: null,
          dealerReleased: true,
          assignedModeratorId: null,
          assignedModeratorName: null,
          moderatorAssignedAt: null,
        },
      },
    )

    const activeDealerCounts = await OrderModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          sellerType: 'USER',
          assignedDealerId: { $ne: null },
          dealerReleased: { $ne: true },
          status: { $nin: TERMINAL_STATUSES },
        },
      },
      { $group: { _id: '$assignedDealerId', count: { $sum: 1 } } },
    ])

    await DealerModel.updateMany({}, { $set: { currentOpenOrders: 0 } })
    for (const entry of activeDealerCounts) {
      await DealerModel.updateOne(
        { _id: entry._id },
        { $set: { currentOpenOrders: entry.count } },
      )
    }

    logger.info(
      {
        officialStatusesReset: statusResult.modifiedCount,
        officialAssignmentsRemoved: assignmentResult.modifiedCount,
        dealersWithActiveSecondHandOrders: activeDealerCounts.length,
      },
      'Official-order dealer cleanup completed.',
    )
  } finally {
    await disconnectMongo()
  }
}

cleanupOfficialOrderDealers().catch((error) => {
  logger.error({ error }, 'Official-order dealer cleanup failed.')
  process.exitCode = 1
})

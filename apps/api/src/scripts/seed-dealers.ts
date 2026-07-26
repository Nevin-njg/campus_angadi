import 'dotenv/config'
import { connectMongo, disconnectMongo } from '../infrastructure/database/mongoose.connection.js'
import { logger } from '../core/http/logger.js'
import { env } from '../config/env.js'
import { DealerModel } from '../modules/dealers/infrastructure/dealer.models.js'
import { UserModel } from '../modules/users/infrastructure/user.models.js'

await connectMongo(env.MONGODB_URI, logger, {
  autoIndex: env.MONGODB_AUTO_INDEX,
  maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
  minPoolSize: env.MONGODB_MIN_POOL_SIZE,
  serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  const dealers = [
    {
      displayName: 'Campus Angadi Sales 01',
      phoneNumber: '+919900000001',
      email: 'mediator01@example.com',
    },
    {
      displayName: 'Campus Angadi Sales 02',
      phoneNumber: '+919900000002',
      email: 'mediator02@example.com',
    },
  ]
  for (const dealer of dealers) {
    const mediator = await UserModel.findOneAndUpdate(
      { email: dealer.email },
      {
        $setOnInsert: {
          email: dealer.email,
          emailVerified: false,
          canSell: true,
          profileCompleted: false,
        },
        $set: { role: 'MODERATOR', status: 'ACTIVE', canMediateOrders: true },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    await DealerModel.updateOne(
      { phoneNumber: dealer.phoneNumber },
      {
        $set: { mediatorUserId: mediator._id, mediatorEmail: mediator.email },
        $setOnInsert: {
          ...dealer,
          isActive: true,
          maxOpenOrders: 10,
          currentOpenOrders: 0,
          completedOrders: 0,
          workingHours: {
            timeZone: 'Asia/Kolkata',
            startTime: '00:00',
            endTime: '23:59',
            days: [0, 1, 2, 3, 4, 5, 6],
          },
          notes: 'Development dealer. Replace the number before production use.',
        },
      },
      { upsert: true },
    )
  }
  logger.info({ dealers: dealers.length }, 'Development dealers seeded')
} finally {
  await disconnectMongo()
}

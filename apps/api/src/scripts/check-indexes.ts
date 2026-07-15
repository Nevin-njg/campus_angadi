import '../infrastructure/database/model-registry.js'
import { env } from '../config/env.js'
import { logger } from '../core/http/logger.js'
import { connectMongo, disconnectMongo } from '../infrastructure/database/mongoose.connection.js'
import { IndexInspectionService } from '../modules/operations/application/index-inspection.service.js'

async function main(): Promise<void> {
  await connectMongo(env.MONGODB_URI, logger, {
    autoIndex: false,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  })
  const drift = await new IndexInspectionService().inspect()
  if (drift.length) {
    logger.error({ drift }, 'Database indexes do not match the application schemas')
    process.exitCode = 1
  } else {
    logger.info('Database indexes match the application schemas')
  }
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Index inspection failed')
    process.exitCode = 1
  })
  .finally(async () => disconnectMongo())

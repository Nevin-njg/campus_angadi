import mongoose from 'mongoose'
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
  for (const modelName of mongoose.modelNames().sort()) {
    await mongoose.model(modelName).createIndexes()
    logger.info({ model: modelName }, 'Required indexes ensured')
  }
  const drift = await new IndexInspectionService().inspect()
  const missing = drift.filter((item) => item.toCreate.length)
  if (missing.length) {
    logger.error({ missing }, 'Some required indexes could not be created')
    process.exitCode = 1
  }
  const obsolete = drift.filter((item) => item.toDrop.length)
  if (obsolete.length) {
    logger.warn(
      { obsolete },
      'Obsolete indexes were not dropped automatically; review them before manual removal',
    )
  }
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Index provisioning failed')
    process.exitCode = 1
  })
  .finally(async () => disconnectMongo())

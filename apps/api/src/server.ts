import { createApp } from './app/create-app.js'
import { createCompositionRoot } from './app/composition-root.js'
import { connectMongo, disconnectMongo } from './infrastructure/database/mongoose.connection.js'

const root = createCompositionRoot()
let shuttingDown = false

async function start(): Promise<void> {
  await connectMongo(root.env.MONGODB_URI, root.logger, {
    autoIndex: root.env.MONGODB_AUTO_INDEX,
    maxPoolSize: root.env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: root.env.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: root.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  })
  if (root.redis && root.redis.status === 'wait') await root.redis.connect()

  const app = createApp(root)
  const server = app.listen(root.env.API_PORT, () => {
    root.logger.info(
      { port: root.env.API_PORT, environment: root.env.NODE_ENV },
      `${root.env.APP_NAME} API started`,
    )
  })

  server.requestTimeout = 30_000
  server.headersTimeout = 35_000
  server.keepAliveTimeout = 5_000
  root.cleanupScheduler.start()

  const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    root.logger.info({ signal }, 'Graceful shutdown started')
    root.cleanupScheduler.stop()

    const forceTimer = setTimeout(() => {
      root.logger.error({ timeoutMs: root.env.SHUTDOWN_TIMEOUT_MS }, 'Graceful shutdown timed out')
      server.closeAllConnections()
    }, root.env.SHUTDOWN_TIMEOUT_MS)
    forceTimer.unref()

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await disconnectMongo()
      if (root.redis) await root.redis.quit()
      clearTimeout(forceTimer)
      root.logger.info('Graceful shutdown completed')
      process.exit(exitCode)
    } catch (error) {
      root.logger.error({ err: error }, 'Graceful shutdown failed')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('unhandledRejection', (error) => {
    root.logger.fatal({ err: error }, 'Unhandled promise rejection')
    void shutdown('unhandledRejection', 1)
  })
  process.on('uncaughtException', (error) => {
    root.logger.fatal({ err: error }, 'Uncaught exception')
    void shutdown('uncaughtException', 1)
  })
}

start().catch((error: unknown) => {
  root.logger.fatal({ err: error }, 'API startup failed')
  process.exit(1)
})

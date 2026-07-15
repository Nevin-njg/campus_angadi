import { Router, type RequestHandler } from 'express'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { AppError } from '../../../core/errors/app-error.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import type { CleanupScheduler } from '../application/cleanup.scheduler.js'
import type { IndexInspectionService } from '../application/index-inspection.service.js'

export function createOperationsRouter(input: {
  authenticate: RequestHandler
  cleanup: CleanupScheduler
  indexes: IndexInspectionService
  mongoReady: () => boolean
  redisReady: () => Promise<boolean>
  redisRequired: boolean
  cleanupEnabled: boolean
  cleanupIntervalMinutes: number
}) {
  const router = Router()
  router.use(input.authenticate, requireRoles('SUPER_ADMIN'))

  router.get(
    '/status',
    asyncHandler(async (_request, response) => {
      const [redisReady, indexDrift] = await Promise.all([
        input.redisReady(),
        input.indexes.inspect(),
      ])
      response.json({
        success: true,
        message: 'Operations status retrieved.',
        data: {
          mongoReady: input.mongoReady(),
          redisReady,
          redisRequired: input.redisRequired,
          cleanupEnabled: input.cleanupEnabled,
          cleanupRunning: input.cleanup.isRunning(),
          cleanupIntervalMinutes: input.cleanupIntervalMinutes,
          lastCleanup: input.cleanup.getLastResult(),
          indexDriftCount: indexDrift.length,
        },
      })
    }),
  )

  router.get(
    '/indexes',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Database index drift inspected.',
        data: await input.indexes.inspect(),
      })
    }),
  )

  router.post(
    '/cleanup',
    asyncHandler(async (_request, response) => {
      const result = await input.cleanup.run('manual')
      if (!result) {
        throw new AppError(
          409,
          'CLEANUP_ALREADY_RUNNING',
          'Cleanup is disabled or already running on another application instance.',
        )
      }
      response.json({ success: true, message: 'Cleanup completed.', data: result })
    }),
  )

  return router
}

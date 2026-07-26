import { Router } from 'express'
import { asyncHandler } from '../../core/http/async-handler.js'

export interface DependencyHealth {
  mongo: () => Promise<boolean>
  redis: () => Promise<boolean>
  redisRequired: boolean
}

export function createHealthRouter(health: DependencyHealth): Router {
  const router = Router()

  router.get('/health', (_request, response) => {
    response.json({
      success: true,
      message: 'Campus Angadi API is healthy.',
      data: { service: 'campusbaza-api', status: 'ok', timestamp: new Date().toISOString() },
    })
  })

  router.get(
    '/ready',
    asyncHandler(async (_request, response) => {
      const [mongo, redis] = await Promise.all([
        health.mongo(),
        health.redisRequired ? health.redis() : Promise.resolve(true),
      ])
      const ready = mongo && (!health.redisRequired || redis)
      response.status(ready ? 200 : 503).json({
        success: ready,
        message: ready
          ? 'Campus Angadi API is ready.'
          : 'Campus Angadi API dependencies are not ready.',
        data: {
          mongo,
          redis: health.redisRequired ? redis : 'not-required',
          status: ready ? 'ready' : 'not-ready',
        },
      })
    }),
  )

  return router
}

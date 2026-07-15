import { Router } from 'express'
import { timingSafeEqual } from 'node:crypto'
import type { MetricsRegistry } from './metrics.js'

function authorized(header: string | undefined, token: string): boolean {
  if (!token) return true
  if (!header?.startsWith('Bearer ')) return false
  const provided = Buffer.from(header.slice(7))
  const expected = Buffer.from(token)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export function createMetricsRouter(metrics: MetricsRegistry, token: string): Router {
  const router = Router()
  router.get('/metrics', (request, response) => {
    if (!authorized(request.header('authorization'), token)) {
      response.status(401).json({
        success: false,
        error: { code: 'METRICS_AUTHENTICATION_REQUIRED', message: 'Metrics access denied.' },
      })
      return
    }
    response.type('text/plain; version=0.0.4; charset=utf-8').send(metrics.render())
  })
  return router
}

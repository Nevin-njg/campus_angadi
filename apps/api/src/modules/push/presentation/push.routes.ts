import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import { validateBody } from '../../../core/middleware/validate.js'
import type {
  PushService,
  PushSubscriptionInput,
} from '../application/push.service.js'

const subscriptionSchema = z
  .object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .strict(),
  })
  .strict()

const unsubscribeSchema = z
  .object({
    endpoint: z.string().url(),
  })
  .strict()

export function createPushRouter(
  service: PushService,
  authenticate: RequestHandler,
) {
  const router = Router()

  router.use(authenticate, requireRoles('SELLER'))

  router.get(
    '/public-key',
    asyncHandler(async (_req, res) => {
      res.json({
        success: true,
        message: 'Push configuration retrieved.',
        data: service.getPublicConfiguration(),
      })
    }),
  )

  router.post(
    '/subscribe',
    validateBody(subscriptionSchema),
    asyncHandler(async (req, res) => {
      const data = await service.subscribe(
        req.auth!.user.id,
        req.body as PushSubscriptionInput,
        req.get('user-agent') ?? null,
      )

      res.status(201).json({
        success: true,
        message: 'Push notifications enabled.',
        data,
      })
    }),
  )

  router.delete(
    '/unsubscribe',
    validateBody(unsubscribeSchema),
    asyncHandler(async (req, res) => {
      const data = await service.unsubscribe(
        req.auth!.user.id,
        String(req.body.endpoint),
      )

      res.json({
        success: true,
        message: 'Push notifications disabled.',
        data,
      })
    }),
  )

  return router
}

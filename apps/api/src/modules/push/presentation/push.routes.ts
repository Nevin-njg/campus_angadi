import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import { validateBody } from '../../../core/middleware/validate.js'
import type {
  PushService,
  PushSubscriptionInput,
  SellerMobileDeviceInput,
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

const sellerMobileDeviceSchema = z
  .object({
    deviceId: z.string().min(8).max(128),
    expoPushToken: z
      .string()
      .min(20)
      .max(512)
      .regex(
        /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/,
        'Invalid Expo push token.',
      ),
    deviceName: z.string().trim().min(1).max(120),
    platform: z.enum(['android', 'ios']),
  })
  .strict()

const sellerMobileUnregisterSchema = z
  .object({
    deviceId: z.string().min(8).max(128),
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

  router.post(
    '/seller-mobile/register',
    validateBody(sellerMobileDeviceSchema),
    asyncHandler(async (req, res) => {
      const data = await service.registerSellerMobileDevice(
        req.auth!.user.id,
        req.body as SellerMobileDeviceInput,
      )

      res.status(201).json({
        success: true,
        message: 'Seller mobile device registered for push notifications.',
        data,
      })
    }),
  )

  router.get(
    '/seller-mobile/devices',
    asyncHandler(async (req, res) => {
      const data = await service.listSellerMobileDevices(req.auth!.user.id)

      res.json({
        success: true,
        message: 'Seller mobile devices retrieved.',
        data,
      })
    }),
  )

  router.delete(
    '/seller-mobile/unregister-all',
    asyncHandler(async (req, res) => {
      const data = await service.unregisterAllSellerMobileDevices(req.auth!.user.id)

      res.json({
        success: true,
        message: 'All seller mobile devices removed from push notifications.',
        data,
      })
    }),
  )

  router.delete(
    '/seller-mobile/unregister',
    validateBody(sellerMobileUnregisterSchema),
    asyncHandler(async (req, res) => {
      const data = await service.unregisterSellerMobileDevice(
        req.auth!.user.id,
        String(req.body.deviceId),
      )

      res.json({
        success: true,
        message: 'Seller mobile device removed from push notifications.',
        data,
      })
    }),
  )

  return router
}

import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import {
  notificationListQuerySchema,
  sendNotificationInputSchema,
  type NotificationListQuery,
  type SendNotificationInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import {
  getValidatedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../core/middleware/validate.js'
import type { NotificationService } from '../application/notification.service.js'
const idParams = z.object({ id: z.string().min(1) }).strict()

export function createNotificationRouter(
  service: NotificationService,
  authenticate: RequestHandler,
) {
  const router = Router()
  router.use(authenticate)
  router.get(
    '/',
    validateQuery(notificationListQuerySchema),
    asyncHandler(async (req, res) => {
      const result = await service.list(
        req.auth!.user.id,
        getValidatedQuery<NotificationListQuery>(req),
      )
      res.json({
        success: true,
        message: 'Notifications retrieved.',
        data: result.items,
        meta: result.meta,
      })
    }),
  )
  router.get(
    '/unread-count',
    asyncHandler(async (req, res) => {
      res.json({
        success: true,
        message: 'Unread count retrieved.',
        data: { count: await service.unreadCount(req.auth!.user.id) },
      })
    }),
  )
  router.patch(
    '/read-all',
    asyncHandler(async (req, res) => {
      await service.markAllRead(req.auth!.user.id)
      res.json({ success: true, message: 'All notifications marked as read.', data: null })
    }),
  )
  router.patch(
    '/:id/read',
    validateParams(idParams),
    asyncHandler(async (req, res) => {
      res.json({
        success: true,
        message: 'Notification marked as read.',
        data: await service.markRead(req.auth!.user.id, String(req.params.id)),
      })
    }),
  )
  return router
}

export function createAdminNotificationRouter(
  service: NotificationService,
  authenticate: RequestHandler,
) {
  const router = Router()
  router.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'))
  router.post(
    '/',
    validateBody(sendNotificationInputSchema),
    asyncHandler(async (req, res) => {
      const count = await service.send(req.body as SendNotificationInput)
      res
        .status(201)
        .json({ success: true, message: 'Notification sent.', data: { recipientCount: count } })
    }),
  )
  return router
}

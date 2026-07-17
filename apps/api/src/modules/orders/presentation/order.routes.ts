import { Router, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import {
  adminOrderListQuerySchema,
  assignOrderDealerInputSchema,
  assignOrderModeratorInputSchema,
  cancelOrderInputSchema,
  checkoutInputSchema,
  orderListQuerySchema,
  updateOrderStatusInputSchema,
  type AdminOrderListQuery,
  type AssignOrderDealerInput,
  type AssignOrderModeratorInput,
  type CancelOrderInput,
  type CheckoutInput,
  type OrderListQuery,
  type UpdateOrderStatusInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import {
  getValidatedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../core/middleware/validate.js'
import {
  rateLimitStoreOption,
  type RateLimitStoreFactory,
} from '../../../core/rate-limit/rate-limit-store.factory.js'
import type { OrderService } from '../application/order.service.js'

const idParams = z.object({ id: z.string().min(1) }).strict()

export function createOrderRouter(
  service: OrderService,
  authenticate: RequestHandler,
  storeFactory: RateLimitStoreFactory,
) {
  const router = Router()
  const checkoutLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    ...rateLimitStoreOption(storeFactory, 'orders-checkout'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
  router.use(authenticate)
  router.post(
    '/checkout',
    checkoutLimiter,
    validateBody(checkoutInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.checkout(request.auth!.user.id, request.body as CheckoutInput)
      response.status(201).json({ success: true, message: 'Orders created successfully.', data })
    }),
  )
  router.get(
    '/',
    validateQuery(orderListQuerySchema),
    asyncHandler(async (request, response) => {
      const result = await service.listOwned(
        request.auth!.user.id,
        getValidatedQuery<OrderListQuery>(request),
      )
      response.json({
        success: true,
        message: 'Orders retrieved successfully.',
        data: result.items,
        meta: result.meta,
      })
    }),
  )
  router.get(
    '/:id',
    validateParams(idParams),
    asyncHandler(async (request, response) => {
      const data = await service.getOwned(String(request.params.id), request.auth!.user.id)
      response.json({ success: true, message: 'Order retrieved successfully.', data })
    }),
  )
  router.post(
    '/:id/cancel',
    validateParams(idParams),
    validateBody(cancelOrderInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.cancelOwned(
        String(request.params.id),
        request.auth!.user.id,
        request.body as CancelOrderInput,
      )
      response.json({ success: true, message: 'Order cancelled successfully.', data })
    }),
  )
  return router
}

export function createAdminOrderRouter(service: OrderService, authenticate: RequestHandler) {
  const router = Router()
  router.use(authenticate)
  router.get(
    '/',
    requireRoles('MODERATOR', 'ADMIN', 'SUPER_ADMIN'),
    validateQuery(adminOrderListQuerySchema),
    asyncHandler(async (request, response) => {
      const result = await service.listAdmin(getValidatedQuery<AdminOrderListQuery>(request), {
        id: request.auth!.user.id,
        role: request.auth!.user.role,
      })
      response.json({
        success: true,
        message: 'Orders retrieved successfully.',
        data: result.items,
        meta: result.meta,
      })
    }),
  )
  router.get(
    '/:id',
    requireRoles('MODERATOR', 'ADMIN', 'SUPER_ADMIN'),
    validateParams(idParams),
    asyncHandler(async (request, response) => {
      const data = await service.getAdmin(String(request.params.id), {
        id: request.auth!.user.id,
        role: request.auth!.user.role,
      })
      response.json({ success: true, message: 'Order retrieved successfully.', data })
    }),
  )
  router.patch(
    '/:id/dealer',
    requireRoles('ADMIN', 'SUPER_ADMIN'),
    validateParams(idParams),
    validateBody(assignOrderDealerInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.assignDealer(
        String(request.params.id),
        request.auth!.user.id,
        request.body as AssignOrderDealerInput,
      )
      response.json({ success: true, message: 'Dealer assignment updated.', data })
    }),
  )
  router.patch(
    '/:id/moderator',
    requireRoles('ADMIN', 'SUPER_ADMIN'),
    validateParams(idParams),
    validateBody(assignOrderModeratorInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.assignModerator(
        String(request.params.id),
        request.auth!.user.id,
        request.body as AssignOrderModeratorInput,
      )
      response.json({ success: true, message: 'Moderator assignment updated.', data })
    }),
  )
  router.patch(
    '/:id/status',
    requireRoles('ADMIN', 'SUPER_ADMIN'),
    validateParams(idParams),
    validateBody(updateOrderStatusInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.updateStatus(
        String(request.params.id),
        request.auth!.user.id,
        request.body as UpdateOrderStatusInput,
      )
      response.json({ success: true, message: 'Order status updated.', data })
    }),
  )
  return router
}

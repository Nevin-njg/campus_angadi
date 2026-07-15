import { Router, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  addCartItemInputSchema,
  updateCartItemInputSchema,
  type AddCartItemInput,
  type UpdateCartItemInput,
} from '@campusbaza/contracts'
import { z } from 'zod'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { validateBody, validateParams } from '../../../core/middleware/validate.js'
import {
  rateLimitStoreOption,
  type RateLimitStoreFactory,
} from '../../../core/rate-limit/rate-limit-store.factory.js'
import type { CartService } from '../application/cart.service.js'

const productParams = z.object({ productId: z.string().min(1) }).strict()

export function createCartRouter(
  service: CartService,
  authenticate: RequestHandler,
  storeFactory: RateLimitStoreFactory,
) {
  const router = Router()
  const writeLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 120,
    ...rateLimitStoreOption(storeFactory, 'cart-write'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
  router.use(authenticate)
  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const data = await service.get(request.auth!.user.id)
      response.json({ success: true, message: 'Cart retrieved successfully.', data })
    }),
  )
  router.post(
    '/items',
    writeLimiter,
    validateBody(addCartItemInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.add(request.auth!.user.id, request.body as AddCartItemInput)
      response.status(201).json({ success: true, message: 'Product added to cart.', data })
    }),
  )
  router.patch(
    '/items/:productId',
    writeLimiter,
    validateParams(productParams),
    validateBody(updateCartItemInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.update(
        request.auth!.user.id,
        String(request.params.productId),
        request.body as UpdateCartItemInput,
      )
      response.json({ success: true, message: 'Cart quantity updated.', data })
    }),
  )
  router.delete(
    '/items/:productId',
    writeLimiter,
    validateParams(productParams),
    asyncHandler(async (request, response) => {
      const data = await service.remove(request.auth!.user.id, String(request.params.productId))
      response.json({ success: true, message: 'Product removed from cart.', data })
    }),
  )
  router.post(
    '/review',
    writeLimiter,
    asyncHandler(async (request, response) => {
      const data = await service.review(request.auth!.user.id)
      response.json({ success: true, message: 'Cart changes accepted.', data })
    }),
  )
  router.delete(
    '/',
    writeLimiter,
    asyncHandler(async (request, response) => {
      const data = await service.clear(request.auth!.user.id)
      response.json({ success: true, message: 'Cart cleared.', data })
    }),
  )
  return router
}

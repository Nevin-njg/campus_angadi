import { Router, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import {
  adminModerationQuerySchema,
  createSecondHandListingInputSchema,
  moderateProductInputSchema,
  updateSecondHandListingInputSchema,
  userListingQuerySchema,
  type AdminModerationQuery,
  type CreateSecondHandListingInput,
  type ModerateProductInput,
  type UpdateSecondHandListingInput,
  type UserListingQuery,
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
import type { ListingService } from '../application/listing.service.js'

const idParams = z.object({ id: z.string().min(1) }).strict()

export function createListingRouter(
  service: ListingService,
  authenticate: RequestHandler,
  storeFactory: RateLimitStoreFactory,
): Router {
  const router = Router()
  const writeLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 30,
    ...rateLimitStoreOption(storeFactory, 'listings-write'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
  router.use(authenticate)
  router.get(
    '/',
    validateQuery(userListingQuerySchema),
    asyncHandler(async (request, response) => {
      const result = await service.listMine(
        request.auth!.user.id,
        getValidatedQuery<UserListingQuery>(request),
      )
      response.json({
        success: true,
        message: 'Your listings were retrieved.',
        data: result.items,
        meta: result.meta,
      })
    }),
  )
  router.get(
    '/:id',
    validateParams(idParams),
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Listing retrieved.',
        data: await service.getMine(request.auth!.user.id, String(request.params.id)),
      })
    }),
  )
  router.post(
    '/',
    writeLimiter,
    validateBody(createSecondHandListingInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.create(
        request.auth!.user.id,
        request.body as CreateSecondHandListingInput,
      )
      response.status(201).json({ success: true, message: 'Listing submitted for review.', data })
    }),
  )
  router.patch(
    '/:id',
    writeLimiter,
    validateParams(idParams),
    validateBody(updateSecondHandListingInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.update(
        request.auth!.user.id,
        String(request.params.id),
        request.body as UpdateSecondHandListingInput,
      )
      response.json({ success: true, message: 'Listing resubmitted for review.', data })
    }),
  )
  router.delete(
    '/:id',
    writeLimiter,
    validateParams(idParams),
    asyncHandler(async (request, response) => {
      const data = await service.remove(request.auth!.user.id, String(request.params.id))
      response.json({ success: true, message: 'Listing deleted.', data })
    }),
  )
  router.post(
    '/:id/mark-sold',
    writeLimiter,
    validateParams(idParams),
    asyncHandler(async (request, response) => {
      const data = await service.markSold(request.auth!.user.id, String(request.params.id))
      response.json({ success: true, message: 'Listing marked as sold.', data })
    }),
  )
  return router
}

export function createAdminModerationRouter(
  service: ListingService,
  authenticate: RequestHandler,
): Router {
  const router = Router()
  router.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'))
  router.get(
    '/',
    validateQuery(adminModerationQuerySchema),
    asyncHandler(async (request, response) => {
      const result = await service.listModeration(getValidatedQuery<AdminModerationQuery>(request))
      response.json({
        success: true,
        message: 'Moderation queue retrieved.',
        data: result.items,
        meta: result.meta,
      })
    }),
  )
  router.get(
    '/:id',
    validateParams(idParams),
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Moderation listing retrieved.',
        data: await service.getModeration(String(request.params.id)),
      })
    }),
  )
  router.post(
    '/:id/decision',
    validateParams(idParams),
    validateBody(moderateProductInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.moderate(
        request.auth!.user.id,
        String(request.params.id),
        request.body as ModerateProductInput,
      )
      response.json({ success: true, message: 'Moderation decision saved.', data })
    }),
  )
  return router
}

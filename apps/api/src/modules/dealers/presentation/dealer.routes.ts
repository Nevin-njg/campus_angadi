import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import {
  createDealerInputSchema,
  dealerListQuerySchema,
  updateDealerInputSchema,
  type CreateDealerInput,
  type DealerListQuery,
  type UpdateDealerInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import {
  getValidatedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../core/middleware/validate.js'
import type { DealerService } from '../application/dealer.service.js'

const idParams = z.object({ id: z.string().min(1) }).strict()

export function createAdminDealerRouter(service: DealerService, authenticate: RequestHandler) {
  const router = Router()
  router.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'))
  router.get(
    '/',
    validateQuery(dealerListQuerySchema),
    asyncHandler(async (request, response) => {
      const result = await service.list(getValidatedQuery<DealerListQuery>(request))
      response.json({
        success: true,
        message: 'Dealers retrieved.',
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
        message: 'Dealer retrieved.',
        data: await service.get(String(request.params.id)),
      })
    }),
  )
  router.post(
    '/',
    validateBody(createDealerInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.create(request.body as CreateDealerInput)
      response.status(201).json({ success: true, message: 'Dealer created.', data })
    }),
  )
  router.patch(
    '/:id',
    validateParams(idParams),
    validateBody(updateDealerInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.update(
        String(request.params.id),
        request.body as UpdateDealerInput,
      )
      response.json({ success: true, message: 'Dealer updated.', data })
    }),
  )
  router.delete(
    '/:id',
    validateParams(idParams),
    asyncHandler(async (request, response) => {
      await service.remove(String(request.params.id))
      response.json({ success: true, message: 'Dealer removed.', data: null })
    }),
  )
  return router
}

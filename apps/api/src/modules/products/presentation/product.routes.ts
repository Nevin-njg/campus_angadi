import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import {
  adminProductListQuerySchema,
  createOfficialProductInputSchema,
  productListQuerySchema,
  updateOfficialProductInputSchema,
  type AdminProductListQuery,
  type CreateOfficialProductInput,
  type ProductListQuery,
  type UpdateOfficialProductInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import {
  getValidatedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../core/middleware/validate.js'
import type { ProductService } from '../application/product.service.js'

const slugParams = z.object({ slug: z.string().trim().min(1).max(120) }).strict()
const idParams = z.object({ id: z.string().min(1) }).strict()

export function createProductRouter(service: ProductService): Router {
  const router = Router()
  router.get(
    '/',
    validateQuery(productListQuerySchema),
    asyncHandler(async (request, response) => {
      const result = await service.listPublic(getValidatedQuery<ProductListQuery>(request))
      response.json({
        success: true,
        message: 'Products retrieved.',
        data: result.items,
        meta: result.meta,
      })
    }),
  )
  router.get(
    '/:slug',
    validateParams(slugParams),
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Product retrieved.',
        data: await service.getPublic(String(request.params.slug)),
      })
    }),
  )
  return router
}

export function createAdminProductRouter(
  service: ProductService,
  authenticate: RequestHandler,
): Router {
  const router = Router()
  router.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'))
  router.get(
    '/',
    validateQuery(adminProductListQuerySchema),
    asyncHandler(async (request, response) => {
      const result = await service.listAdmin(getValidatedQuery<AdminProductListQuery>(request))
      response.json({
        success: true,
        message: 'Products retrieved.',
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
        message: 'Product retrieved.',
        data: await service.getAdmin(String(request.params.id)),
      })
    }),
  )
  router.post(
    '/',
    validateBody(createOfficialProductInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.createOfficial(
        request.body as CreateOfficialProductInput,
        request.auth!.user.id,
      )
      response.status(201).json({ success: true, message: 'Official product created.', data })
    }),
  )
  router.patch(
    '/:id',
    validateParams(idParams),
    validateBody(updateOfficialProductInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.updateOfficial(
        String(request.params.id),
        request.body as UpdateOfficialProductInput,
      )
      response.json({ success: true, message: 'Official product updated.', data })
    }),
  )
  return router
}

import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import {
  createCategoryInputSchema,
  updateCategoryInputSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import { validateBody, validateParams } from '../../../core/middleware/validate.js'
import type { CategoryService } from '../application/category.service.js'

const idParams = z.object({ id: z.string().min(1) }).strict()

export function createCategoryRouter(service: CategoryService): Router {
  const router = Router()
  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Categories retrieved.',
        data: await service.listPublic(),
      })
    }),
  )
  return router
}

export function createAdminCategoryRouter(
  service: CategoryService,
  authenticate: RequestHandler,
): Router {
  const router = Router()
  router.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'))
  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Categories retrieved.',
        data: await service.listAdmin(),
      })
    }),
  )
  router.post(
    '/',
    validateBody(createCategoryInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.create(request.body as CreateCategoryInput)
      response.status(201).json({ success: true, message: 'Category created.', data })
    }),
  )
  router.patch(
    '/:id',
    validateParams(idParams),
    validateBody(updateCategoryInputSchema),
    asyncHandler(async (request, response) => {
      const data = await service.update(
        String(request.params.id),
        request.body as UpdateCategoryInput,
      )
      response.json({ success: true, message: 'Category updated.', data })
    }),
  )
  router.delete(
    '/:id',
    validateParams(idParams),
    asyncHandler(async (request, response) => {
      await service.remove(String(request.params.id))
      response.json({ success: true, message: 'Category removed.', data: null })
    }),
  )
  return router
}

import {
  createHomepageSectionInputSchema,
  updateHomepageSectionInputSchema,
  type CreateHomepageSectionInput,
  type UpdateHomepageSectionInput,
} from '@campusbaza/contracts'
import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import {
  validateBody,
  validateParams,
} from '../../../core/middleware/validate.js'
import type { DynamicHomepageService } from '../application/dynamic-homepage.service.js'

const sectionIdParams = z
  .object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  })
  .strict()

export function createDynamicHomepageRouter(
  service: DynamicHomepageService,
): Router {
  const router = Router()

  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Dynamic homepage retrieved.',
        data: await service.getPublic(),
      })
    }),
  )

  return router
}

export function createAdminDynamicHomepageRouter(
  service: DynamicHomepageService,
  authenticate: RequestHandler,
): Router {
  const router = Router()

  router.use(
    authenticate,
    requireRoles('ADMIN', 'SUPER_ADMIN'),
  )

  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Dynamic homepage configuration retrieved.',
        data: await service.getAdminConfiguration(),
      })
    }),
  )

  router.post(
    '/sections',
    validateBody(createHomepageSectionInputSchema),
    asyncHandler(async (request, response) => {
      const input = request.body as CreateHomepageSectionInput

      const data = await service.createSection(
        input,
        request.auth!.user.id,
      )

      response.status(201).json({
        success: true,
        message: 'Homepage section created.',
        data,
      })
    }),
  )

  router.patch(
    '/sections/:id',
    validateParams(sectionIdParams),
    validateBody(updateHomepageSectionInputSchema),
    asyncHandler(async (request, response) => {
      const input = request.body as UpdateHomepageSectionInput

      const data = await service.updateSection(
        String(request.params.id),
        input,
        request.auth!.user.id,
      )

      response.json({
        success: true,
        message: 'Homepage section updated.',
        data,
      })
    }),
  )

  router.delete(
    '/sections/:id',
    validateParams(sectionIdParams),
    asyncHandler(async (request, response) => {
      const data = await service.removeSection(
        String(request.params.id),
      )

      response.json({
        success: true,
        message: 'Homepage section removed.',
        data,
      })
    }),
  )

  return router
}

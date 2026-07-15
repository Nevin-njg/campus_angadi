import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import {
  homepageSectionKeySchema,
  homepageSelectionInputSchema,
  type HomepageSectionKey,
  type HomepageSelectionInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import { validateBody, validateParams } from '../../../core/middleware/validate.js'
import type { HomepageService } from '../application/homepage.service.js'

const sectionParams = z.object({ section: homepageSectionKeySchema }).strict()

export function createHomepageRouter(service: HomepageService): Router {
  const router = Router()
  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Homepage retrieved.',
        data: await service.getPublic(),
      })
    }),
  )
  return router
}

export function createAdminHomepageRouter(
  service: HomepageService,
  authenticate: RequestHandler,
): Router {
  const router = Router()
  router.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'))
  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Homepage configuration retrieved.',
        data: await service.getAdminConfiguration(),
      })
    }),
  )
  router.put(
    '/:section',
    validateParams(sectionParams),
    validateBody(homepageSelectionInputSchema),
    asyncHandler(async (request, response) => {
      const input = request.body as HomepageSelectionInput
      const data = await service.updateSelection(
        String(request.params.section) as HomepageSectionKey,
        input.productIds,
        request.auth!.user.id,
      )
      response.json({ success: true, message: 'Homepage section updated.', data })
    }),
  )
  router.delete(
    '/:section',
    validateParams(sectionParams),
    asyncHandler(async (request, response) => {
      const data = await service.resetSelection(
        String(request.params.section) as HomepageSectionKey,
        request.auth!.user.id,
      )
      response.json({ success: true, message: 'Homepage section reset to automatic.', data })
    }),
  )
  return router
}

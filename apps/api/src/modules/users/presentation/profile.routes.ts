import { Router, type RequestHandler } from 'express'
import { updateProfileInputSchema, type UpdateProfileInput } from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { validateBody } from '../../../core/middleware/validate.js'
import type { ProfileService } from '../application/profile.service.js'

export function createProfileRouter(profile: ProfileService, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const user = await profile.getProfile(request.auth!.user.id)
      response.json({ success: true, message: 'Profile retrieved successfully.', data: { user } })
    }),
  )

  router.patch(
    '/',
    validateBody(updateProfileInputSchema),
    asyncHandler(async (request, response) => {
      const user = await profile.updateProfile(
        request.auth!.user.id,
        request.body as UpdateProfileInput,
      )
      response.json({ success: true, message: 'Profile updated successfully.', data: { user } })
    }),
  )

  return router
}

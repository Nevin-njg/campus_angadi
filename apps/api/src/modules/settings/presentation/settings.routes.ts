import { Router, type RequestHandler } from 'express'
import {
  updatePlatformSettingsInputSchema,
  type UpdatePlatformSettingsInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import { validateBody } from '../../../core/middleware/validate.js'
import type { SettingsService } from '../application/settings.service.js'
export function createSettingsRouter(s: SettingsService) {
  const r = Router()
  r.get(
    '/public',
    asyncHandler(async (_q, p) => {
      p.json({ success: true, message: 'Settings retrieved.', data: await s.getPublic() })
    }),
  )
  return r
}
export function createAdminSettingsRouter(s: SettingsService, a: RequestHandler) {
  const r = Router()
  r.use(a, requireRoles('ADMIN', 'SUPER_ADMIN'))
  r.get(
    '/',
    asyncHandler(async (_q, p) => {
      p.json({ success: true, message: 'Settings retrieved.', data: await s.getAdmin() })
    }),
  )
  r.patch(
    '/',
    validateBody(updatePlatformSettingsInputSchema),
    asyncHandler(async (q, p) => {
      p.json({
        success: true,
        message: 'Settings updated.',
        data: await s.update(q.body as UpdatePlatformSettingsInput),
      })
    }),
  )
  return r
}

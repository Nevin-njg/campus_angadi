import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import {
  adminUserListQuerySchema,
  salesAnalyticsQuerySchema,
  updateAdminUserInputSchema,
  type AdminUserListQuery,
  type SalesAnalyticsQuery,
  type UpdateAdminUserInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import {
  getValidatedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../core/middleware/validate.js'
import type { AdminService } from '../application/admin.service.js'
const id = z.object({ id: z.string().min(1) }).strict()
export function createAdminCoreRouter(s: AdminService, a: RequestHandler) {
  const r = Router()
  r.use(a, requireRoles('ADMIN', 'SUPER_ADMIN'))
  r.get(
    '/dashboard',
    asyncHandler(async (_q, p) => {
      p.json({ success: true, message: 'Dashboard retrieved.', data: await s.dashboard() })
    }),
  )
  r.get(
    '/users',
    validateQuery(adminUserListQuerySchema),
    asyncHandler(async (q, p) => {
      const x = await s.listUsers(getValidatedQuery<AdminUserListQuery>(q))
      p.json({ success: true, message: 'Users retrieved.', data: x.items, meta: x.meta })
    }),
  )
  r.get(
    '/users/:id',
    validateParams(id),
    asyncHandler(async (q, p) => {
      p.json({
        success: true,
        message: 'User retrieved.',
        data: await s.getUser(String(q.params.id)),
      })
    }),
  )
  r.patch(
    '/users/:id',
    validateParams(id),
    validateBody(updateAdminUserInputSchema),
    asyncHandler(async (q, p) => {
      p.json({
        success: true,
        message: 'User updated.',
        data: await s.updateUser(
          { id: q.auth!.user.id, role: q.auth!.user.role },
          String(q.params.id),
          q.body as UpdateAdminUserInput,
        ),
      })
    }),
  )
  r.get(
    '/sales',
    validateQuery(salesAnalyticsQuerySchema),
    asyncHandler(async (q, p) => {
      p.json({
        success: true,
        message: 'Sales analytics retrieved.',
        data: await s.sales(getValidatedQuery<SalesAnalyticsQuery>(q)),
      })
    }),
  )
  return r
}

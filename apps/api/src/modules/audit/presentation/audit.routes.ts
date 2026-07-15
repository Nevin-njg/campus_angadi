import { Router, type RequestHandler } from 'express'
import { auditLogQuerySchema, type AuditLogQuery } from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import { getValidatedQuery, validateQuery } from '../../../core/middleware/validate.js'
import type { AuditService } from '../application/audit.service.js'
export function createAdminAuditRouter(s: AuditService, a: RequestHandler) {
  const r = Router()
  r.use(a, requireRoles('ADMIN', 'SUPER_ADMIN'))
  r.get(
    '/',
    validateQuery(auditLogQuerySchema),
    asyncHandler(async (q, p) => {
      const x = await s.list(getValidatedQuery<AuditLogQuery>(q))
      p.json({ success: true, message: 'Audit logs retrieved.', data: x.items, meta: x.meta })
    }),
  )
  return r
}

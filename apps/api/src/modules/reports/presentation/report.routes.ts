import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import {
  createReportInputSchema,
  reportListQuerySchema,
  updateReportInputSchema,
  type CreateReportInput,
  type ReportListQuery,
  type UpdateReportInput,
} from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import {
  getValidatedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../core/middleware/validate.js'
import type { ReportService } from '../application/report.service.js'
const id = z.object({ id: z.string().min(1) }).strict()
export function createReportRouter(s: ReportService, a: RequestHandler) {
  const r = Router()
  r.use(a)
  r.post(
    '/',
    validateBody(createReportInputSchema),
    asyncHandler(async (q, p) => {
      p.status(201).json({
        success: true,
        message: 'Report submitted.',
        data: await s.create(q.auth!.user.id, q.body as CreateReportInput),
      })
    }),
  )
  r.get(
    '/',
    validateQuery(reportListQuerySchema),
    asyncHandler(async (q, p) => {
      const x = await s.listMine(q.auth!.user.id, getValidatedQuery<ReportListQuery>(q))
      p.json({ success: true, message: 'Reports retrieved.', data: x.items, meta: x.meta })
    }),
  )
  return r
}
export function createAdminReportRouter(s: ReportService, a: RequestHandler) {
  const r = Router()
  r.use(a, requireRoles('ADMIN', 'SUPER_ADMIN'))
  r.get(
    '/',
    validateQuery(reportListQuerySchema),
    asyncHandler(async (q, p) => {
      const x = await s.listAdmin(getValidatedQuery<ReportListQuery>(q))
      p.json({ success: true, message: 'Reports retrieved.', data: x.items, meta: x.meta })
    }),
  )
  r.get(
    '/:id',
    validateParams(id),
    asyncHandler(async (q, p) => {
      p.json({
        success: true,
        message: 'Report retrieved.',
        data: await s.getAdmin(String(q.params.id)),
      })
    }),
  )
  r.patch(
    '/:id',
    validateParams(id),
    validateBody(updateReportInputSchema),
    asyncHandler(async (q, p) => {
      p.json({
        success: true,
        message: 'Report updated.',
        data: await s.update(String(q.params.id), q.auth!.user.id, q.body as UpdateReportInput),
      })
    }),
  )
  return r
}

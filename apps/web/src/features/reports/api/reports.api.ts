import type {
  CreateReportInput,
  PaginatedResult,
  Report,
  ReportListQuery,
} from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'
function qs(q: ReportListQuery) {
  const p = new URLSearchParams({ page: String(q.page), limit: String(q.limit) })
  if (q.status) p.set('status', q.status)
  if (q.targetType) p.set('targetType', q.targetType)
  if (q.q) p.set('q', q.q)
  return `?${p}`
}
export const reportsApi = {
  create: (input: CreateReportInput) =>
    apiRequest<Report>('/reports', { method: 'POST', body: input }),
  async list(q: ReportListQuery): Promise<PaginatedResult<Report>> {
    const r = await apiRequestEnvelope<Report[]>(`/reports${qs(q)}`)
    return { items: r.data, meta: r.meta! }
  },
}

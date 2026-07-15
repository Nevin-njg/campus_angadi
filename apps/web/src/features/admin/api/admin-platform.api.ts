import type {
  AdminDashboard,
  AdminUserDetail,
  AdminUserListQuery,
  AdminUserSummary,
  AuditLog,
  AuditLogQuery,
  PaginatedResult,
  PlatformSettings,
  OperationsStatus,
  CleanupResult,
  IndexDrift,
  Report,
  ReportListQuery,
  SalesAnalytics,
  SalesAnalyticsQuery,
  SendNotificationInput,
  UpdateAdminUserInput,
  UpdatePlatformSettingsInput,
  UpdateReportInput,
} from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'
function qs(input: Record<string, unknown>) {
  const p = new URLSearchParams()
  Object.entries(input).forEach(([k, v]) => {
    if (typeof v === 'string' && v) p.set(k, v)
    else if (typeof v === 'number' || typeof v === 'boolean') p.set(k, String(v))
  })
  return p.toString() ? `?${p}` : ''
}
async function paged<T>(path: string): Promise<PaginatedResult<T>> {
  const r = await apiRequestEnvelope<T[]>(path)
  return { items: r.data, meta: r.meta! }
}
export const adminPlatformApi = {
  dashboard: () => apiRequest<AdminDashboard>('/admin/dashboard'),
  users: (q: AdminUserListQuery) => paged<AdminUserSummary>(`/admin/users${qs(q)}`),
  user: (id: string) => apiRequest<AdminUserDetail>(`/admin/users/${id}`),
  updateUser: (id: string, input: UpdateAdminUserInput) =>
    apiRequest<AdminUserDetail>(`/admin/users/${id}`, { method: 'PATCH', body: input }),
  sales: (q: SalesAnalyticsQuery) => apiRequest<SalesAnalytics>(`/admin/sales${qs(q)}`),
  reports: (q: ReportListQuery) => paged<Report>(`/admin/reports${qs(q)}`),
  updateReport: (id: string, input: UpdateReportInput) =>
    apiRequest<Report>(`/admin/reports/${id}`, { method: 'PATCH', body: input }),
  audit: (q: AuditLogQuery) => paged<AuditLog>(`/admin/audit-logs${qs(q)}`),
  settings: () => apiRequest<PlatformSettings>('/admin/settings'),
  updateSettings: (input: UpdatePlatformSettingsInput) =>
    apiRequest<PlatformSettings>('/admin/settings', { method: 'PATCH', body: input }),
  sendNotification: (input: SendNotificationInput) =>
    apiRequest<{ recipientCount: number }>('/admin/notifications', { method: 'POST', body: input }),
  operationsStatus: () => apiRequest<OperationsStatus>('/admin/operations/status'),
  operationIndexes: () => apiRequest<IndexDrift[]>('/admin/operations/indexes'),
  runCleanup: () => apiRequest<CleanupResult>('/admin/operations/cleanup', { method: 'POST' }),
}

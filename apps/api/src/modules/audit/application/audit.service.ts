import type { AuditLog, AuditLogQuery, PaginatedResult } from '@campusbaza/contracts'
import { AuditLogModel } from '../infrastructure/audit-log.model.js'
function escapeRegex(v: string) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function map(d: Record<string, unknown>): AuditLog {
  return {
    id: String(d._id),
    actorId: String(d.actorId),
    actorLabel: String(d.actorLabel),
    action: String(d.action),
    entityType: String(d.entityType),
    entityId: (d.entityId as string | null) ?? null,
    requestMethod: String(d.requestMethod),
    requestPath: String(d.requestPath),
    ipAddress: (d.ipAddress as string | null) ?? null,
    userAgent: (d.userAgent as string | null) ?? null,
    createdAt: (d.createdAt as Date).toISOString(),
  }
}
export class AuditService {
  async record(input: Omit<AuditLog, 'id' | 'createdAt'>) {
    await AuditLogModel.create(input)
  }
  async list(q: AuditLogQuery): Promise<PaginatedResult<AuditLog>> {
    const f: Record<string, unknown> = {}
    if (q.actorId) f.actorId = q.actorId
    if (q.entityType) f.entityType = q.entityType
    if (q.q) {
      const r = new RegExp(escapeRegex(q.q), 'i')
      f.$or = [{ action: r }, { actorLabel: r }, { requestPath: r }, { entityId: r }]
    }
    const [d, t] = await Promise.all([
      AuditLogModel.find(f)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<Record<string, unknown>[]>(),
      AuditLogModel.countDocuments(f),
    ])
    return {
      items: d.map(map),
      meta: { page: q.page, limit: q.limit, total: t, totalPages: Math.ceil(t / q.limit) },
    }
  }
}

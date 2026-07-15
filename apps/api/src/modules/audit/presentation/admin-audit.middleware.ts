import type { NextFunction, Request, Response } from 'express'
import type { AuditService } from '../application/audit.service.js'
export function createAdminAuditMiddleware(service: AuditService) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      next()
      return
    }
    const actor = request.auth?.user
    if (!actor) {
      next()
      return
    }
    response.on('finish', () => {
      if (response.statusCode >= 400) return
      const parts = request.path.split('/').filter(Boolean)
      const entityType = parts[0] ?? 'admin'
      const candidate = parts[1]
      const entityId =
        candidate && !['decision', 'status', 'read-all'].includes(candidate) ? candidate : null
      void service.record({
        actorId: actor.id,
        actorLabel: actor.profile.displayName ?? actor.email,
        action: `${request.method} ${request.path}`,
        entityType,
        entityId,
        requestMethod: request.method,
        requestPath: request.originalUrl,
        ipAddress: request.ip ?? null,
        userAgent: request.get('user-agent') ?? null,
      })
    })
    next()
  }
}

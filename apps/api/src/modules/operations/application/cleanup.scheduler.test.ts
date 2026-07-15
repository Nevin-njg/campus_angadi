import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { MetricsRegistry } from '../../../core/observability/metrics.js'
import type { CleanupService } from './cleanup.service.js'
import { CleanupScheduler } from './cleanup.scheduler.js'

describe('CleanupScheduler', () => {
  it('runs a cleanup locally and exposes the last successful result', async () => {
    const result = {
      staleUploads: 1,
      readNotifications: 2,
      revokedSessions: 3,
      auditLogs: 4,
      expiredListings: 5,
      durationMs: 10,
      success: true,
      completedAt: new Date().toISOString(),
    }
    const service = { run: async () => result } as unknown as CleanupService
    const scheduler = new CleanupScheduler(
      service,
      null,
      new MetricsRegistry(),
      pino({ enabled: false }),
      { enabled: true, runOnStart: false, intervalMinutes: 60, lockTtlSeconds: 120 },
    )

    await expect(scheduler.run('manual')).resolves.toEqual(result)
    expect(scheduler.getLastResult()).toEqual(result)
    expect(scheduler.isRunning()).toBe(false)
  })
})

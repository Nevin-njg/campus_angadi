import { describe, expect, it } from 'vitest'
import { MetricsRegistry } from './metrics.js'

describe('MetricsRegistry', () => {
  it('renders process, request and cleanup metrics without sensitive request data', () => {
    const metrics = new MetricsRegistry()
    metrics.observeCleanup({
      staleUploads: 2,
      readNotifications: 3,
      revokedSessions: 1,
      auditLogs: 4,
      expiredListings: 1,
      durationMs: 250,
      success: true,
    })
    const output = metrics.render()
    expect(output).toContain('campusbaza_process_uptime_seconds')
    expect(output).toContain('campusbaza_cleanup_runs_total 1')
    expect(output).toContain('campusbaza_cleanup_last_affected_records 11')
    expect(output).not.toContain('authorization')
  })
})

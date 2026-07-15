import { randomUUID } from 'node:crypto'
import type Redis from 'ioredis'
import type { Logger } from 'pino'
import type { CleanupResult } from '@campusbaza/contracts'
import type { MetricsRegistry } from '../../../core/observability/metrics.js'
import type { CleanupService } from './cleanup.service.js'

const refreshLockScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return 0
`

const releaseLockScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

export class CleanupScheduler {
  private timer: NodeJS.Timeout | null = null
  private localRunning = false
  private lockRefreshTimer: NodeJS.Timeout | null = null
  private lastResult: CleanupResult | null = null

  constructor(
    private readonly service: CleanupService,
    private readonly redis: Redis | null,
    private readonly metrics: MetricsRegistry,
    private readonly logger: Logger,
    private readonly options: {
      enabled: boolean
      runOnStart: boolean
      intervalMinutes: number
      lockTtlSeconds: number
    },
  ) {}

  start(): void {
    if (!this.options.enabled || this.timer) return
    if (this.options.runOnStart) {
      setTimeout(() => void this.run('startup'), 1_000).unref()
    }
    this.timer = setInterval(
      () => void this.run('scheduled'),
      this.options.intervalMinutes * 60_000,
    )
    this.timer.unref()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  isRunning(): boolean {
    return this.localRunning
  }

  getLastResult(): CleanupResult | null {
    return this.lastResult
  }

  async run(trigger: 'startup' | 'scheduled' | 'manual'): Promise<CleanupResult | null> {
    if (!this.options.enabled || this.localRunning) return null
    const token = randomUUID()
    const locked = await this.acquireLock(token)
    if (!locked) {
      this.logger.debug({ trigger }, 'Cleanup skipped because another instance owns the lock')
      return null
    }

    this.localRunning = true
    this.startLockRefresh(token)
    try {
      const result = await this.service.run()
      this.lastResult = result
      this.metrics.observeCleanup(result)
      this.logger.info({ trigger, result }, 'Cleanup completed')
      return result
    } catch (error) {
      const failed: CleanupResult = {
        staleUploads: 0,
        readNotifications: 0,
        revokedSessions: 0,
        auditLogs: 0,
        expiredListings: 0,
        durationMs: 0,
        success: false,
        completedAt: new Date().toISOString(),
      }
      this.lastResult = failed
      this.metrics.observeCleanup(failed)
      this.logger.error({ err: error, trigger }, 'Cleanup failed')
      throw error
    } finally {
      this.localRunning = false
      this.stopLockRefresh()
      await this.releaseLock(token)
    }
  }

  private startLockRefresh(token: string): void {
    if (!this.redis) return
    const intervalMs = Math.max(10_000, Math.floor((this.options.lockTtlSeconds * 1000) / 2))
    this.lockRefreshTimer = setInterval(() => {
      void this.redis
        ?.eval(
          refreshLockScript,
          1,
          'campusbaza:jobs:cleanup:lock',
          token,
          String(this.options.lockTtlSeconds),
        )
        .catch((error: unknown) =>
          this.logger.warn({ err: error }, 'Unable to refresh cleanup lock'),
        )
    }, intervalMs)
    this.lockRefreshTimer.unref()
  }

  private stopLockRefresh(): void {
    if (this.lockRefreshTimer) clearInterval(this.lockRefreshTimer)
    this.lockRefreshTimer = null
  }

  private async acquireLock(token: string): Promise<boolean> {
    if (!this.redis) return true
    const result = await this.redis.set(
      'campusbaza:jobs:cleanup:lock',
      token,
      'EX',
      this.options.lockTtlSeconds,
      'NX',
    )
    return result === 'OK'
  }

  private async releaseLock(token: string): Promise<void> {
    if (!this.redis) return
    await this.redis.eval(releaseLockScript, 1, 'campusbaza:jobs:cleanup:lock', token)
  }
}

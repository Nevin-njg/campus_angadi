import { describe, expect, it, vi } from 'vitest'
import type Redis from 'ioredis'
import { RedisRateLimitStore } from './redis-rate-limit.store.js'

describe('RedisRateLimitStore', () => {
  it('uses a namespaced Redis key and returns the shared counter reset time', async () => {
    const evalCommand = vi.fn().mockResolvedValue([3, 25_000])
    const redis = { eval: evalCommand, del: vi.fn() } as unknown as Redis
    const store = new RedisRateLimitStore(redis, 'checkout')
    store.init?.({ windowMs: 60_000 } as never)

    const result = await store.increment('client-key')

    expect(result.totalHits).toBe(3)
    expect(result.resetTime).toBeInstanceOf(Date)
    expect(result.resetTime?.getTime()).toBeGreaterThan(Date.now())
    expect(evalCommand).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'campusbaza:rate-limit:checkout:client-key',
      '60000',
    )
  })
})

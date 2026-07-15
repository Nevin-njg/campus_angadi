import type Redis from 'ioredis'
import type { Store } from 'express-rate-limit'
import { RedisRateLimitStore } from './redis-rate-limit.store.js'

export type RateLimitStoreFactory = (namespace: string) => Store | undefined

export function createRateLimitStoreFactory(redis: Redis | null): RateLimitStoreFactory {
  return (namespace) => (redis ? new RedisRateLimitStore(redis, namespace) : undefined)
}

export function rateLimitStoreOption(
  factory: RateLimitStoreFactory,
  namespace: string,
): { store: Store } | Record<string, never> {
  const store = factory(namespace)
  return store ? { store } : {}
}

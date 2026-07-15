import Redis from 'ioredis'
import type { Logger } from 'pino'

export function createRedis(url: string, logger: Logger): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  })
  redis.on('error', (error) => logger.error({ err: error }, 'Redis error'))
  redis.on('ready', () => logger.info('Redis connected'))
  return redis
}

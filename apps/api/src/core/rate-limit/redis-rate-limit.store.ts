import type Redis from 'ioredis'
import type { IncrementResponse, Options, Store } from 'express-rate-limit'

const incrementScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`

const decrementScript = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
current = tonumber(current)
if current <= 1 then
  redis.call('DEL', KEYS[1])
  return 0
end
return redis.call('DECR', KEYS[1])
`

export class RedisRateLimitStore implements Store {
  readonly localKeys = false
  readonly prefix: string
  private windowMs = 60_000

  constructor(
    private readonly redis: Redis,
    namespace: string,
  ) {
    this.prefix = `campusbaza:rate-limit:${namespace}:`
  }

  init(options: Options): void {
    this.windowMs = options.windowMs
  }

  async increment(key: string): Promise<IncrementResponse> {
    const result = (await this.redis.eval(
      incrementScript,
      1,
      this.key(key),
      String(this.windowMs),
    )) as [number, number]
    const totalHits = Number(result[0])
    const ttl = Math.max(Number(result[1]), 0)
    return { totalHits, resetTime: new Date(Date.now() + ttl) }
  }

  async decrement(key: string): Promise<void> {
    await this.redis.eval(decrementScript, 1, this.key(key))
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(this.key(key))
  }

  private key(value: string): string {
    return `${this.prefix}${value}`
  }
}

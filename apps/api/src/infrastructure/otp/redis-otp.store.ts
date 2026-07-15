import type Redis from 'ioredis'
import type { OtpRecord, OtpStore, OtpVerificationResult } from '../../modules/auth/domain/otp.js'

const VERIFY_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return {0, 0} end
local record = cjson.decode(value)
if record.hash == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return {1, 0}
end
record.attemptsRemaining = record.attemptsRemaining - 1
if record.attemptsRemaining <= 0 then
  redis.call('DEL', KEYS[1])
  return {-2, 0}
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl > 0 then
  redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl)
else
  redis.call('DEL', KEYS[1])
  return {0, 0}
end
return {-1, record.attemptsRemaining}
`

export class RedisOtpStore implements OtpStore {
  constructor(private readonly redis: Redis) {}

  async get(email: string): Promise<OtpRecord | null> {
    const payload = await this.redis.get(this.key(email))
    if (!payload) return null
    const parsed = JSON.parse(payload) as Omit<
      OtpRecord,
      'expiresAt' | 'resendAvailableAt' | 'sendWindowStartedAt'
    > & {
      expiresAt: string
      resendAvailableAt: string
      sendWindowStartedAt: string
    }
    return {
      ...parsed,
      expiresAt: new Date(parsed.expiresAt),
      resendAvailableAt: new Date(parsed.resendAvailableAt),
      sendWindowStartedAt: new Date(parsed.sendWindowStartedAt),
    }
  }

  async set(record: OtpRecord): Promise<void> {
    const ttlMilliseconds = Math.max(1, record.expiresAt.getTime() - Date.now())
    await this.redis.set(this.key(record.email), JSON.stringify(record), 'PX', ttlMilliseconds)
  }

  async delete(email: string): Promise<void> {
    await this.redis.del(this.key(email))
  }

  async verifyAndConsume(email: string, candidateHash: string): Promise<OtpVerificationResult> {
    const result = (await this.redis.eval(VERIFY_SCRIPT, 1, this.key(email), candidateHash)) as [
      number,
      number,
    ]
    const [status, attemptsRemaining] = result
    if (status === 1) return { status: 'MATCH' }
    if (status === -1) return { status: 'INVALID', attemptsRemaining }
    if (status === -2) return { status: 'LOCKED' }
    return { status: 'MISSING' }
  }

  private key(email: string): string {
    return `campusbaza:auth:otp:${email}`
  }
}

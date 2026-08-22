import { randomUUID } from 'node:crypto'
import type Redis from 'ioredis'
import type { Logger } from 'pino'
import { ProductModel } from '../../products/infrastructure/product.models.js'
import { StoreOfferModel } from '../infrastructure/store-offer.model.js'

const LOCK_KEY = 'campusbaza:store-offers:lock'
const POLL_INTERVAL_MS = 15_000
const LOCK_TTL_MS = 20_000
const BATCH_SIZE = 200

const releaseLockScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

export class StoreOfferScheduler {
  private timer: NodeJS.Timeout | null = null
  private localRunning = false

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.timer) return
    setTimeout(() => void this.run('startup'), 750).unref()
    this.timer = setInterval(() => void this.run('scheduled'), POLL_INTERVAL_MS)
    this.timer.unref()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async run(trigger: 'startup' | 'scheduled'): Promise<void> {
    if (this.localRunning) return

    const token = randomUUID()
    let locked = false

    try {
      locked = await this.acquireLock(token)
      if (!locked) return
      this.localRunning = true

      const offers: any[] = await StoreOfferModel.find({ isCurrent: true })
        .sort({ endsAt: 1 })
        .limit(BATCH_SIZE)

      const now = new Date()

      for (const offer of offers) {
        if (offer.endsAt <= now) {
          await this.expire(offer)
        } else if (offer.startsAt <= now) {
          await this.activate(offer)
        }
      }
    } catch (error) {
      this.logger.error({ err: error, trigger }, 'Store offer scheduler failed')
    } finally {
      this.localRunning = false
      if (locked) {
        await this.releaseLock(token).catch((error: unknown) => {
          this.logger.warn({ err: error }, 'Unable to release store offer scheduler lock')
        })
      }
    }
  }

  private async activate(offer: any): Promise<void> {
    await ProductModel.updateOne(
      { _id: offer.productId, storeId: offer.storeId, deletedAt: null },
      { $set: { originalPrice: offer.basePrice, price: offer.discountedPrice } },
    )

    if (offer.status !== 'ACTIVE') {
      offer.status = 'ACTIVE'
      await offer.save()
      this.logger.info(
        { offerId: String(offer._id), productId: String(offer.productId) },
        'Store offer activated',
      )
    }
  }

  private async expire(offer: any): Promise<void> {
    await ProductModel.updateOne(
      { _id: offer.productId, storeId: offer.storeId, deletedAt: null },
      { $set: { price: offer.basePrice, originalPrice: null } },
    )

    offer.status = 'EXPIRED'
    offer.isCurrent = false
    await offer.save()

    this.logger.info(
      { offerId: String(offer._id), productId: String(offer.productId) },
      'Store offer expired',
    )
  }

  private async acquireLock(token: string): Promise<boolean> {
    const result = await this.redis.set(LOCK_KEY, token, 'PX', LOCK_TTL_MS, 'NX')
    return result === 'OK'
  }

  private async releaseLock(token: string): Promise<void> {
    await this.redis.eval(releaseLockScript, 1, LOCK_KEY, token)
  }
}

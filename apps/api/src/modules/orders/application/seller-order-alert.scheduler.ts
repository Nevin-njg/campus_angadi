import { randomUUID } from 'node:crypto'
import type Redis from 'ioredis'
import type { Logger } from 'pino'
import type { PushService } from '../../push/application/push.service.js'
import { StoreModel } from '../../stores/infrastructure/store.model.js'
import { OrderModel } from '../infrastructure/order.models.js'

const DUE_KEY = 'campusbaza:seller-order-alerts:due'
const LOCK_KEY = 'campusbaza:seller-order-alerts:lock'

const SECOND_RING_DELAY_MS = 90_000
const THIRD_RING_DELAY_MS = 180_000
const POLL_INTERVAL_MS = 1_000
const LOCK_TTL_MS = 15_000
const BATCH_SIZE = 50

type AlertStage = 2 | 3

type AlertJob = {
  orderId: string
  stage: AlertStage
}

const releaseLockScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

function serializeJob(job: AlertJob) {
  return JSON.stringify(job)
}

function parseJob(raw: string): AlertJob | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AlertJob>

    if (
      typeof parsed.orderId !== 'string' ||
      !parsed.orderId ||
      (parsed.stage !== 2 && parsed.stage !== 3)
    ) {
      return null
    }

    return {
      orderId: parsed.orderId,
      stage: parsed.stage,
    }
  } catch {
    return null
  }
}

export class SellerOrderAlertScheduler {
  private timer: NodeJS.Timeout | null = null
  private localRunning = false

  constructor(
    private readonly redis: Redis,
    private readonly push: PushService,
    private readonly logger: Logger,
  ) {}

  async schedule(orderId: string): Promise<void> {
    const now = Date.now()

    const pipeline = this.redis.pipeline()
    pipeline.zadd(
      DUE_KEY,
      now + SECOND_RING_DELAY_MS,
      serializeJob({ orderId, stage: 2 }),
    )
    pipeline.zadd(
      DUE_KEY,
      now + THIRD_RING_DELAY_MS,
      serializeJob({ orderId, stage: 3 }),
    )

    await pipeline.exec()

    this.logger.debug(
      {
        orderId,
        secondRingAt: new Date(now + SECOND_RING_DELAY_MS).toISOString(),
        thirdRingAt: new Date(now + THIRD_RING_DELAY_MS).toISOString(),
      },
      'Seller order reminder rings scheduled',
    )
  }

  start(): void {
    if (this.timer) return

    setTimeout(() => void this.run('startup'), 500).unref()

    this.timer = setInterval(
      () => void this.run('scheduled'),
      POLL_INTERVAL_MS,
    )
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

      const dueJobs = await this.redis.zrangebyscore(
        DUE_KEY,
        '-inf',
        Date.now(),
        'LIMIT',
        0,
        BATCH_SIZE,
      )

      for (const rawJob of dueJobs) {
        await this.processJob(rawJob)
      }
    } catch (error) {
      this.logger.error(
        { err: error, trigger },
        'Seller order reminder scheduler failed',
      )
    } finally {
      this.localRunning = false

      if (locked) {
        await this.releaseLock(token).catch((error: unknown) => {
          this.logger.warn(
            { err: error },
            'Unable to release seller order reminder scheduler lock',
          )
        })
      }
    }
  }

  private async processJob(rawJob: string): Promise<void> {
    const job = parseJob(rawJob)

    if (!job) {
      await this.redis.zrem(DUE_KEY, rawJob)
      this.logger.warn(
        { rawJob },
        'Discarded invalid seller order reminder job',
      )
      return
    }

    const order = await OrderModel.findById(job.orderId)
      .select({
        orderNumber: 1,
        sellerType: 1,
        storeId: 1,
        status: 1,
        totalAmount: 1,
        itemCount: 1,
      })
      .lean()

    if (
      !order ||
      order.sellerType !== 'ADMIN' ||
      order.status !== 'PENDING' ||
      !order.storeId
    ) {
      await this.redis.zrem(DUE_KEY, rawJob)
      return
    }

    const store = await StoreModel.findById(order.storeId)
      .select({ sellerId: 1 })
      .lean()

    const sellerId = store?.sellerId ? String(store.sellerId) : null

    if (!sellerId) {
      await this.redis.zrem(DUE_KEY, rawJob)
      this.logger.warn(
        { orderId: job.orderId, stage: job.stage },
        'Seller order reminder discarded because store has no seller',
      )
      return
    }

    const message = `${order.orderNumber} · ₹${order.totalAmount.toFixed(2)} · ${
      order.itemCount
    } item${order.itemCount === 1 ? '' : 's'}`

    const sent = await this.push.sendToUser(sellerId, {
      title:
        job.stage === 2
          ? 'New order still waiting'
          : 'New order needs attention',
      body: message,
      url: `/seller?section=orders&order=${encodeURIComponent(job.orderId)}`,
      tag: `order-${job.orderId}`,
      orderId: job.orderId,
    })

    await this.redis.zrem(DUE_KEY, rawJob)

    this.logger.info(
      {
        orderId: job.orderId,
        stage: job.stage,
        recipients: sent,
      },
      `Seller order Ring ${job.stage} sent`,
    )
  }

  private async acquireLock(token: string): Promise<boolean> {
    const result = await this.redis.set(
      LOCK_KEY,
      token,
      'PX',
      LOCK_TTL_MS,
      'NX',
    )

    return result === 'OK'
  }

  private async releaseLock(token: string): Promise<void> {
    await this.redis.eval(releaseLockScript, 1, LOCK_KEY, token)
  }
}

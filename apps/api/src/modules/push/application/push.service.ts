import webPush from 'web-push'
import { AppError } from '../../../core/errors/app-error.js'
import { PushSubscriptionModel } from '../infrastructure/push-subscription.model.js'

export interface PushSubscriptionInput {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushNotificationPayload {
  title: string
  body: string
  url: string
  tag?: string
  orderId?: string
}

export class PushService {
  constructor(
    private readonly publicKey: string,
    private readonly privateKey: string,
    private readonly subject: string,
  ) {
    if (this.isConfigured()) {
      webPush.setVapidDetails(
        this.subject,
        this.publicKey,
        this.privateKey,
      )
    }
  }

  isConfigured() {
    return Boolean(
      this.publicKey.trim() &&
        this.privateKey.trim() &&
        this.subject.trim(),
    )
  }

  getPublicConfiguration() {
    return {
      enabled: this.isConfigured(),
      publicKey: this.isConfigured() ? this.publicKey : null,
    }
  }

  async subscribe(
    userId: string,
    input: PushSubscriptionInput,
    userAgent: string | null,
  ) {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'PUSH_NOT_CONFIGURED',
        'Push notifications are not configured.',
      )
    }

    await PushSubscriptionModel.findOneAndUpdate(
      { endpoint: input.endpoint },
      {
        $set: {
          userId,
          endpoint: input.endpoint,
          expirationTime: input.expirationTime ?? null,
          keys: {
            p256dh: input.keys.p256dh,
            auth: input.keys.auth,
          },
          userAgent,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )

    return { subscribed: true }
  }

  async unsubscribe(userId: string, endpoint: string) {
    await PushSubscriptionModel.deleteOne({
      userId,
      endpoint,
    })

    return { subscribed: false }
  }

  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<number> {
    if (!this.isConfigured()) return 0

    const subscriptions = await PushSubscriptionModel.find({ userId }).lean()

    if (!subscriptions.length) return 0

    const message = JSON.stringify(payload)

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const keys = subscription.keys

        if (!keys?.p256dh || !keys.auth) {
          await PushSubscriptionModel.deleteOne({
            _id: subscription._id,
          })
          return false
        }

        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              expirationTime: subscription.expirationTime ?? null,
              keys: {
                p256dh: keys.p256dh,
                auth: keys.auth,
              },
            },
            message,
          )

          return true
        } catch (error: unknown) {
          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'statusCode' in error
              ? Number((error as { statusCode?: unknown }).statusCode)
              : null

          // Browser removed the subscription or the endpoint expired.
          if (statusCode === 404 || statusCode === 410) {
            await PushSubscriptionModel.deleteOne({
              _id: subscription._id,
            })
          }

          throw error
        }
      }),
    )

    return results.filter(
      (result) => result.status === 'fulfilled' && result.value,
    ).length
  }
}

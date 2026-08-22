import webPush from 'web-push'
import { AppError } from '../../../core/errors/app-error.js'
import { PushSubscriptionModel } from '../infrastructure/push-subscription.model.js'
import { SellerMobileDeviceModel } from '../infrastructure/seller-mobile-device.model.js'

export interface PushSubscriptionInput {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export interface SellerMobileDeviceInput {
  deviceId: string
  expoPushToken: string
  deviceName: string
  platform: 'android' | 'ios'
}

export interface PushNotificationPayload {
  title: string
  body: string
  url: string
  tag?: string
  orderId?: string
}

type ExpoPushTicket =
  | {
      status: 'ok'
      id: string
    }
  | {
      status: 'error'
      message: string
      details?: {
        error?: string
      }
    }

type ExpoPushResponse = {
  data: ExpoPushTicket | ExpoPushTicket[]
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

  async registerSellerMobileDevice(
    userId: string,
    input: SellerMobileDeviceInput,
  ) {
    const now = new Date()

    // A physical installation keeps one stable deviceId. Expo push tokens may
    // rotate, so either identifier can find the existing record.
    await SellerMobileDeviceModel.findOneAndUpdate(
      {
        $or: [
          { deviceId: input.deviceId },
          { expoPushToken: input.expoPushToken },
        ],
      },
      {
        $set: {
          userId,
          deviceId: input.deviceId,
          expoPushToken: input.expoPushToken,
          deviceName: input.deviceName,
          platform: input.platform,
          pushEnabled: true,
          lastActiveAt: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )

    return {
      registered: true,
      deviceId: input.deviceId,
    }
  }

  async unregisterSellerMobileDevice(
    userId: string,
    deviceId: string,
  ) {
    await SellerMobileDeviceModel.deleteOne({
      userId,
      deviceId,
    })

    return {
      registered: false,
      deviceId,
    }
  }

  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<number> {
    // Web push and seller-mobile push are independent. A failure in one
    // transport must not prevent the other transport from being attempted.
    const results = await Promise.allSettled([
      this.sendWebPushToUser(userId, payload),
      this.sendSellerMobilePushToUser(userId, payload),
    ])

    return results.reduce((total, result) => {
      return result.status === 'fulfilled' ? total + result.value : total
    }, 0)
  }

  private async sendWebPushToUser(
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

  private async sendSellerMobilePushToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<number> {
    const devices = await SellerMobileDeviceModel.find({
      userId,
      pushEnabled: true,
    }).lean()

    if (!devices.length) return 0

    const results = await Promise.allSettled(
      devices.map(async (device) => {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: device.expoPushToken,
            title: payload.title,
            body: payload.body,
            sound: 'default',
            priority: 'high',
            channelId: 'seller-orders-v2',
            tag: payload.tag,
            data: {
              type: payload.orderId ? 'NEW_ORDER' : 'GENERAL',
              orderId: payload.orderId ?? null,
              url: payload.url,
            },
          }),
        })

        if (!response.ok) {
          throw new Error(
            `Expo push request failed with HTTP ${response.status}.`,
          )
        }

        const result = (await response.json()) as ExpoPushResponse
        const ticket = Array.isArray(result.data)
          ? result.data[0]
          : result.data

        if (!ticket) {
          throw new Error('Expo push returned no ticket.')
        }

        if (ticket.status === 'error') {
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await SellerMobileDeviceModel.deleteOne({
              _id: device._id,
            })
            return false
          }

          throw new Error(ticket.message)
        }

        await SellerMobileDeviceModel.updateOne(
          { _id: device._id },
          {
            $set: {
              lastPushAt: new Date(),
            },
          },
        )

        return true
      }),
    )

    return results.filter(
      (result) => result.status === 'fulfilled' && result.value,
    ).length
  }
}

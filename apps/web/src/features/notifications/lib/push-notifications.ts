import { notificationsApi } from '../api/notifications.api'

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)

  const buffer = new ArrayBuffer(raw.length)
  const bytes = new Uint8Array(buffer)

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }

  return buffer
}

function assertPushSupported() {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    throw new Error('Push notifications are not supported on this device.')
  }
}

export async function enablePushNotifications() {
  assertPushSupported()

  const config = await notificationsApi.pushConfig()

  if (!config.enabled || !config.publicKey) {
    throw new Error('Order notifications are not configured yet.')
  }

  let permission = Notification.permission

  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(config.publicKey),
    })
  }

  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!p256dh || !auth) {
    throw new Error('The browser returned an incomplete push subscription.')
  }

  await notificationsApi.subscribePush({
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh,
      auth,
    },
  })

  return subscription
}

export async function disablePushNotifications() {
  assertPushSupported()

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (!subscription) return

  await notificationsApi.unsubscribePush(subscription.endpoint)
  await subscription.unsubscribe()
}

export async function pushNotificationsEnabled() {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false
  }

  const registration = await navigator.serviceWorker.ready
  return Boolean(await registration.pushManager.getSubscription())
}

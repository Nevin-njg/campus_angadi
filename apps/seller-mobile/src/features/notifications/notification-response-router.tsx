import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'

function getOrderId(response: Notifications.NotificationResponse | null) {
  const value = response?.notification.request.content.data?.orderId
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function NotificationResponseRouter() {
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const openOrder = async (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (!mounted) return

      const orderId = getOrderId(response)
      if (!orderId) return

      // Clear the native "last response" after consuming it so reopening the
      // app later does not unexpectedly navigate to an old order.
      await Notifications.clearLastNotificationResponseAsync().catch(() => {})

      if (!mounted) return

      router.push({
        pathname: '/(tabs)/orders',
        params: { orderId },
      })
    }

    void Notifications.getLastNotificationResponseAsync().then(openOrder)

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        void openOrder(response)
      })

    return () => {
      mounted = false
      subscription.remove()
    }
  }, [router])

  return null
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload

  try {
    payload = event.data.json()
  } catch {
    return
  }

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      const visibleClients = windowClients.filter(
        (client) => client.visibilityState === 'visible',
      )

      if (visibleClients.length > 0) {
        for (const client of visibleClients) {
          client.postMessage({
            type: 'CAMPUS_ANGADI_ORDER_PUSH',
            payload,
          })
        }

        return
      }

      await self.registration.showNotification(
        payload.title || 'Campus Angadi',
        {
          body: payload.body || 'You have a new order.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: payload.tag || undefined,
          renotify: true,
          silent: false,
          vibrate: [200, 100, 200],
          data: {
            url: payload.url || '/seller',
            orderId: payload.orderId || null,
          },
        },
      )
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/seller'

  event.waitUntil(
    (async () => {
      const target = new URL(targetUrl, self.location.origin).href

      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of windowClients) {
        if ('focus' in client) {
          await client.navigate(target)
          return client.focus()
        }
      }

      return self.clients.openWindow(target)
    })(),
  )
})

self.addEventListener('push', (event) => {
  let data = { title: 'Seblak HQ', body: 'Ada informasi baru.' }
  try {
    data = event.data?.json() ?? data
  } catch {
    data.body = event.data?.text() ?? data.body
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag ?? 'seblak-hq-notification',
      data: { url: data.url ?? '/barang' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/barang'))
})

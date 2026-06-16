const CACHE = 'sovetydoma-v1'
const ARTICLE_CACHE = 'sovetydoma-articles-v1'
const MAX_ARTICLES = 10

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/_next/static/']))
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

self.addEventListener('push', e => {
  let data = { title: 'Новая статья на 1001sovet.ru', body: '', icon: '/icon-192.png', url: '/', tag: 'sovetydoma-push' }
  try {
    if (e.data) data = { ...data, ...e.data.json() }
  } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      tag: data.tag || 'sovetydoma-push',
      data: { url: data.url || '/' },
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // Article pages: network first, cache fallback
  if (url.pathname.match(/^\/[a-z-]+\/[a-z0-9-]+\/$/)) {
    e.respondWith(
      fetch(e.request).then(async res => {
        const cache = await caches.open(ARTICLE_CACHE)
        cache.put(e.request, res.clone())
        // Prune cache to MAX_ARTICLES
        const keys = await cache.keys()
        if (keys.length > MAX_ARTICLES) {
          await cache.delete(keys[0])
        }
        return res
      }).catch(() => caches.match(e.request))
    )
    return
  }
  // Static assets: cache first
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      }))
    )
    return
  }
  // Everything else: network first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
})

const CACHE = 'sovetydoma-v2'
const ARTICLE_CACHE = 'sovetydoma-articles-v2'
const MAX_ARTICLES = 10

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/_next/static/']))
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Drop caches from older SW versions so deploys reach returning users.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== ARTICLE_CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  )
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
  // Only ever handle same-origin GET. Never intercept cross-origin requests
  // (e.g. the Supabase Auth API at api.1001sovet.ru): wrapping them in
  // fetch().catch(caches.match) masks real responses/errors and broke
  // password recovery (getUser → "Failed to fetch"). Let the browser handle them.
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return
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

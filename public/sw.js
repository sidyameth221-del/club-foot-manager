const CACHE_NAME = 'sifc-pwa-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Intercepte uniquement les requêtes GET de notre propre site (pas Supabase API)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return
  }


  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(event.request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          return response
        })
        .catch(() => caches.match('/index.html'))
    }),
  )
})

const CACHE_NAME = 'sifc-pwa-v2'
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

  // STRATÉGIE NETWORK-FIRST (Réseau en priorité, Cache en secours)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si le réseau fonctionne, on met à jour le cache silencieusement
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
        return response
      })
      .catch(() => {
        // Si le réseau échoue (hors ligne), on cherche dans le cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/index.html')
        })
      })
  )
})

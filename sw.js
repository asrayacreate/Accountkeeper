/* Swagatik — Service Worker
   Cache-first with network fallback. Bump CACHE_VERSION on every release so
   updated files replace the old cached copy (otherwise the old version keeps showing).
*/
var CACHE_VERSION = 'swagatik-cache-v11';
var CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache the core shell
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(CORE_ASSETS).catch(function () { /* some paths may 404 depending on filename; ignore */ });
    })
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

// Fetch: cache-first, fall back to network, then cache the response
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (resp) {
        // only cache same-origin successful responses
        try {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            var copy = resp.clone();
            caches.open(CACHE_VERSION).then(function (cache) { cache.put(event.request, copy); });
          }
        } catch (e) {}
        return resp;
      }).catch(function () {
        // offline and not cached: for navigations, serve the app shell
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

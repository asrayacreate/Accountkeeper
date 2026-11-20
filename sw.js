/* Swagatik — Service Worker
   • App page (index.html / navigations): NETWORK-FIRST → online users always get the
     newest version; offline falls back to the cached copy.
   • Other files (icons, manifest): cache-first.
   • Do NOT edit the two version lines by hand — run `npm run release`
     (scripts/release.mjs) which updates index.html, sw.js and package.json together.
*/
var APP_VERSION = '6.9.0';
var CACHE_VERSION = 'swagatik-cache-v15';
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
    }).then(function () { return self.clients.claim(); })
  );
});

function isAppPage(req) {
  if (req.mode === 'navigate') return true;
  var u = new URL(req.url);
  return u.origin === self.location.origin && /\/(index\.html)?$/.test(u.pathname);
}

function putInCache(req, resp) {
  try {
    if (resp && resp.status === 200 && resp.type === 'basic') {
      var copy = resp.clone();
      caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
    }
  } catch (e) {}
  return resp;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // APIs (Dropbox, AI) go straight to network

  if (isAppPage(req)) {
    // Network-first for the app itself (with 'no-cache' so the HTTP cache revalidates)
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).then(function (resp) { return putInCache(req, resp); })
        .catch(function () {
          return caches.match(req).then(function (c) { return c || caches.match('./index.html'); });
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) { return putInCache(req, resp); });
    })
  );
});

// Minimal service worker: caches the app shell (not API data) so the
// app can install and reopen instantly even on a flaky connection.
// Live data (products/orders/customers) always comes fresh from the
// network — this is NOT an offline-first data cache, just an
// offline-capable *shell*, which is what actually matters for a tool
// where stale inventory numbers would be actively dangerous to trust.

// Bumped whenever a shell file changes. The worker deletes every cache whose
// name is not this one on activate, so the bump is what actually evicts the old
// app.js from a staff browser. Changing app.js alone does nothing: the browser
// only fetches a new worker when THIS file's bytes change, and until it does the
// v11 cache keeps serving the version it already has.
const CACHE_NAME = 'novaflex-crm-shell-v12';
const SHELL_FILES = [
  './',
  './index.html',
  // Versioned to match index.html. caches.match() keys on the full URL
  // including the query, so an unversioned entry here would never be hit once
  // the page starts asking for ?v=N — precache and request must agree or
  // offline silently stops working.
  './app.js?v=11',
  './icons.js?v=11',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — inventory/order data must always be live.
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fresh = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached); // offline: fall back to whatever we have
      return cached || fresh;
    })
  );
});

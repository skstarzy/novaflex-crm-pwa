// Minimal service worker: caches the app shell (not API data) so the
// app can install and reopen instantly even on a flaky connection.
// Live data (products/orders/customers) always comes fresh from the
// network — this is NOT an offline-first data cache, just an
// offline-capable *shell*, which is what actually matters for a tool
// where stale inventory numbers would be actively dangerous to trust.

const CACHE_NAME = 'novaflex-crm-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './icons.js',
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
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

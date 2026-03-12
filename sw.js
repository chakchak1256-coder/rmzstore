// ============================================================
//  RMZSTORE Admin — Service Worker
//  Handles: caching, offline fallback, background sync
// ============================================================

const CACHE_NAME    = 'rmzstore-admin-v7';
const OFFLINE_PAGE  = '/admin.html';

// Files to pre-cache on install (shell)
const PRECACHE_URLS = [
  '/admin.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // External fonts & icons (cached on first load via runtime caching below)
];

// ── Install: pre-cache the app shell ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for same-origin only ──────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests from the same origin.
  // All external CDNs (fonts, FontAwesome, APIs, etc.) are passed
  // straight through to the browser — no SW interception at all.
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Same-origin requests → network-first with offline fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache fresh copy
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache or fallback to admin shell
        return caches.match(event.request).then(cached => {
          return cached || caches.match(OFFLINE_PAGE);
        });
      })
  );
});

// ── Push Notifications (optional, requires VAPID setup) ───
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'RMZSTORE', {
      body:    data.body  || 'You have a new update.',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-96.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/admin.html' }
    })
  );
});

// ── Notification click → open/focus the app ───────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const target = event.notification.data.url;
      for (const client of list) {
        if (client.url.includes('admin') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
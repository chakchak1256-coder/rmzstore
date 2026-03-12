// ============================================================
//  RMZSTORE Admin — Service Worker
//  Handles: caching, offline fallback, background sync
// ============================================================

const CACHE_NAME    = 'rmzstore-v8';
const OFFLINE_PAGE  = '/admin.html';

// Files to pre-cache on install (shell)
const PRECACHE_URLS = [
  '/admin.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
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

// ── Fetch: same-origin only — never touch external CDNs ───
self.addEventListener('fetch', event => {
  // Only intercept same-origin GET requests.
  // ALL external URLs (fonts, FontAwesome, Supabase, APIs…)
  // go straight to the network — the SW never sees them.
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || caches.match(OFFLINE_PAGE)
        )
      )
  );
});

// ── Push Notifications ────────────────────────────────────
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

// ── Notification click ────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const target = event.notification.data.url;
      for (const client of list) {
        if (client.url.includes('admin') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(target);
    })
  );
});
const CACHE_NAME   = 'rmzstore-v9';
const OFFLINE_PAGE = '/admin.html';

const PRECACHE_URLS = ['/admin.html','/manifest.json','/icons/icon-192.png','/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only intercept same-origin GET requests — all external CDNs pass through untouched
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match(OFFLINE_PAGE)))
  );
});

self.addEventListener('push', event => {
  if (!event.data) return;
  let d = {};
  try { d = event.data.json(); } catch(e) { d = { title: 'RMZSTORE', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.title || '🛒 New Order!', {
      body:    d.body    || 'You have a new update.',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-96.png',
      vibrate: [300, 100, 300, 100, 300],
      tag:     'rmzstore-order',
      renotify: true,
      requireInteraction: true,
      data: { url: d.url || '/admin.html#orders' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const c of list) { if (c.url.includes('admin') && 'focus' in c) return c.focus(); }
      return clients.openWindow(event.notification.data.url);
    })
  );
});
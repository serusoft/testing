/* ================================
   Skore Point – Enhanced Service Worker
   GitHub Pages Compatible
   ================================ */

const CACHE_VERSION = 'v4.2.0';
const CACHE_NAME = `skore-point-${CACHE_VERSION}`;

/* App shell – RELATIVE paths only */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './skore-icon.jpg'
];

/* External static libraries (safe to cache) */
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

/* Firebase SDKs – network first (cached after load) */
const FIREBASE_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
];

/* ================================
   INSTALL
   ================================ */
self.addEventListener('install', event => {
  console.log('[SW] Installing…');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([
        ...APP_SHELL,
        ...EXTERNAL_ASSETS,
        ...FIREBASE_ASSETS
      ]))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install warning:', err))
  );
});

/* ================================
   ACTIVATE
   ================================ */
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* ================================
   FETCH STRATEGIES
   ================================ */
self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://')) return;

  /* Firebase / Google APIs → ALWAYS NETWORK */
  if (
    request.url.includes('googleapis.com') ||
    request.url.includes('firebaseio.com') ||
    request.url.includes('firebasestorage')
  ) {
    event.respondWith(networkOnly(request));
    return;
  }

  /* HTML → Network first */
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* Static assets → Cache first */
  if (request.url.match(/\.(css|js|png|jpg|jpeg|svg|woff2?|ttf|eot)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* Default */
  event.respondWith(networkFirst(request));
});

/* ================================
   STRATEGY FUNCTIONS
   ================================ */
async function networkOnly(request) {
  return fetch(request);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

function offlineFallback() {
  return caches.match('./').then(
    res => res || new Response(
      '<h2>You are offline</h2><p>Skore Point needs internet for live data.</p>',
      { headers: { 'Content-Type': 'text/html' } }
    )
  );
}

/* ================================
   MESSAGES
   ================================ */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') caches.delete(CACHE_NAME);
});

/* ================================
   PUSH NOTIFICATIONS
   ================================ */
self.addEventListener('push', event => {
  const data = event.data?.text() || 'New update from Skore Point';

  event.waitUntil(
    self.registration.showNotification('Skore Point', {
      body: data,
      icon: './skore-icon.jpg',
      badge: './skore-icon.jpg',
      vibrate: [100, 50, 100],
      data: { url: './' }
    })
  );
});

/* ================================
   NOTIFICATION CLICK
   ================================ */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('/testing/') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow('./');
      })
  );
});

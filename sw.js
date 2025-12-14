/* =================================
   Skore Point – Service Worker
   GitHub Pages Safe
   ================================= */

const CACHE_VERSION = 'v4.4.1';
const CACHE_NAME = `skore-point-${CACHE_VERSION}`;

/* App shell – RELATIVE paths ONLY */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/skore-icon-96.png',
  './icons/skore-icon-144.png',
  './icons/skore-icon-192.png',
  './icons/skore-icon-512.png',
  './icons/skore-icon-512-maskable.png'
];

/* External static libraries */
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

/* Firebase SDKs – network only */
const FIREBASE_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
];

/* ================================
   INSTALL
   ================================ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        cache.addAll([
          ...APP_SHELL,
          ...EXTERNAL_ASSETS,
          ...FIREBASE_ASSETS
        ])
      )
      .then(() => self.skipWaiting())
  );
});

/* ================================
   ACTIVATE
   ================================ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ================================
   FETCH
   ================================ */
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Firebase – always network
  if (request.url.includes('firebase') || request.url.includes('googleapis')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML – network first
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets – cache first
  if (request.url.match(/\.(css|js|png|jpg|jpeg|svg|woff2?|ttf|eot|ico)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

/* ================================
   STRATEGIES
   ================================ */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request) || caches.match('./');
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

/* ================================
   PUSH NOTIFICATIONS
   ================================ */
self.addEventListener('push', event => {
  const body = event.data?.text() || 'New update from Skore Point';

  event.waitUntil(
    self.registration.showNotification('Skore Point', {
      body,
      icon: './icons/skore-icon-192.png',
      badge: './icons/skore-icon-96.png',
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
    clients.openWindow('./')
  );
});

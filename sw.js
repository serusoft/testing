// Service Worker for Skore Point - Enhanced GitHub Pages version
const CACHE_NAME = 'skore-point-v5';
const STATIC_CACHE = 'skore-static-v5';
const DYNAMIC_CACHE = 'skore-dynamic-v5';

const staticAssets = [
  '/testing/',
  '/testing/index.html',
  '/testing/skore-icon.jpg',
  '/testing/manifest.json'
];

const externalAssets = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE)
        .then(cache => {
          console.log('Caching static assets');
          return cache.addAll(staticAssets);
        }),
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          console.log('Caching external assets');
          return Promise.all(
            externalAssets.map(url => {
              return fetch(url)
                .then(response => {
                  if (response.ok) {
                    return cache.put(url, response);
                  }
                  console.warn('Failed to cache:', url);
                })
                .catch(err => {
                  console.warn('Error caching external asset:', url, err);
                });
            })
          );
        })
    ])
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (![CACHE_NAME, STATIC_CACHE, DYNAMIC_CACHE].includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event with intelligent caching strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests and Chrome extensions
  if (event.request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle Firebase requests - network only
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic')) {
    event.respondWith(networkOnly(event));
    return;
  }
  
  // Handle HTML pages - network first
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(networkFirst(event));
    return;
  }
  
  // Handle static assets - cache first
  if (url.pathname.includes('/testing/') && 
      (url.pathname.endsWith('.jpg') || 
       url.pathname.endsWith('.png') || 
       url.pathname.endsWith('.css') ||
       url.pathname.endsWith('.js'))) {
    event.respondWith(cacheFirst(event));
    return;
  }
  
  // Default: try cache, fallback to network
  event.respondWith(cacheFirst(event));
});

// Strategy functions
async function networkOnly(event) {
  return fetch(event.request);
}

async function networkFirst(event) {
  try {
    const networkResponse = await fetch(event.request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return caches.match('/testing/index.html');
  }
}

async function cacheFirst(event) {
  const cachedResponse = await caches.match(event.request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(event.request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline page for HTML requests
    if (event.request.headers.get('accept').includes('text/html')) {
      return caches.match('/testing/index.html');
    }
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle app installation
self.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  self.deferredPrompt = event;
  
  // Send message to clients
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'CAN_INSTALL_PWA',
        event: event
      });
    });
  });
});

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notifications (optional)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/testing/skore-icon.jpg',
    badge: '/testing/skore-icon.jpg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/testing/skore-icon.jpg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/testing/skore-icon.jpg'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Skore Point', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/testing/')
    );
  }
});

// Service Worker for Skore Point PWA
const CACHE_NAME = 'skore-point-v4.0.0';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'skore-icon.jpg',
  // External libraries
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  // Firebase SDK
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell and assets');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  // Skip Firebase Storage requests
  if (event.request.url.includes('firebasestorage.app')) return;
  
  // For Firebase Firestore/Auth requests, always go to network
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // For HTML pages, use network first
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // For CSS, JS, images, and fonts - use cache first
  if (event.request.url.match(/\.(css|js|jpg|jpeg|png|gif|woff|woff2|ttf|eot|svg)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // Default: network first for everything else
  event.respondWith(networkFirst(event.request));
});

// Network first strategy
async function networkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // If successful, update cache
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log('[Service Worker] Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache and offline, show offline page
    if (!navigator.onLine) {
      return caches.match('/').then(response => {
        if (response) {
          return response;
        }
        return new Response('You are offline. Please check your internet connection.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/html'
          })
        });
      });
    }
    
    throw error;
  }
}

// Cache first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache the new resource
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Fetch failed for:', request.url, error);
    
    // For CSS/JS files, return empty response to prevent errors
    if (request.url.match(/\.(css|js)$/)) {
      return new Response('/* Offline - Resource not available */', {
        headers: { 'Content-Type': request.url.match(/\.css$/) ? 'text/css' : 'application/javascript' }
      });
    }
    
    throw error;
  }
}

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});

// Handle push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from Skore Point',
    icon: 'skore-icon.jpg',
    badge: 'skore-icon.jpg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'explore',
        title: 'Open',
        icon: 'skore-icon.jpg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: 'skore-icon.jpg'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Skore Point', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

const CACHE_NAME = 'goofy-guesser-v2';

// Only pre-cache static assets that rarely change
const STATIC_ASSETS = [
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];

// Install event - cache icons only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Activate immediately so the new SW takes over
  self.skipWaiting();
});

// Activate event - delete ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event
// - Navigation requests (HTML): NEVER cache — always go to network
// - JS / CSS: NEVER cache — Vite uses hashed filenames, browser cache is sufficient
// - Static assets (images, icons): cache-first for offline support
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Never intercept navigation requests — the browser must always
  // fetch fresh HTML so the latest JS bundle (with the current word
  // logic) runs on every page load / reload.
  if (event.request.mode === 'navigate') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Don't cache JS or CSS — Vite hashes these; browser HTTP cache handles them
  if (url.pathname.match(/\.(js|css)$/)) return;

  // Don't cache HTML
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return;

  // For everything else (icons, images, fonts, etc.) — cache-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});

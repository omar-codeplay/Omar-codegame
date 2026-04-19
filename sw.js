const CACHE_NAME = 'omargameplay-v1.3'; // Updated version
const FONT_CACHE = 'fonts-cache-v1';

const urlsToCache = [
    '/',
    '/index.html',
    '/image/logo-nobg.png', // Ensure this path is exactly right
    'bakasa.html',
    'coloriq.html',
    'Chess.html',
    'fortress.html'
];

// 1. Install - Pre-cache core files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                urlsToCache.map(url => {
                    return cache.add(url).catch(err => console.warn(`Pre-cache failed: ${url}`));
                })
            );
        })
    );
    self.skipWaiting();
});

// 2. Activate - Cleanup old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== FONT_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. Fetch - The "2-Way" Logic with Font Support
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Identify if this is a Google Font request
    const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Return from cache if found
            if (cachedResponse) return cachedResponse;

            // Otherwise, fetch from network
            return fetch(event.request).then(networkResponse => {
                // Validate response: 
                // We allow 'basic' (our site) and 'cors' (Google Fonts)
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }

                // Decide which cache bucket to use
                const cacheToOpen = isGoogleFont ? FONT_CACHE : CACHE_NAME;
                
                const responseToCache = networkResponse.clone();
                caches.open(cacheToOpen).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Truly offline and no cache
            });
        })
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// OmarGameplay Service Worker
// Strategy: Network-first for HTML pages → each game updates itself
//           independently. Cache-first for stable CDN/font assets.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME  = 'omargameplay-v2.0';
const FONT_CACHE  = 'fonts-cache-v1';
const ASSET_CACHE = 'assets-cache-v1';

// Only pre-cache the home page and logo on install.
// Every game page caches itself on first visit and auto-updates on each visit.
const PRECACHE_URLS = [
  '/index.html',
  '/image/logo-nobg.png',
];

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(() => console.warn(`Pre-cache failed: ${url}`))
        )
      )
    )
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          // Delete any old cache that isn't one of our three named buckets
          if (key !== CACHE_NAME && key !== FONT_CACHE && key !== ASSET_CACHE) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  const isFont  = url.hostname === 'fonts.googleapis.com' ||
                  url.hostname === 'fonts.gstatic.com';

  const isCDN   = url.hostname === 'cdnjs.cloudflare.com' ||
                  url.hostname.includes('lichess1.org');

  const isHtml  = req.headers.get('accept')?.includes('text/html') ||
                  url.pathname.endsWith('.html') ||
                  url.pathname === '/';

  // ── Fonts & CDN: Cache-first (they never change) ─────────────────────────
  if (isFont || isCDN) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(isFont ? FONT_CACHE : ASSET_CACHE)
              .then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => caches.match(req));
      })
    );
    return;
  }

  // ── HTML pages: Network-first ────────────────────────────────────────────
  // Each game page updates itself automatically whenever the user visits
  // while online. No need to bump CACHE_NAME just to push a game update.
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ── Everything else (images, local JS, Stockfish WASM, audio): ───────────
  // Network-first so files update when changed; falls back to cache offline.
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

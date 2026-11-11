// Adipotech Service Worker
// Caching policy:
// - HTML pages: NetworkFirst (fresh content, offline fallback to cache)
// - Static assets (CSS/JS/fonts/icons): CacheFirst (fast, version-busted)
// - Images/PDFs: StaleWhileRevalidate (instant + background refresh)
// - ALL API calls: NetworkOnly (never cache dynamic/user data)
// - Non-GET requests: passthrough (never intercept writes)

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `adipotech-static-${CACHE_VERSION}`;
const PAGES_CACHE = `adipotech-pages-${CACHE_VERSION}`;
const MEDIA_CACHE = `adipotech-media-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/favicon.svg',
];

const STATIC_EXTENSIONS = /\.(css|js|mjs|woff2?|ttf|otf|eot)$/i;
const MEDIA_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg|ico|pdf|mp4|webm|ogg|mp3|wav)$/i;

// API paths that must NEVER be cached. Any request matching these is forced NetworkOnly.
const API_PREFIXES = [
  '/api/',
  '/comments',
  '/likes',
  '/subscriptions',
  '/donations',
  '/entitlements',
  '/notifications',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('adipotech-') && ![STATIC_CACHE, PAGES_CACHE, MEDIA_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Rule 0: Never intercept non-GET. Writes (comments, likes, donations, auth) must go straight to network.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Rule 1: Cross-origin GETs (e.g. Paystack, CDN) are passthrough — do not cache third-party responses.
  if (!isSameOrigin(url)) {
    return;
  }

  // Rule 2: API GETs are NetworkOnly — never cached, never served stale.
  if (isApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Rule 3: HTML navigation — NetworkFirst with offline fallback to cached page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Rule 4: Static assets — CacheFirst.
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Rule 5: Media (images/PDFs/video/audio) — StaleWhileRevalidate.
  if (MEDIA_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Rule 6: Everything else — network, no caching.
  event.respondWith(fetch(request));
});
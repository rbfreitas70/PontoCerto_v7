/* ═══════════════════════════════════════════════
   PontoCerto — Service Worker v2.1
   Funciona em qualquer subdiretório (GitHub Pages, etc.)
   ═══════════════════════════════════════════════ */

const CACHE_NAME = 'pontocerto-v2';
const CDN_CACHE  = 'pontocerto-cdn-v2';

/* Base detectada do próprio SW — funciona em qualquer subdiretório */
const SW_URL = self.location.href;
const BASE   = SW_URL.substring(0, SW_URL.lastIndexOf('/') + 1);

const CDN_ORIGINS = [
    'https://unpkg.com',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
    const assets = [
        BASE,
        BASE + 'index.html',
        BASE + 'sw.js',
        BASE + 'icons/icon-192x192.png',
        BASE + 'icons/icon-512x512.png',
    ];
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.allSettled(
                assets.map(url =>
                    fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
                )
            ))
            .then(() => self.skipWaiting())
    );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

/* ── FETCH ── */
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET') return;
    if (url.protocol === 'chrome-extension:' || url.protocol === 'blob:') return;

    if (url.origin === self.location.origin) {
        event.respondWith(cacheFirst(req));
        return;
    }
    if (CDN_ORIGINS.some(o => req.url.startsWith(o))) {
        event.respondWith(staleWhileRevalidate(req));
        return;
    }
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        if (request.mode === 'navigate') {
            const fallback = await caches.match(BASE + 'index.html');
            return fallback || new Response('Offline', { status: 503 });
        }
        return new Response('Offline', { status: 503 });
    }
}

async function staleWhileRevalidate(request) {
    const cache  = await caches.open(CDN_CACHE);
    const cached = await cache.match(request);
    const netP   = fetch(request)
        .then(r => { if (r && r.ok) cache.put(request, r.clone()); return r; })
        .catch(() => null);
    return cached || await netP || new Response('Offline', { status: 503 });
}

self.addEventListener('message', e => {
    if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

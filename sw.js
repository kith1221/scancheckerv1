// ScanChecker Service Worker v2.0
const CACHE_NAME = 'scanchecker-v3';
const STATIC_ASSETS = [
  '/scan_checker/',
  '/scan_checker/css/style.css',
  '/scan_checker/css/animations.css',
  '/scan_checker/js/app.js',
  '/scan_checker/js/courier.js',
  '/scan_checker/js/scan.js',
  '/scan_checker/js/database_view.js',
  '/scan_checker/assets/html5-qrcode.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for API calls
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, message: 'Offline — tidak dapat terhubung ke server' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

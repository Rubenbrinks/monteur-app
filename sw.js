// ── Emondt Materiaalapp – Service Worker ──────────────────────
const CACHE_NAAM = 'emondt-materiaalapp-v2.0.0';

const TE_CACHEN = [
  './',
  './index.html',
  './OneSignalSDKWorker.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon-16.png',
  // CSS modules
  './css/variables.css',
  './css/layout.css',
  './css/components.css',
  './css/artikelen.css',
  './css/pages.css',
  // JS modules
  './js/config.js',
  './js/ui.js',
  './js/auth.js',
  './js/api.js',
  './js/artikelen.js',
  './js/cart.js',
  './js/beheer.js',
  './js/app.js',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAAM).then(cache => {
      const lokaal = TE_CACHEN.filter(url => !url.startsWith('http'));
      const extern = TE_CACHEN.filter(url => url.startsWith('http'));
      return cache.addAll(lokaal).then(() =>
        Promise.all(
          extern.map(url =>
            fetch(url, { mode: 'no-cors' })
              .then(res => cache.put(url, res))
              .catch(() => {})
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(
        namen.filter(n => n !== CACHE_NAAM).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document';

  if (isHTML) {
    event.respondWith(
      caches.open(CACHE_NAAM).then(cache =>
        cache.match('./index.html').then(cached => {
          const fetchPromise = fetch(event.request, { cache: 'no-store' })
            .then(res => {
              if (res && res.ok) cache.put('./index.html', res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => cached ||
        fetch(event.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAAM).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => {})
      )
    );
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

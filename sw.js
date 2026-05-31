// ── Emondt Materiaalapp – Service Worker ──────────────────────
const CACHE_NAAM = 'emondt-materiaalapp-v3.1.9';

const TE_CACHEN = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAAM).then(cache => cache.addAll(TE_CACHEN))
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
      caches.open(CACHE_NAAM).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request)
            .then(res => { if (res && res.ok) cache.put(event.request, res.clone()); return res; })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

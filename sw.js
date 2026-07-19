// ── Emondt Materiaalapp – Service Worker ──────────────────────
const CACHE_NAAM = 'emondt-materiaalapp-v4.1.3';

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
  // Alleen http(s) cachen — sla bv. chrome-extension:// verzoeken over.
  if (!event.request.url.startsWith('http')) return;
  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document';

  // Alleen de app zelf (root of index.html) valt terug op de gecachte index.html.
  // Andere pagina's (bv. behandeling.html) mogen NIET door index.html vervangen worden.
  const isApp = isHTML && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'));

  if (isApp) {
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
  } else if (isHTML) {
    // Overige HTML-pagina's: netwerk-eerst, cache als fallback (offline).
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res && res.ok) {
            const kopie = res.clone();
            caches.open(CACHE_NAAM).then(c => c.put(event.request, kopie));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
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

// ── PUSHMELDINGEN ─────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch(e) { data = { body: event.data ? event.data.text() : '' }; }

  const titel = data.titel || 'Emondt Monteurapp';
  const opties = {
    body:  data.body || '',
    icon:  './icon-192.png',
    badge: './icon-192.png',
    tag:   data.tag || 'emondt-melding',
    data:  { url: data.url || './index.html#historie' },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(titel, opties));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const doel = event.notification.data?.url || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lijst => {
      for (const c of lijst) { if ('focus' in c) { c.navigate?.(doel); return c.focus(); } }
      if (clients.openWindow) return clients.openWindow(doel);
    })
  );
});

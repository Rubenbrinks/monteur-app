// ── Emondt Materiaalapp – Service Worker ──────────────────────
// Versie verhogen = cache automatisch vernieuwen bij volgende bezoek
const CACHE_NAAM = 'emondt-materiaalapp-v3';

// Statische bestanden die gecached worden (iconen, fonts)
const ASSETS_CACHEN = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
];

// ── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAAM)
      .then(cache => cache.addAll(ASSETS_CACHEN))
      .then(() => self.skipWaiting()) // activeer direct, wacht niet
  );
});

// ── ACTIVATE: verwijder ALLE oude caches ──────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(
        namen
          .filter(naam => naam !== CACHE_NAAM)
          .map(naam => caches.delete(naam))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ── HTML (index.html / root): ALTIJD netwerk eerst ────────
  // Zo laadt de app altijd de nieuwste versie als er verbinding is.
  // Alleen als het netwerk faalt valt hij terug op cache.
  if (event.request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname === '') {

    event.respondWith(
      fetch(event.request, { cache: 'no-store' }) // nooit browser-cache
        .then(res => {
          // Sla verse versie op in cache voor offline gebruik
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAAM).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Geen netwerk → gebruik gecachte versie als fallback
          return caches.match('./index.html');
        })
    );
    return;
  }

  // ── Externe requests (Sheets API, Google Fonts): altijd netwerk ──
  if (!url.origin.includes(self.location.origin)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // ── Statische assets (iconen, manifest): cache-first ──────
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAAM).then(c => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

// ── Update melding naar clients sturen ────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

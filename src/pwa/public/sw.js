/**
 * CREDIT-ON — Service Worker para Soporte Offline de la PWA
 * =========================================================
 * Estrategia de cacheo: Network-First con fallback a Cache para la API,
 * y Cache-First para los bundles de la interfaz gráfica.
 */

const CACHE_NAME = 'credit-on-pwa-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo-credit-on.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purgando caché obsoleta:', key);
            return caches.delete(key);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Estrategia Network-First con fallback en Cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clonar y guardar copia en cache
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
            cache.put(event.request, clone);
          }
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

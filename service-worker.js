// service-worker.js

const CACHE_NAME = 'tour360-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './load_media_list.json',
  './js/aframe.min.js',
  './js/aframe-stereo-component.min.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Cache inicial (install)
// Aí ele roda cache.addAll, assumindo que todos os PRECACHE_URLS existem e retornam 200.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Intercepta fetch
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (
    PRECACHE_URLS.some(path => url.pathname.includes(path)) ||
    req.destination === 'image' ||
    req.destination === 'video' ||
    req.destination === 'script'
  ) {
    event.respondWith(
      caches.match(req).then(cachedRes => {
        if (cachedRes) {
          // Se encontrar no cache, devolve na hora
          return cachedRes;
        }

        // Não achou no cache → faz fetch e só cacheia se status for 200
        return fetch(req).then(fetchRes => {
          // Se a resposta não for “ok” (=status 200–299) ou for 206, devolve sem cachear
          if (!fetchRes || fetchRes.status !== 200) {
            // opcional: loga o motivo
            console.warn(
              '[SW] Não cacheando resposta não-200:',
              fetchRes.status,
              req.url
            );
            return fetchRes;
          }

          // Resposta 200: agora sim coloca no cache
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(req, fetchRes.clone());
            return fetchRes;
          });
        }).catch(err => {
          // Se der erro de rede, opcionalmente devolve algo fallback ou simplesmente bota o erro pra ver no console
          console.error('[SW] Fetch falhou pra', req.url, err);
          throw err;
        });
      })
    );
  }
  // Se não for desses tipos, deixa passar pro navegador sem interceptar
});

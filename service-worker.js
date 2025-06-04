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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

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
        if (cachedRes) return cachedRes;
        return fetch(req).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(req, fetchRes.clone());
            return fetchRes;
          });
        });
      }).catch(() => {
        // poderia retornar fallback aqui, mas é opcional
      })
    );
  }
});

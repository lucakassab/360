// service-worker.js

const CACHE_NAME = 'tour360-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './load_media_list.json',
  './js/aframe.min.js',
  './js/aframe-stereo-component.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Cache inicial
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

// Intercepta requisições: 
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Se for JSON ou JS/CSS/HTML/vídeo/imagem requisitado → tenta responder do cache primeiro
  if (PRECACHE_URLS.some(path => url.pathname.includes(path)) ||
      req.destination === 'image' ||
      req.destination === 'video' ||
      req.destination === 'script') {
    event.respondWith(
      caches.match(req).then(cachedRes => {
        if (cachedRes) return cachedRes;
        return fetch(req).then(fetchRes => {
          // Armazena no cache dinâmico
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(req, fetchRes.clone());
            return fetchRes;
          });
        });
      }).catch(() => {
        // Poderia retornar fallback se quiser (imagem estática, por exemplo)
      })
    );
  }
  // Demais requisições (ex.: fontes, etc): deixa ir direto na rede
});

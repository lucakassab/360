// sw.js
const CACHE_STATIC = 'static-v2';
const CACHE_MEDIA  = 'media-v2';

// **NÃO ESQUECE** desse array, sem ele vai dar ReferenceError
const STATIC_FILES = [
  'index.html',
  'manifest.webmanifest',
  'libs/aframe.min.js',
  'libs/aframe-stereo-component.js',
  'js/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// força o SW novo a ativar na hora
self.addEventListener('install', ev => {
  console.log('[SW] Install');
  self.skipWaiting();
  ev.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => console.log('[SW] Static cached'))
      .catch(err => console.warn('[SW] Falha no cache estático:', err))
  );
});

self.addEventListener('activate', ev => {
  console.log('[SW] Activate');
  self.clients.claim();
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_MEDIA)
          .map(old => caches.delete(old).then(() => console.log('[SW] Deletado cache:', old)))
      )
    )
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  const url = req.url;

  // dinamicamente cacheia tudo que vier de /media/
  if (url.includes('/media/')) {
    ev.respondWith(
      caches.match(req).then(hit => {
        if (hit) {
          console.log('[SW] Media cache hit:', url);
          return hit;
        }
        console.log('[SW] Media fetch+cache:', url);
        return fetch(req).then(res => {
          return caches.open(CACHE_MEDIA).then(cache => {
            cache.put(req, res.clone());
            console.log('[SW] Media armazenada:', url);
            return res;
          });
        });
      })
    );
    return;
  }

  // para os arquivos estáticos listados
  if (STATIC_FILES.some(f => url.endsWith(f))) {
    ev.respondWith(
      caches.match(req).then(res => {
        console.log('[SW] Static serve do cache:', url);
        return res;
      })
    );
  }
  // o resto passa normal
});

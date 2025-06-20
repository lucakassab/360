// sw.js
const CACHE_STATIC = 'static-v3';
const CACHE_MEDIA  = 'media-v2';

// lista fixa de arquivos estáticos, agora incluindo o OrbitControls
const STATIC_FILES = [
  'index.html',
  'manifest.webmanifest',
  'libs/aframe.min.js',
  'libs/aframe-stereo-component.js',
  'libs/three.module.js',
  'libs/OrbitControls.js',
  'js/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', ev => {
  console.log('[SW] Install v3');
  self.skipWaiting();
  ev.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => console.log('[SW] Static v3 cached'))
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

  // tudo de /media/ no cache-media dinamicamente
  if (url.includes('/media/')) {
    ev.respondWith(
      caches.match(req).then(hit => {
        if (hit) {
          console.log('[SW] Media cache hit:', url);
          return hit;
        }
        console.log('[SW] Media fetch+cache:', url);
        return fetch(req).then(res => caches.open(CACHE_MEDIA).then(cache => {
          cache.put(req, res.clone());
          console.log('[SW] Media armazenada:', url);
          return res;
        }));
      })
    );
    return;
  }

  // arquivos estáticos fixos
  if (STATIC_FILES.some(f => url.endsWith(f))) {
    ev.respondWith(
      caches.match(req).then(res => {
        console.log('[SW] Static serve:', url);
        return res;
      })
    );
    return;
  }

  // pro resto, vai pra rede
});
  
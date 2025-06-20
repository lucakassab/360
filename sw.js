// sw.js
const CACHE_STATIC = 'static-v5';
const CACHE_MEDIA  = 'media-v2';

const STATIC_FILES = [
  'index.html',
  'manifest.webmanifest',
  'libs/three.module.js',
  'libs/aframe.module.js',
  'libs/aframe-stereo-component.js',
  'libs/OrbitControls.js',
  'js/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', ev => {
  console.log('[SW] Install v5');
  self.skipWaiting();
  ev.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => console.log('[SW] Static v5 cached'))
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
          .map(old => caches.delete(old).then(() => console.log('[SW] Cache excluído:', old)))
      )
    )
  );
});

self.addEventListener('fetch', ev => {
  const url = ev.request.url;
  if (url.includes('/media/')) {
    ev.respondWith(
      caches.match(ev.request).then(hit => hit || fetch(ev.request).then(res =>
        caches.open(CACHE_MEDIA).then(cache => {
          cache.put(ev.request, res.clone());
          console.log('[SW] Media armazenada:', url);
          return res;
        })
      ))
    );
    return;
  }
  if (STATIC_FILES.some(f => url.endsWith(f))) {
    ev.respondWith(caches.match(ev.request));
  }
});

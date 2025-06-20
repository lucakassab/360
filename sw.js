// sw.js
const CACHE_STATIC = 'static-v1';
const CACHE_MEDIA = 'media-v1';

const STATIC_FILES = [
  'index.html',
  'manifest.webmanifest',
  'libs/aframe.min.js',
  'libs/aframe-stereo-component.js',
  'js/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_FILES))
      .catch(err => console.warn('Static cache falhou:', err))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_STATIC && k !== CACHE_MEDIA)
        .map(old => caches.delete(old))
      )
    )
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // se é /media/, faz cache-first dinâmico
  if (req.url.includes('/media/')) {
    e.respondWith(
      caches.match(req).then(cached =>
        cached ||
        fetch(req).then(net => {
          return caches.open(CACHE_MEDIA)
            .then(cache => { cache.put(req, net.clone()); return net; });
        })
      )
    );
    return;
  }
  // pra static files só serve do cache
  if (STATIC_FILES.some(f => req.url.endsWith(f))) {
    e.respondWith(caches.match(req));
  }
});

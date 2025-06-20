LES = [
  'index.html',
  'manifest.webmanifest',
  'libs/aframe.min.js',
  'libs/aframe-stereo-component.js',
  'js/main.js'
];
const MEDIA_FILES = [
  // seus arquivos de mídia
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => caches.open(CACHE_MEDIA).then(mediaCache => mediaCache.addAll(MEDIA_FILES)))
      .catch(err => console.warn('Cache addAll falhou:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_STATIC && key !== CACHE_MEDIA)
          .map(old => caches.delete(old))
    ))
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (STATIC_FILES.includes(req.url.split('/').pop()) || MEDIA_FILES.includes(req.url.split('/').pop())) {
    event.respondWith(
      caches.match(req).then(resp => resp || fetch(req).then(fetchResp => {
        const cacheName = STATIC_FILES.includes(req.url.split('/').pop()) ? CACHE_STATIC : CACHE_MEDIA;
        caches.open(cacheName).then(c => c.put(req, fetchResp.clone()));
        return fetchResp;
      }))
    );
  }
});
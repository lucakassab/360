// sw.js
const CACHE_STATIC = 'static-v1';
const CACHE_MEDIA = 'media-v1';

const STATIC_FILES = [
  '/',
  'index.html',
  'manifest.webmanifest',
  'libs/aframe.min.js',
  'libs/aframe-stereo-component.js',
  'js/main.js'
];
const MEDIA_FILES = [
  ...new Set([ // garante sem duplicatas
    // lista urls do array MEDIA
    'media/sala.jpg',
    'media/praia_Mono.jpg',
    'media/video360.mp4'
  ])
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_FILES))
      .then(() => caches.open(CACHE_MEDIA).then(cache => cache.addAll(MEDIA_FILES)))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_STATIC && key !== CACHE_MEDIA)
          .map(oldKey => caches.delete(oldKey))
    ))
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (STATIC_FILES.includes(url.pathname) || MEDIA_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(resp => resp || fetch(event.request).then(fetchResp => {
        const cacheName = MEDIA_FILES.includes(url.pathname) ? CACHE_MEDIA : CACHE_STATIC;
        caches.open(cacheName).then(cache => cache.put(event.request, fetchResp.clone()));
        return fetchResp;
      }))
    );
  }
});
// sw.js
const CACHE_STATIC = 'static-v3';
const CACHE_MEDIA  = 'media-v2';

const STATIC_FILES = [
  'index.html',
  'manifest.webmanifest',
  'libs/aframe.min.js',
  'libs/aframe-stereo-component.js',
  'libs/OrbitControls.js',
  'js/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', ev => {
  self.skipWaiting();
  ev.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(STATIC_FILES))
  );
});

self.addEventListener('activate', ev => {
  self.clients.claim();
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k=>k!==CACHE_STATIC&&k!==CACHE_MEDIA)
            .map(old=>caches.delete(old))
      )
    )
  );
});

self.addEventListener('fetch', ev => {
  const url = ev.request.url;
  if (url.includes('/media/')) {
    ev.respondWith(
      caches.match(ev.request).then(hit=>hit||fetch(ev.request).then(res=>
        caches.open(CACHE_MEDIA).then(c=>c.put(ev.request,res.clone())).then(()=>res)
      ))
    );
    return;
  }
  if (STATIC_FILES.some(f=>url.endsWith(f))) {
    ev.respondWith(caches.match(ev.request));
  }
});

// sw.js

const CACHE_NAME = 'vr-pwa-v2';
const ASSETS = [
  '/', '/index.html', '/core.js', '/manifest.webmanifest',
  '/sw.js',
  '/libs/three.module.js',
  '/libs/XRControllerModelFactory.js',
  '/libs/XRHandModelFactory.js',
  '/platforms/desktop.js',
  '/platforms/mobile.js',
  '/platforms/vr.js',
  '/platforms/generic_vr.js',
  '/platforms/vr/quest.js',
  '/platforms/vr/generic_vr.js',
  '/platforms/vr/vr_dbg_widget.js',
  '/icons/icon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-256x256.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-192x192.png',
  '/icons/maskable-icon-512x512.png',
  '/media/media.json',
  '/media/image_1_Mono.jpg',
  '/media/image_2_Stereo.jpg',
  '/media/image_3_Stereo.jpg',
  '/media/image_4_Stereo.jpg',
  '/media/video_5_Stereo.mp4',
  '/media/video_6_Mono.mp4'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(old => caches.delete(old))
      ))
      .then(() => self.clients.claim())
  );
});

// intercepta todas as requisições

self.addEventListener('fetch', evt => {
  // 1) navegação → tenta rede, senão devolve index.html
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 2) outros assets → cache first, depois rede + cache

  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;
      return fetch(evt.request).then(res => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(evt.request, res.clone());
          return res;
        });
      });
    })
  );
});

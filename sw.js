const CACHE_NAME = '360-viewer-cache-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './core.js',
  './manifest.webmanifest',
  './libs/three.module.js',
  './platforms/desktop.js',
  './platforms/mobile.js',
  './platforms/vr.js',
  './platforms/vr/vr_dbg_widget.js',
  './platforms/vr/generic_vr.js',
  './platforms/vr/quest.js',
  './media/media.json',
  // Ícones
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/maskable-icon-512x512.png',
  // Mídias locais (use apenas os que você tem offline)
  './media/image_1_Mono.jpg',
  './media/image_2_Stereo.jpg',
  './media/image_3_Stereo.jpg',
  './media/image_4_Stereo.jpg',
  './media/video_5_Stereo.mp4',
  './media/video_6_Mono.mp4'
];

self.addEventListener('install', event => {
  console.log('[SW] Instalando e cacheando arquivos...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(asset => cache.add(asset))
      );
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request);
    })
  );
});

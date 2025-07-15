// sw.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Ativa imediatamente o novo SW
workbox.core.skipWaiting();
workbox.core.clientsClaim();

// Precaching (será injetado pelo injectManifest)
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// CacheFirst + range para vídeos e imagens
workbox.routing.registerRoute(
  ({request}) => request.destination === 'video' || request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'media-cache',
    plugins: [
      new workbox.rangeRequests.RangeRequestsPlugin(),
      new workbox.cacheableResponse.CacheableResponsePlugin({statuses: [200]}),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ]
  })
);

// Stale-while-revalidate para scripts, estilos, documentos
workbox.routing.registerRoute(
  ({request}) => ['script','style','document'].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({statuses: [200]})
    ]
  })
);

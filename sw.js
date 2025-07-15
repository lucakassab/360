import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Injeta automaticamente os assets no precache a partir do manifest gerado
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache dinâmico para vídeos e imagens (inclui range requests)
registerRoute(
  ({ request }) =>
    request.destination === 'video' || request.destination === 'image',
  new CacheFirst({
    cacheName: 'media-cache',
    plugins: [
      new RangeRequestsPlugin(),
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dias
      }),
    ],
  })
);

// Cache para scripts, estilos e documentos (stale-while-revalidate)
registerRoute(
  ({ request }) =>
    ['script', 'style', 'document'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  })
);

// Ativa imediatamente novo Service Worker
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

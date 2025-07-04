const STATIC_CACHE = 'static-cache-v2';
const DYNAMIC_CACHE = 'dynamic-cache-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './core.js',
  './service-worker.js',
  './libs/three.module.js',
  './libs/OrbitControls.js',
  './libs/VRButton.js',
  './media/media.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      ).then(() => self.clients.claim())
    )
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;

  // 🟢 Cache first para recursos do three.js via CDN (unpkg.com)
  if (url.hostname === 'unpkg.com') {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 📄 media.json usa network-first (pra ver novas mídias se tiver online)
  if (url.pathname.endsWith('/media/media.json')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 🖼️ Mídias cache-first
  if (url.pathname.startsWith('/media/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 🧠 Scripts de plataforma preferem rede (pra facilitar hot reload)
  if (url.pathname.startsWith('/platforms/')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 📦 Todo o resto: cache-first
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    if (req.destination === 'document') return caches.match('./');
    throw err;
  }
}

async function networkFirst(req) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    return cached || caches.match(req);
  }
}

const STATIC_CACHE   = 'static-cache-v4';
const DYNAMIC_CACHE  = 'dynamic-cache-v1';

// tudo que precisa estar 100% offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './core.js',
  './service-worker.js',

  // 3-JS & helpers
  './libs/three.module.js',
  './libs/OrbitControls.js',
  './libs/VRButton.js',

  // XR extras
  './libs/XRControllerModelFactory.js',
  './libs/XRHandModelFactory.js',
  './libs/motion-controllers.module.js',

  // GLTF loader usado pelo factory
  './loaders/GLTFLoader.js',

  // A-Frame (caso você use)
  './libs/aframe.min.js',
  './libs/aframe-stereo-component.js',

  // dados
  './media/media.json'
];

// ---------- Install ----------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache =>
        Promise.all(STATIC_ASSETS.map(async url => {
          try { await cache.add(url); }
          catch (e) { console.warn('Falhou baixar', url, e); }
        }))
      )
      .then(() => self.skipWaiting())
  );
});

// ---------- Activate ----------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map(k => caches.delete(k))
      ).then(() => self.clients.claim())
    )
  );
});

// ---------- Fetch ----------
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // unpkg → cache-first (já funcionava)
  if (url.hostname === 'unpkg.com') {
    return event.respondWith(cacheFirst(req));
  }

  // libs/  e  loaders/  — cache-first (são estáticos)
  if (url.pathname.startsWith('/libs/') || url.pathname.startsWith('/loaders/')) {
    return event.respondWith(cacheFirst(req));
  }

  // dados mutáveis
  if (url.pathname.endsWith('/media/media.json') ||
      url.pathname.startsWith('/platforms/')) {
    return event.respondWith(networkFirst(req));
  }

  // mídia pesada → cache-first
  if (url.pathname.startsWith('/media/')) {
    return event.respondWith(cacheFirst(req));
  }

  // fallback genérico
  event.respondWith(cacheFirst(req));
});

// ---------- Estratégias ----------
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh  = await fetch(req);
  const cache  = await caches.open(DYNAMIC_CACHE);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(req)) || (await caches.match(req));
  }
}

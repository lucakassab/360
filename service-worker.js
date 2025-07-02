const STATIC_CACHE = 'static-cache-v1';
const DYNAMIC_CACHE = 'dynamic-cache-v1';

// Lista de assets estáticos pra pré-cache
const STATIC_ASSETS = [
  './',
  './index.html',
  './core.js',
  './service-worker.js',
  // libs
  './libs/three.module.js',
  './libs/OrbitControls.js',
  // módulos de plataforma
  './platforms/vr.js',
  './platforms/desktop.js',
  './platforms/mobile.js',
  // JSON de lista de mídia
  './media/media.json',
];

// Instalação: pré-cache dos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Ativação: limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégias de fetch
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Só intercepta GET
  if (req.method !== 'GET') return;

  // 1) JSON da lista de mídia → Network First (quer sempre a lista mais atual)
  if (url.pathname.endsWith('/media/media.json')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) Arquivos de mídia (/media/) → Cache First (pra rodar offline)
  if (url.pathname.startsWith('/media/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 3) Todo o resto (scripts, HTML, libs, plataformas) → Cache First
  event.respondWith(cacheFirst(req));
});

// Cache First: retorna do cache ou busca e adiciona no cache dinâmico
async function cacheFirst(req) {
  const cache = await caches.match(req);
  if (cache) return cache;

  try {
    const fresh = await fetch(req);
    const cacheStorage = await caches.open(DYNAMIC_CACHE);
    cacheStorage.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    // Se for navegação e tudo falhar, retorna o index.html do cache
    if (req.destination === 'document') {
      return caches.match('./');
    }
    throw err;
  }
}

// Network First: tenta na rede, senão cai no cache
async function networkFirst(req) {
  const cacheStorage = await caches.open(DYNAMIC_CACHE);

  try {
    const fresh = await fetch(req);
    cacheStorage.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cacheStorage.match(req);
    if (cached) return cached;
    // Se não tiver, tenta no estático
    return caches.match(req);
  }
}

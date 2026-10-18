/**
 * Александр Песковский — 2026
 * Service Worker для оффлайн-кэширования и мгновенной загрузки
 */

const CACHE_NAME = 'subway-portfolio-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/scene3d.js',
  './js/subwayMap.js',
  './js/subwayAudio.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('Частичное кэширование PWA:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Игнорируем внешние запросы и запросы видео диапазона (byte range)
  if (!event.request.url.startsWith(self.location.origin) || event.request.headers.has('range')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, toCache);
        });
        return response;
      });
    }).catch(() => {
      return caches.match('./index.html');
    })
  );
});

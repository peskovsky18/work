/**
 * Александр Песковский — 2026
 * Service Worker: Автоматическая очистка устаревших кэшей и чистый Network-First
 * Гарантирует мгновенное обновление сайта на всех мобильных и десктопных устройствах
 */

const CACHE_NAME = 'subway-portfolio-v20261030_1905';

self.addEventListener('install', (event) => {
  // Немедленно активируем новый Service Worker, не дожидаясь закрытия вкладок
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Полное удаление всех старых версий кэш-хранилищ
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('[SW] Удаление устаревшего кэша:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      // Захватываем контроль над всеми открытыми клиентами
      return self.clients.claim();
    })
  );
});

// ПЕРЕХВАТ ЗАПРОСОВ: Строгий Network-First с обходом кэша для свежих деплоев
self.addEventListener('fetch', (event) => {
  // На localhost всегда идем напрямую в сеть
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return;
  }

  // Игнорируем внешние запросы и видеопотоки (Range-запросы)
  if (!event.request.url.startsWith(self.location.origin) || event.request.headers.has('range')) {
    return;
  }

  // Network-First: Всегда запрашиваем актуальный файл из сети с сервера
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((networkResponse) => {
        // Если ответ валидный, возвращаем его пользователю
        return networkResponse;
      })
      .catch(() => {
        // Только если сеть полностью отключена (оффлайн), пытаемся отдать из кэша
        return caches.match(event.request);
      })
  );
});

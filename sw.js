/**
 * Kill-switch: прежние версии сайта регистрировали Service Worker.
 * Этот файл удаляет все кэши и снимает регистрацию, чтобы браузеры
 * вернувшихся посетителей всегда получали свежую версию сайта.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});

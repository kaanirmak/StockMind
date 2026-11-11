/* StockMind Web Push Service Worker (ALR-10) */

function normalizeSameOriginRoute(rawRoute) {
  if (typeof rawRoute !== 'string') return '/dashboard';
  const trimmed = rawRoute.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || /^\/[\\]/.test(trimmed)) {
    return '/dashboard';
  }
  return trimmed;
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : 'StockMind Bildirimi';
  const body =
    typeof payload.body === 'string' && payload.body.trim()
      ? payload.body.trim()
      : 'Piyasa ve portföy güncellemesi mevcut.';
  const route = normalizeSameOriginRoute(payload.route || payload.url || '/dashboard');
  const tag =
    typeof payload.tag === 'string' && payload.tag.trim()
      ? payload.tag.trim()
      : 'stockmind-web-push';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      data: { route },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetRoute = normalizeSameOriginRoute(
    event.notification && event.notification.data && event.notification.data.route,
  );
  const targetUrl = new URL(targetRoute, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          if ('navigate' in client && typeof client.navigate === 'function') {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});

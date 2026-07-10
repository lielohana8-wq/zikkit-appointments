/* Zikkit push service worker */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'עדכון', {
    body: d.body || '',
    icon: d.icon || '/icon-192.png',
    badge: d.icon || '/icon-192.png',
    dir: 'rtl',
    lang: 'he',
    data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow((e.notification.data && e.notification.data.url) || '/'));
});

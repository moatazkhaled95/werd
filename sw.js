// Required for PWA install prompt
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'الْوِرْدُ الْقُرْآنِيُّ', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      dir: 'rtl',
      lang: 'ar',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('https://werd-moatazs-projects-f7432b84.vercel.app'));
});

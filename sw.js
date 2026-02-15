self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'وِرْدٌ', {
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

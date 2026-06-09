self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests with http/https protocols
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }
  event.respondWith(fetch(event.request));
});

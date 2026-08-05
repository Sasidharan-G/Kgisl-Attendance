const CACHE = 'kgisl-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.png', '/custom-logo.png'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put('/', copy)); return response; }).catch(() => caches.match('/')));
    return;
  }
  // App code and styles are network-first so a successful deployment is shown
  // immediately instead of an older UI bundle remaining pinned in the PWA.
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(fetch(request).then((response) => { if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone())); return response; }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone())); return response; })));
});

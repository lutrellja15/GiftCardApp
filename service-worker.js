const CACHE_NAME = 'gct-gist-sync-cache-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=sync1',
  './app.js?v=sync1',
  './manifest.json?v=sync1',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => resp).catch(()=> cached))
  );
});
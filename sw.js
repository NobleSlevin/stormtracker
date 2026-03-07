const CACHE = 'stormwatch-v45';
const ASSETS = ['/', '/index.html', '/app.js', '/icon.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first for API calls, cache-first for assets
  if (e.request.url.includes('api.weather.gov') ||
      e.request.url.includes('zippopotam') ||
      e.request.url.includes('nominatim') ||
      e.request.url.includes('ip-api')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"features":[]}', {headers:{'Content-Type':'application/json'}})));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});

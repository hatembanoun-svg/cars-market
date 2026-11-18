// sw.js – Cars Market DZ Service Worker
// غيّر رقم النسخة عند أي تحديث كبير حتى يُحذف الكاش القديم.
const CACHE_NAME = 'cars-market-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './listings.html',
  './styles.css',
  './cars.css',
  './app.js',
  './map.js',
  './data.js',
  './fx.js',
  './manifest.json',
  './assets/logo.png',
  './assets/icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const NETWORK_ONLY = ['firestore.googleapis.com', 'firebase', 'identitytoolkit', 'securetoken', 'gstatic.com/firebasejs', 'tile.openstreetmap.org', 'wa.me'];

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // الـ Service Worker يتعامل مع ملفات موقعنا فقط. الطلبات الخارجية (Firebase وLeaflet والخطوط والخريطة)
  // يتركها للمتصفح مباشرة، فلا تخضع لـ connect-src في CSP ويبقى كاش المتصفح العادي يعمل.
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.some(p => req.url.includes(p))) return;

  const sameOrigin = true;
  const isCode = sameOrigin && (req.mode === 'navigate' || ['document', 'script', 'style', 'manifest'].includes(req.destination));

  if (isCode) {
    // الشبكة أولاً: يرى المستخدم آخر نسخة دائماً، والكاش للعمل دون اتصال فقط
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const res = await fetch(req);
        if (res && res.status === 200) event.waitUntil(cache.put(req, res.clone()));
        return res;
      } catch (err) {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })());
    return;
  }

  // صور وخطوط وملفات Leaflet: الكاش أولاً مع تحديث في الخلفية
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const refresh = fetch(req).then(res => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(refresh); return cached; }
    return (await refresh) || Response.error();
  })());
});

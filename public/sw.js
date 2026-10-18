// Offline support. App files are fingerprinted by the build, so network-first keeps updates instant
// while the cache lets the app open with no connection. Web fonts from the CDN are cache-first.
const CACHE = 'expiry-app-v1';
const FONTS = 'expiry-fonts';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(FONTS).then((cache) => cache.match(request).then((hit) =>
      hit || fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      fetch(request, { cache: 'no-cache' })
        .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
        .catch(() => cache.match(request, { ignoreSearch: true }).then((hit) => hit || cache.match('./'))),
    ),
  );
});

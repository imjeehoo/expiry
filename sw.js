// Offline app shell: network first (so updates land immediately), cache when offline.
const CACHE = 'expiry-v20';
const FONTS = 'expiry-fonts';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'xlsx.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Pretendard from the CDN: cache-first so the font also works offline.
  if (e.request.method === 'GET' && new URL(e.request.url).hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(FONTS).then((cache) => cache.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      fetch(e.request, { cache: 'no-cache' })
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cache.match(e.request, { ignoreSearch: true }))
    )
  );
});

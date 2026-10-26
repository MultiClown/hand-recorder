// Offline support. Network first, so a published update shows up as soon as
// the phone is online; the cached copy is used when there is no connection.
const CACHE = 'hand-recorder-v5';
const FILES = [
  './', 'index.html', 'styles.css', 'js/app.js', 'js/engine.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Always ask the server for the newest copy (GitHub Pages lets browsers reuse files for 10 minutes).
  const fresh = new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' });
  e.respondWith(
    fetch(fresh)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});

const CACHE = 'anna40-v2';
const ASSETS = [
  '/index.html', '/main.css', '/app.js', '/auth.js', '/config.js',
  '/gallery.js', '/geocoder.js', '/map.js', '/sheets.js', '/ui.js',
  '/manifest.json', '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // APIs externes (Google, googleapis...): sempre xarxa, sense caché
  if (!url.pathname.match(/\.(html|css|js|json|png|jpg|jpeg|svg|ico|webp)$/)) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Fitxers locals: network-first per rebre sempre la versió més nova
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

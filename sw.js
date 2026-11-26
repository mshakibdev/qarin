/* Service worker — offline reading for the Qarin collection */
const VERSION = '198a450cfb';
const CORE = 'qarin-core-' + VERSION;
const FILES = 'qarin-files';           // PDFs / DOCX, cached when first opened
const PRECACHE = ["/", "/a/qarin-tinti-lokkhon/", "/a/qarin-wasoasa-3-lokkhon/", "/a/qarin-sokriyotar-karon/", "/a/mathay-bipojjonok-lokkhon/", "/a/qarin-o-byarthota/", "/a/qarin-dokholer-chikitsa/", "/a/qarin-sokriyotar-karon-2/", "/a/hasader-shoytan-theke-shifa/", "/a/qarin-adhipottyer-rohosso/", "/a/qarin-dokhol-karon-lokkhon-chikitsa/", "/a/qarin-o-snayutontro/", "/404.html", "/assets/style.css?v=198a450cfb", "/assets/app.js?v=198a450cfb", "/manifest.webmanifest", "/search-index.json", "/fonts/HindSiliguri-Regular.woff2", "/fonts/HindSiliguri-SemiBold.woff2", "/fonts/HindSiliguri-Bold.woff2", "/fonts/Amiri-Regular.woff2", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/favicon-48.png"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('qarin-core-') && k !== CORE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Pages: network first so new articles show up, fall back to the cached copy offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CORE).then((c) => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then((r) => r || caches.match(url.pathname.endsWith('/') ? url.pathname : url.pathname + '/'))
          .then((r) => r || caches.match('/404.html'))
      )
    );
    return;
  }

  // Downloads: cache after first open so they also work offline
  if (url.pathname.startsWith('/downloads/')) {
    e.respondWith(
      caches.open(FILES).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  // Everything else: cache first
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CORE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});

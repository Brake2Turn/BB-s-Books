// Offline support: the app shell is cached up front, book covers as they're viewed.
const VERSION = 'v16';
const SHELL = `bbs-shell-${VERSION}`;
const COVERS = 'bbs-covers';
const MAX_COVERS = 400; // oldest covers are dropped beyond this, so the cache can't grow forever

const SHELL_FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/db.js',
  'js/lookup.js',
  'js/scanner.js',
  'js/scan-flow.js',
  'js/covers.js',
  'js/icons.js',
  'js/demo.js',
  'js/genres.js',
  'js/cover-picker.js',
  'js/ripple.js',
  'js/sound.js',
  'js/games.js',
  'fonts/fraunces-latin-full-normal.woff2',
  'fonts/fraunces-latin-full-italic.woff2',
  'fonts/nunito-sans-latin-wght-normal.woff2',
  'icons/icon.svg',
  'icons/icon-180.png',
  'vendor/zxing/zxing-reader.js',
  'vendor/zxing/zxing_reader.wasm',
  'vendor/tesseract/tesseract.min.js',
  'vendor/matter/matter.min.js',
];

// Large text-recognition files are cached the first time a cover is scanned.
const LAZY = /\/vendor\/tesseract\//;

self.addEventListener('install', (event) => {
  // 'reload' skips the browser's own cache, so a new version never stores an older copy of a file.
  event.waitUntil(caches.open(SHELL)
    .then((c) => c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bbs-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Keep the cover cache to MAX_COVERS entries, dropping the oldest first. */
async function trimCovers(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_COVERS)).map((k) => cache.delete(k)));
}

/** Store a copy of a good response (never error pages). */
function keep(cacheName, req, res) {
  if (res.ok || res.type === 'opaque') {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // The large text-recognition files: cache first, fetched the first time a cover is scanned.
    if (LAZY.test(url.pathname)) {
      event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(SHELL, req, res))));
      return;
    }
    // Everything else in the app: network first so updates arrive, the cache when offline.
    // 'no-cache' asks the server whether each file changed (cheap when it hasn't), so the page
    // never mixes a new file with an older copy the browser kept: that left icons missing.
    const fresh = req.mode === 'navigate'
      ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      : new Request(req, { cache: 'no-cache' });
    event.respondWith(
      fetch(fresh)
        .then((res) => keep(SHELL, req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Cover images: cache first so the shelves still look full offline. Only plain image
  // loads (no-cors) are cached; requests that read the image's data would need CORS copies.
  if (req.destination === 'image' && req.mode === 'no-cors') {
    event.respondWith(
      caches.open(COVERS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        c.put(req, res.clone()).then(() => trimCovers(c)).catch(() => {});
        return res;
      }))),
    );
  }
});

// Offline support: the app shell is cached up front, book covers as they're viewed.
const VERSION = 'v2';
const SHELL = `bbs-shell-${VERSION}`;
const COVERS = 'bbs-covers';

const SHELL_FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/db.js',
  'js/lookup.js',
  'js/scanner.js',
  'js/reveal.js',
  'icons/icon.svg',
  'icons/icon-180.png',
  'vendor/zxing/zxing-reader.js',
  'vendor/zxing/zxing_reader.wasm',
  'vendor/tesseract/tesseract.min.js',
];

// Large text-recognition files are cached the first time a cover is scanned.
const LAZY = /\/vendor\/tesseract\//;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bbs-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // Network first for the app itself so updates arrive; cache when offline.
    if (LAZY.test(url.pathname)) {
      event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
        return res;
      })));
      return;
    }
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true })),
    );
    return;
  }

  // Cover images: cache first so the shelves still look full offline.
  if (req.destination === 'image') {
    event.respondWith(
      caches.open(COVERS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        c.put(req, res.clone());
        return res;
      }))),
    );
  }
});

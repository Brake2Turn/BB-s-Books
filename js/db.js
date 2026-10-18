// On-device storage (IndexedDB). Her library lives here, separate from the app's code,
// so app updates replace the code but never touch this data.
//
// RULES FOR CHANGING THIS FILE (her library depends on them):
// - Never rename DB_NAME or the 'books' store: the browser would open an empty library.
// - Upgrades only ever ADD stores or indexes, in a new `if (old < N)` step. Never delete,
//   clear or rename anything in onupgradeneeded.
// - Changing the shape of a book record is done in app.js (normaliseBook), additively.

// ?demo opens a separate sample library so trying things out never touches the real one.
export const DEMO = new URLSearchParams(location.search).has('demo');
const DB_NAME = DEMO ? 'bbs-books-demo' : 'bbs-books';
const DB_VERSION = 2;

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        const old = e.oldVersion;
        if (old < 1) {
          const books = db.createObjectStore('books', { keyPath: 'id' });
          books.createIndex('isbn', 'isbn');
        }
        if (old < 2) {
          db.createObjectStore('snapshots', { keyPath: 'at' }); // automatic copies of the whole library
          db.createObjectStore('meta', { keyPath: 'key' });     // small settings: data version, last backup
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // If a newer version of the app opens in another tab, step aside so it can upgrade.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// ---------- Books ----------

export const getAll = () => tx('books', 'readonly', (s) => s.getAll());
export const get = (id) => tx('books', 'readonly', (s) => s.get(id));
export const put = (book) => tx('books', 'readwrite', (s) => s.put(book));
export const remove = (id) => tx('books', 'readwrite', (s) => s.delete(id));

/** Write many books in one go (all or nothing). */
export const putMany = (books) => tx('books', 'readwrite', (s) => { books.forEach((b) => s.put(b)); });

/** Replace the whole library in one transaction: if anything fails, nothing changes. */
export const replaceAll = (books) => tx('books', 'readwrite', (s) => {
  s.clear();
  books.forEach((b) => s.put(b));
});

// ---------- Settings ----------

export async function getMeta(key, fallback = null) {
  const row = await tx('meta', 'readonly', (s) => s.get(key));
  return row ? row.value : fallback;
}

export const setMeta = (key, value) => tx('meta', 'readwrite', (s) => s.put({ key, value }));

// ---------- Automatic copies ----------

/** Save a copy of the whole library, labelled with why it was taken. */
export const saveSnapshot = (books, reason) => tx('snapshots', 'readwrite', (s) => s.put({ at: Date.now(), reason, count: books.length, books }));

/** Every automatic copy, newest first. */
export async function listSnapshots() {
  const all = await tx('snapshots', 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.at - a.at);
}

/** Keep only the newest `keep` copies. */
export async function pruneSnapshots(keep) {
  const all = await listSnapshots();
  const old = all.slice(keep).map((x) => x.at);
  if (old.length) await tx('snapshots', 'readwrite', (s) => { old.forEach((at) => s.delete(at)); });
}

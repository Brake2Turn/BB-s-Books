// Tiny IndexedDB wrapper. Everything is stored on the device.
// ?demo opens a separate sample library so trying things out never touches the real one.
export const DEMO = new URLSearchParams(location.search).has('demo');
const DB_NAME = DEMO ? 'bbs-books-demo' : 'bbs-books';
const STORE = 'books';

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('isbn', 'isbn');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    t.onerror = () => reject(t.error);
  });
}

export const getAll = () => tx('readonly', (s) => s.getAll());
export const get = (id) => tx('readonly', (s) => s.get(id));
export const put = (book) => tx('readwrite', (s) => s.put(book));
export const remove = (id) => tx('readwrite', (s) => s.delete(id));

export async function replaceAll(books) {
  return tx('readwrite', (s) => {
    s.clear();
    books.forEach((b) => s.put(b));
  });
}

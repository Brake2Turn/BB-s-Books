import { chromium } from './pw.mjs';
import { writeFileSync } from 'fs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch();
const errors = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
await ctx.route('https://**', (r) => r.fulfill({ status: 404, body: '' }));
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));
p.on('dialog', (d) => { console.log('  confirm:', d.message()); d.accept(); });

// 1. A library saved by an OLD version of the app (database version 1, older record shape).
await p.goto('http://localhost:8123/blank-for-setup');
await p.evaluate(() => new Promise((res, rej) => {
  const req = indexedDB.open('bbs-books', 1);
  req.onupgradeneeded = () => { const s = req.result.createObjectStore('books', { keyPath: 'id' }); s.createIndex('isbn', 'isbn'); };
  req.onsuccess = () => {
    const t = req.result.transaction('books', 'readwrite');
    t.objectStore('books').put({ id: 'a1', title: 'Circe', authors: ['Madeline Miller'], isbn: '9780316556347', rating: 4, review: 'Loved it', addedAt: 1000, myOldField: 'kept?' });
    t.objectStore('books').put({ id: 'a2', title: 'Rebecca', authors: ['Daphne du Maurier'], addedAt: 2000 });
    t.oncomplete = () => { req.result.close(); res(); };
  };
  req.onerror = () => rej(req.error);
}));
await p.goto('http://localhost:8123/');
await p.waitForTimeout(1200);
let state = await p.evaluate(async () => { const db = await import('/js/db.js'); return { books: await db.getAll(), version: await db.getMeta('dataVersion'), copies: (await db.listSnapshots()).map((c) => `${c.reason} (${c.count})`) }; });
const circe = state.books.find((x) => x.id === 'a1');
console.log('1. after app update: books =', state.books.length, '| review kept:', circe.review, '| unknown field kept:', circe.myOldField, '| new fields added:', 'status' in circe && 'page' in circe, '| dataVersion:', state.version);
console.log('   automatic copies:', state.copies.join(', '));

// 2. Reload several times (as if updates arrived): nothing lost, no extra copies piling up.
for (let i = 0; i < 3; i++) { await p.reload(); await p.waitForTimeout(500); }
state = await p.evaluate(async () => { const db = await import('/js/db.js'); return { n: (await db.getAll()).length, copies: (await db.listSnapshots()).length }; });
console.log('2. after 3 reloads: books =', state.n, '| copies =', state.copies);

// 3. Restore from a backup MERGES: one new book, one newer copy of Circe (matched by ISBN, different id), one older copy of Rebecca.
const backup = { app: 'bbs-books', books: [
  { id: 'x9', title: 'Piranesi', authors: ['Susanna Clarke'], addedAt: 5000 },
  { id: 'other-id', title: 'Circe', authors: ['Madeline Miller'], isbn: '9780316556347', rating: 5, review: 'Even better second time', addedAt: 1000, updatedAt: Date.now() + 10000 },
  { id: 'a2', title: 'Rebecca', authors: ['Daphne du Maurier'], rating: 1, addedAt: 2000, updatedAt: 1 },
] };
writeFileSync(`${S}/backup.json`, JSON.stringify(backup));
await p.click('.tab[data-go="profile"]');
await p.setInputFiles('#importFile', `${S}/backup.json`);
await p.waitForTimeout(800);
state = await p.evaluate(async () => { const db = await import('/js/db.js'); return await db.getAll(); });
const byTitle = Object.fromEntries(state.map((x) => [x.title, x]));
console.log('3. after merge restore: books =', state.length, '| Circe review:', byTitle.Circe.review, '(id', byTitle.Circe.id + ')', '| Rebecca rating (older backup ignored):', byTitle.Rebecca.rating, '| Piranesi added:', !!byTitle.Piranesi);

// 4. Back up: the file has every book.
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportBtn')]);
const saved = JSON.parse(await (await import('fs')).promises.readFile(await dl.path(), 'utf8'));
console.log('4. backup file:', dl.suggestedFilename(), '| books in it:', saved.books.length, '| profile says:', await p.textContent('#backupNote'));

// 5. Restore an automatic copy: goes back in time, and today's library is copied first.
await p.waitForTimeout(300);
const copiesBefore = await p.locator('.snapshot').count();
await p.locator('.snapshot .text-btn').last().click();
await p.waitForTimeout(800);
state = await p.evaluate(async () => { const db = await import('/js/db.js'); return { n: (await db.getAll()).length, copies: (await db.listSnapshots()).map((c) => `${c.reason} (${c.count})`) }; });
console.log('5. restored oldest copy: books =', state.n, '| copies:', state.copies.join(', '), `| was ${copiesBefore} rows`);
// 6. HER PHONE TODAY: a library saved by the live version (database v2, data version 3,
//    automatic copies without a fingerprint, no 'lastSnapshot' setting). Open the new code over it.
{
  const ctx6 = await b.newContext({ serviceWorkers: 'block' });
  await ctx6.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
  await ctx6.route('https://**', (r) => r.fulfill({ status: 404, body: '' }));
  const q = await ctx6.newPage();
  q.on('pageerror', (e) => errors.push('scenario 6: ' + e.message));
  await q.goto('http://localhost:8123/blank-for-setup');
  const twoDaysAgo = Date.now() - 2 * 86400000;
  await q.evaluate((old) => new Promise((res, rej) => {
    const req = indexedDB.open('bbs-books', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      const s = db.createObjectStore('books', { keyPath: 'id' }); s.createIndex('isbn', 'isbn');
      db.createObjectStore('snapshots', { keyPath: 'at' });
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      const t = db.transaction(['books', 'snapshots', 'meta'], 'readwrite');
      const books = [
        { id: 'h1', title: 'Circe', authors: ['Madeline Miller'], isbn: '9780316556347', status: 'read', rating: 5, review: 'Her review', genre: 'Fantasy', page: 0, addedAt: old, updatedAt: old + 1000, cover: 'data:image/jpeg;base64,AAAA' },
        { id: 'h2', title: 'Rebecca', authors: ['Daphne du Maurier'], status: 'reading', page: 120, pages: 410, genre: 'Classics', addedAt: old + 2000, updatedAt: old + 3000 },
        { id: 'h3', title: 'Piranesi', authors: ['Susanna Clarke'], status: 'want', addedAt: Date.now() - 3600000, updatedAt: Date.now() - 3600000 },
      ];
      books.forEach((b) => t.objectStore('books').put(b));
      t.objectStore('snapshots').put({ at: old, reason: 'Daily copy', count: 2, books: books.slice(0, 2) });
      t.objectStore('snapshots').put({ at: old - 86400000, reason: 'Before an app update', count: 1, books: books.slice(0, 1) });
      t.objectStore('meta').put({ key: 'dataVersion', value: 3 });
      t.objectStore('meta').put({ key: 'lastBackup', value: old });
      t.oncomplete = () => { db.close(); res(); };
    };
    req.onerror = () => rej(req.error);
  }), twoDaysAgo);
  await q.goto('http://localhost:8123/');
  await q.waitForTimeout(1200);
  const after = await q.evaluate(async () => {
    const db = await import('/js/db.js');
    const books = await db.getAll();
    return { books, keys: await db.snapshotKeys(), last: await db.getMeta('lastSnapshot'), shown: document.querySelector('[data-count]').textContent };
  });
  const circe6 = after.books.find((x) => x.id === 'h1');
  const rebecca6 = after.books.find((x) => x.id === 'h2');
  console.log('6. her live library under the new code: books =', after.books.length, '| shown:', after.shown,
    '| Circe review/rating/photo kept:', circe6.review === 'Her review' && circe6.rating === 5 && circe6.cover.startsWith('data:'),
    '| Rebecca page kept:', rebecca6.page, '| copies:', after.keys.length, '| newest copy remembered:', !!(after.last && after.last.sig));
  await q.reload();
  await q.waitForTimeout(600);
  const again = await q.evaluate(async () => (await (await import('/js/db.js')).snapshotKeys()).length);
  console.log('   after reopening: copies =', again, '(no new copy when nothing changed)');
  await ctx6.close();
}
console.log('errors:', errors);
await b.close();

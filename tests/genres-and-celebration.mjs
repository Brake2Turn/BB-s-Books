import { chromium } from './pw.mjs';
import { coverSvg } from './mockcovers.mjs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${S}/barcode.y4m`] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'], serviceWorkers: 'block' });
const errors = [];
const cats = { '9780141439518': ['Fiction / Classics'], '9780316556347': ['Fiction / Fantasy / Epic'], '9781984822185': ['Fiction / Literary'], '9780307744432': [] };
await ctx.route('https://www.googleapis.com/**', (r) => {
  const q = new URL(r.request().url()).searchParams.get('q');
  const isbn = q.replace('isbn:', '');
  const titles = { '9780141439518': ['Pride and Prejudice', 'Jane Austen'], '9780316556347': ['Circe', 'Madeline Miller'], '9781984822185': ['Normal People', 'Sally Rooney'], '9780307744432': ['The Night Circus', 'Erin Morgenstern'] };
  const t = titles[isbn] || ['Pride and Prejudice', 'Jane Austen'];
  r.fulfill({ json: { items: [{ volumeInfo: { title: t[0], authors: [t[1]], description: 'A blurb.', pageCount: 400, categories: cats[isbn] || ['Fiction / Classics'], industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } }] } });
});
await ctx.route('https://openlibrary.org/**', (r) => r.fulfill({ status: 404, body: '{}' }));
// Open Library supplies subjects for the book Google has no category for
await ctx.route('https://openlibrary.org/api/books**', (r) => {
  const isbn = new URL(r.request().url()).searchParams.get('bibkeys').replace('ISBN:', '');
  if (isbn === '9780307744432') return r.fulfill({ json: { [`ISBN:${isbn}`]: { title: 'The Night Circus', authors: [{ name: 'Erin Morgenstern' }], subjects: [{ name: 'Magic' }, { name: 'Circus' }, { name: 'Fiction' }] } } });
  r.fulfill({ json: {} });
});
await ctx.route(/images-na\.ssl-images-amazon\.com\/images\/P\/(\w+)/, (r) => r.fulfill({ body: coverSvg('amz' + r.request().url().match(/P\/(\w+)/)[1]), contentType: 'image/svg+xml' }));
await ctx.route('https://covers.openlibrary.org/**', (r) => r.fulfill({ status: 404, body: '' }));
await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
  const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errors.push(m.text()); });
await p.goto('http://localhost:8123/');
// Older books saved before genres existed (no genre field at all)
await p.evaluate(async () => {
  const db = await import('/js/db.js');
  await db.put({ id: 'o1', title: 'Circe', authors: ['Madeline Miller'], isbn: '9780316556347', cover: '', rating: 0, review: '', status: 'read', addedAt: 1 });
  await db.put({ id: 'o2', title: 'Normal People', authors: ['Sally Rooney'], isbn: '9781984822185', cover: '', rating: 0, review: '', status: '', addedAt: 2 });
  await db.put({ id: 'o3', title: 'The Night Circus', authors: ['Erin Morgenstern'], isbn: '9780307744432', cover: '', rating: 0, review: '', status: '', addedAt: 3 });
});
await p.reload();
await p.waitForTimeout(3500);
const after = await p.evaluate(async () => (await import('/js/db.js')).getAll());
console.log('backfilled genres:', after.map((x) => `${x.title}=${x.genre}`).join(', '));
console.log('genre menu:', await p.locator('#genreFilter option').allTextContents());
// scan, confirm, celebrate
await p.click('#scanBtn');
await p.waitForSelector('#resultSheet.open', { timeout: 20000 });
await p.waitForTimeout(700);
await p.click('[data-choice="primary"]');
for (const [i, t] of [[1, 250], [2, 650], [3, 1100], [4, 1800]].entries()) { await p.waitForTimeout(t[1] - (i ? [250, 650, 1100, 1800][i - 1] : 0)); await p.screenshot({ path: `${S}/C${t[0]}.png` }); }
console.log('celebration text:', await p.textContent('.celebrate-big'), '|', await p.textContent('.celebrate-sub'));
await p.waitForSelector('.celebrate-text.show', { timeout: 20000 }); await p.waitForTimeout(900); await p.mouse.click(195, 720); await p.waitForFunction(() => !document.querySelector('#scanner').open, null, { timeout: 15000 });
await p.waitForTimeout(150);
await p.screenshot({ path: `${S}/C5.png` });
const all = await p.evaluate(async () => (await import('/js/db.js')).getAll());
console.log('new book genre:', all.find((x) => x.isbn === '9780141439518').genre);
await p.selectOption('#genreFilter', 'Fantasy');
console.log('Fantasy filter:', String(await p.locator('#libraryShelves .book').count()) + ' books shown');
await p.selectOption('#genreFilter', '');
// fix a genre on the book page
await p.click('[data-id="o2"]');
await p.waitForTimeout(400);
await p.screenshot({ path: `${S}/C6-detail.png` });
await p.selectOption('#dGenre', 'Romance');
await p.click('#detail [data-close]');
const o2 = (await p.evaluate(async () => (await import('/js/db.js')).getAll())).find((x) => x.id === 'o2');
console.log('edited genre:', o2.genre);
await p.click('.tab[data-go="stats"]');
console.log('stats:', (await p.locator('.stat').allTextContents()).join(' | '));
console.log('errors:', errors);
await b.close();

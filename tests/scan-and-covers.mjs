import { chromium } from './pw.mjs';
import { coverSvg } from './mockcovers.mjs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const only = process.argv[3];
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${S}/barcode.y4m`] });
const errors = [];
const svg = (label) => ({ body: coverSvg(label), contentType: 'image/svg+xml' });

async function setup({ slowCovers = 0, hangLookups = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__tracks = [];
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); window.__tracks.push(...s.getTracks()); return s; };
  });
  if (hangLookups) {
    await ctx.route('https://www.googleapis.com/**', () => {});
    await ctx.route('https://openlibrary.org/**', () => {});
  } else {
    await ctx.route('https://www.googleapis.com/**', (r) => {
      const q = new URL(r.request().url()).searchParams.get('q');
      if (q.startsWith('intitle:')) {
        return r.fulfill({ json: { items: [1, 2, 3].map((n) => ({ volumeInfo: { title: 'Pride and Prejudice', imageLinks: { thumbnail: `http://books.google.com/books/content?id=g${n}&zoom=1` } } })) } });
      }
      r.fulfill({ json: { items: [{ volumeInfo: { title: 'Pride and Prejudice', authors: ['Jane Austen'], description: 'Blurb.', categories: ['Fiction / Classics'], imageLinks: { thumbnail: 'http://books.google.com/books/content?id=g0&zoom=1' }, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780141439518' }] } }] } });
    });
    await ctx.route('https://openlibrary.org/**', (r) => r.fulfill({ status: 404, body: '{}' }));
    await ctx.route('https://openlibrary.org/search.json**', (r) => r.fulfill({ json: { docs: [{ key: '/works/OL1W', title: 'Pride and Prejudice', author_name: ['Jane Austen'] }] } }));
    await ctx.route('https://openlibrary.org/works/OL1W/editions.json**', (r) => r.fulfill({ json: { entries: [{ covers: [101, 102] }, { covers: [103] }, { covers: [-1] }, {}] } }));
  }
  await ctx.route(/images-na\.ssl-images-amazon\.com/, async (r) => { if (slowCovers) await new Promise((res) => setTimeout(res, slowCovers)); r.fulfill(svg('amazon')); });
  await ctx.route('https://covers.openlibrary.org/b/isbn/**', (r) => r.fulfill({ status: 404, body: '' }));
  await ctx.route('https://covers.openlibrary.org/b/id/**', (r) => r.fulfill(svg('ol' + r.request().url().match(/id\/(\d+)/)[1])));
  await ctx.route('https://books.google.com/**', (r) => r.fulfill(svg('google' + new URL(r.request().url()).searchParams.get('id'))));
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load|ERR_/.test(m.text())) errors.push(m.text()); });
  await p.goto('http://localhost:8123/');
  return { ctx, p };
}
const books = (p) => p.evaluate(async () => (await import('/js/db.js')).getAll());
const closed = async (p) => { await p.waitForSelector('.celebrate-text.show', { timeout: 20000 }); await p.waitForTimeout(900); await p.mouse.click(195, 720); return p.waitForFunction(() => !document.querySelector('#scanner').open, null, { timeout: 15000 }); };

if (!only || only === 'picker') {
  const { ctx, p } = await setup();
  await p.click('#scanBtn');
  await p.waitForSelector('#resultSheet.open', { timeout: 20000 });
  await p.waitForSelector('#resultSheet .cover-picker[data-state="ready"]', { timeout: 15000 });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${S}/P-sheet.png` });
  const tiles = await p.locator('#resultSheet .cover-option:not(.take-photo)').count();
  console.log('picker options:', tiles, '|', await p.textContent('#resultSheet .cover-note'));
  console.log('selected first:', await p.locator('#resultSheet .cover-option[aria-pressed="true"] img').getAttribute('src'));
  // Picking a cover changes it straight away and leaves the row where it was scrolled to.
  const rowScroll = (sel) => p.evaluate((q) => document.querySelector(q).scrollLeft, sel);
  await p.evaluate(() => { document.querySelector('#resultSheet .cover-row').scrollLeft = 60; });
  const before = await rowScroll('#resultSheet .cover-row');
  await p.locator('#resultSheet .cover-option:not(.take-photo)').nth(3).evaluate((el) => el.click());
  await p.waitForTimeout(120);
  const instant = await p.locator('#resultSheet .cover-option[aria-pressed="true"]').count();
  console.log('row scroll before/after pick:', before, await rowScroll('#resultSheet .cover-row'), '| chosen at once:', instant === 1);
  if (await rowScroll('#resultSheet .cover-row') !== before) errors.push('cover row jumped back after a pick');
  if (instant !== 1) errors.push('cover choice not shown straight away');
  await p.waitForTimeout(500);
  const chosen = await p.locator('#resultSheet .cover-option[aria-pressed="true"] img').getAttribute('src');
  console.log('picked thumb:', chosen, '| result cover now:', await p.locator('.result-cover img').last().getAttribute('src'));
  await p.click('[data-choice="primary"]');
  await closed(p);
  console.log('saved cover:', (await books(p))[0].cover);
  // book page: change cover
  await p.click('.book');
  await p.waitForTimeout(400);
  await p.click('#changeCoverBtn');
  await p.waitForSelector('#coverCard .cover-picker[data-state="ready"]', { timeout: 15000 });
  await p.screenshot({ path: `${S}/P-detail.png` });
  await p.evaluate(() => { document.querySelector('#coverCard .cover-row').scrollLeft = 80; });
  const scrolled = await rowScroll('#coverCard .cover-row');
  const pageTiles = p.locator('#coverCard .cover-option:not(.take-photo)');
  await pageTiles.nth((await pageTiles.count()) - 1).evaluate((el) => el.click()); // a tap, without Playwright scrolling it into view
  await p.waitForTimeout(150);
  const savedAtOnce = (await books(p))[0].cover;
  const rowAfter = await rowScroll('#coverCard .cover-row');
  console.log('book page: row scroll', scrolled, '->', rowAfter, '| saved at once:', savedAtOnce);
  if (rowAfter !== scrolled) errors.push('book page cover row jumped back after a pick');
  if (!(await p.locator('.detail-cover img').getAttribute('src')).includes(savedAtOnce.split('?')[0].slice(-12))) errors.push('book page cover did not change straight away');
  await p.waitForTimeout(600);
  console.log('book page change saved:', (await books(p))[0].cover);
  await ctx.close();
}

if (!only || only === 'photo') {
  const { ctx, p } = await setup();
  await p.click('#scanBtn');
  await p.waitForSelector('#resultSheet .cover-picker[data-state="ready"]', { timeout: 20000 });
  await p.click('#resultSheet .take-photo');
  await p.waitForTimeout(500);
  await p.click('#captureBtn');
  await p.waitForSelector('#resultSheet.open');
  await p.waitForTimeout(400);
  console.log('photo tile selected:', (await p.locator('#resultSheet .cover-option[aria-pressed="true"] img').getAttribute('src')).startsWith('data:'), '| take tile says:', await p.textContent('#resultSheet .take-photo span'));
  await p.click('[data-choice="primary"]');
  await closed(p);
  console.log('saved photo cover:', (await books(p))[0].cover.startsWith('data:'));
  await ctx.close();
}

if (!only || only === 'bugs') {
  // 1. Close before the camera comes on: no camera left running.
  let { ctx, p } = await setup();
  await p.click('#scanBtn');
  await p.click('#scanner [data-close]');
  await p.waitForTimeout(1500);
  console.log('camera tracks still live after quick close:', await p.evaluate(() => window.__tracks.filter((t) => t.readyState === 'live').length));
  await ctx.close();
  // 2. Try to close while a book is being added (cover still loading).
  ({ ctx, p } = await setup({ slowCovers: 2500 }));
  await p.click('#scanBtn');
  await p.waitForSelector('#resultSheet.open', { timeout: 20000 });
  await p.click('[data-choice="primary"]');
  await p.waitForTimeout(200);
  await p.click('#scanner [data-close]', { force: true });
  await p.click('[data-choice="secondary"]', { force: true }).catch(() => {});
  await closed(p);
  console.log('books after close-during-add:', (await books(p)).length, '| camera live:', await p.evaluate(() => window.__tracks.filter((t) => t.readyState === 'live').length));
  await ctx.close();
  // 3. Book databases that never answer: the lookup gives up instead of spinning forever.
  ({ ctx, p } = await setup({ hangLookups: true }));
  await p.click('#scanBtn');
  const t0 = Date.now();
  await p.waitForFunction(() => /slow|reach|find/i.test(document.querySelector('#scanStatus').textContent), null, { timeout: 25000 });
  console.log(`stalled lookup message after ${Math.round((Date.now() - t0) / 1000)}s:`, await p.textContent('#scanStatus'));
  await ctx.close();
}
console.log('errors:', errors);
await b.close();

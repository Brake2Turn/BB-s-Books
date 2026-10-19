import { chromium } from './pw.mjs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch(); // no fake camera at all
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
await ctx.route('https://www.googleapis.com/**', (r) => r.fulfill({ json: { items: [{ volumeInfo: { title: 'Pride and Prejudice', authors: ['Jane Austen'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780141439518' }] } }] } }));
await ctx.route(/amazon|covers.openlibrary/, (r) => r.fulfill({ status: 404, body: '' }));
await ctx.route('https://openlibrary.org/**', (r) => r.fulfill({ status: 404, body: '{}' }));
await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
  const q = await ctx.newPage();
const errors = [];
q.on('pageerror', (e) => errors.push(e.message));
await q.goto('http://localhost:8123/');
await q.click('#scanBtn');
await q.waitForTimeout(1000);
console.log('status:', await q.textContent('#scanStatus'));
await q.setInputFiles('#photoInput', `${S}/barcode.jpg`);
await q.waitForSelector('#resultSheet.open', { timeout: 20000 });
await q.click('[data-choice="primary"]');
await q.waitForSelector('.celebrate-text.show', { timeout: 20000 }); await q.waitForTimeout(900); await q.mouse.click(640, 700); await q.waitForFunction(() => !document.querySelector('#scanner').open, null, { timeout: 15000 });
await q.waitForTimeout(300);
await q.screenshot({ path: `${S}/laptop.png` });
console.log('count:', await q.textContent('[data-count]'));
console.log('errors:', errors);
await b.close();

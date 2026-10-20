import { chromium } from './pw.mjs';
import { coverSvg } from './mockcovers.mjs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${S}/barcode.y4m`] });
const errors = [];
async function setup(existing) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
  await ctx.route('https://www.googleapis.com/**', (r) => r.fulfill({ json: { items: [{ volumeInfo: { title: 'Pride and Prejudice', authors: ['Jane Austen'], categories: ['Fiction / Classics'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780141439518' }] } }] } }));
  await ctx.route('https://openlibrary.org/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.route(/amazon|covers\.openlibrary|books\.google/, (r) => r.fulfill({ body: coverSvg('pp'), contentType: 'image/svg+xml' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.evaluate(async (n) => {
    const db = await import('/js/db.js');
    for (let i = 0; i < n; i++) await db.put({ id: 'b' + i, title: 'Book ' + i, authors: ['A'], isbn: '', cover: '', addedAt: i, status: '', rating: 0, review: '' });
  }, existing);
  await p.reload();
  await p.waitForTimeout(500);
  return { ctx, p };
}

// 1. Headlines for every kind of number.
{
  const { ctx, p } = await setup(0);
  const lines = await p.evaluate(async () => {
    const { cheerFor } = await import('/js/scan-flow.js');
    const book = { title: 'Circe', authors: ['Madeline Miller'] };
    return [1, 2, 5, 10, 25, 50, 75, 100, 150, 200, 300, 1000, 2300].map((n) => { const c = cheerFor(n, book); return `${n}: ${c.milestone ? 'GOLD ' : ''}"${c.big}" — ${c.sub}`; });
  });
  lines.forEach((l) => console.log('  ' + l));
  await ctx.close();
}

// 2. The 5th book (a milestone) and the 4th (ordinary): gold vs colour, waits for a tap, then ripples.
for (const existing of [4, 3]) {
  const { ctx, p } = await setup(existing);
  await p.click('#scanBtn');
  await p.waitForSelector('#resultSheet.open', { timeout: 20000 });
  await p.waitForTimeout(600);
  await p.click('[data-choice="primary"]');
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `${S}/M-${existing + 1}.png` });
  const info = await p.evaluate(() => {
    const t = document.querySelector('.celebrate-text');
    const big = t.querySelector('.celebrate-big');
    return { milestone: t.classList.contains('milestone'), eyebrow: t.querySelector('.celebrate-eyebrow span').textContent, big: big.textContent, clip: getComputedStyle(big).backgroundClip || getComputedStyle(big).webkitBackgroundClip };
  });
  console.log(`book ${existing + 1}:`, info);
  await p.waitForTimeout(5000);
  console.log(`  still celebrating after 6s with no tap:`, await p.evaluate(() => document.querySelector('#scanner').classList.contains('celebrating')));
  await p.mouse.click(120, 700);
  await p.waitForTimeout(250);
  console.log('  after tap, ripple rings on screen:', await p.locator('#scanner .ripple').count());
  await p.screenshot({ path: `${S}/M-${existing + 1}-ripple.png` });
  await p.waitForFunction(() => !document.querySelector('#scanner').open, null, { timeout: 10000 });
  console.log('  back in library with', await p.textContent('[data-count]'), 'books');
  await ctx.close();
}

// 3. Count in the top right of every tab.
{
  const { ctx, p } = await setup(6);
  for (const tab of ['home', 'games', 'feedback', 'profile', 'stats', 'backup', 'appearance', 'settings']) {
    // The last four open from Profile.
    if (['stats', 'backup', 'appearance', 'settings'].includes(tab)) { await p.click('.tab[data-go="profile"]'); await p.click(`[data-go="${tab}"]`); }
    else await p.click(`.tab[data-go="${tab}"]`);
    await p.waitForTimeout(150);
    const c = await p.locator(`[data-screen="${tab}"] .header-count`).innerText();
    console.log(`  ${tab}: "${c.replace(/\n/g, ' ')}"`);
    if (tab === 'stats' || tab === 'games') await p.screenshot({ path: `${S}/H-${tab}.png` });
  }
  await ctx.close();
}
console.log('errors:', errors);
await b.close();

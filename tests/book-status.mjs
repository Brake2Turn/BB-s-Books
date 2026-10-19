// Statuses (To be read, Did not finish), how a finished book was read (Physical / Audiobook),
// author sort by surname, the Stats rows, and the scan chime on barcode and cover reads.
import { chromium } from './pw.mjs';
import { coverSvg } from './mockcovers.mjs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${S}/barcode.y4m`, '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const expect = (ok, what) => { if (!ok) errors.push(what); };

// ---------- Book page, filter, sort and stats (demo shelf) ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.route('https://**', (r) => r.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:8123/?demo');
  await p.waitForTimeout(1000);

  // Wording: "To be read" everywhere, never "Want to read".
  const options = await p.locator('#statusFilter option').allTextContents();
  console.log('status filter:', options.join(' / '));
  expect(options.join('|') === 'All books|Reading|To be read|Finished|Did not finish', 'status filter options wrong');
  expect(!(await p.content()).includes('Want to read'), '"Want to read" still on the page');

  // Author sort: A to Z by surname.
  await p.selectOption('#sort', 'author');
  await p.waitForTimeout(200);
  const authors = await p.locator('#libraryShelves .book').evaluateAll((n) => n.map((x) => x.getAttribute('aria-label').split(', ').pop()));
  console.log('author sort:', authors.join(' · '));
  const surnames = ['Austen', 'Brontë', 'Clarke', 'du Maurier', 'Garmus', 'Ishiguro', 'Ishiguro', 'Miller', 'Miller', 'Morgenstern', 'Rooney', 'Tartt', 'Yanagihara', 'Zevin'];
  expect(authors.every((a, i) => a.endsWith(surnames[i])), 'author sort is not A to Z by surname');
  await p.screenshot({ path: `${S}/T-author-sort.png` });
  await p.selectOption('#sort', 'added');

  // Did not finish: filter shows the demo's DNF book.
  await p.selectOption('#statusFilter', 'dnf');
  await p.waitForTimeout(200);
  const dnf = await p.locator('#libraryShelves .book').evaluateAll((n) => n.map((x) => x.getAttribute('aria-label')));
  console.log('did not finish filter:', dnf.join(' · '));
  expect(dnf.length === 1 && dnf[0].startsWith('Normal People'), 'DNF filter wrong');

  // Book page: DNF shows where she stopped; no format chips.
  await p.locator('#libraryShelves .book').first().click();
  await p.waitForTimeout(500);
  console.log('DNF book page:', await p.textContent('#dProgress'), '| format chips hidden:', await p.locator('.format').isHidden());
  expect(/Stopped at 35%/.test(await p.textContent('#dProgress')), 'DNF progress caption wrong');
  expect(await p.locator('.format').isHidden(), 'format chips shown for a DNF book');
  await p.screenshot({ path: `${S}/T-dnf-page.png` });

  // Mark it Finished: Physical / Audiobook appear; choose Audiobook, then switch back.
  await p.click('.status [data-status="read"]');
  await p.waitForTimeout(300);
  expect(await p.locator('.format').isVisible(), 'format chips not shown for a finished book');
  await p.click('.format [data-format="audio"]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/T-finished-audio.png` });
  let rec = await p.evaluate(async () => (await (await import('/js/db.js')).getAll()).find((x) => x.title === 'Normal People'));
  console.log('saved:', rec.status, rec.format);
  expect(rec.status === 'read' && rec.format === 'audio', 'audiobook not saved');
  await p.click('.format [data-format="physical"]');
  await p.waitForTimeout(300);
  rec = await p.evaluate(async () => (await (await import('/js/db.js')).getAll()).find((x) => x.title === 'Normal People'));
  expect(rec.format === 'physical', 'switching to physical not saved');
  expect((await p.locator('.format [aria-pressed="true"]').allTextContents()).join() === 'Physical', 'only one format should be chosen');
  // Back to Did not finish: format kept on the record but hidden; the page reached is kept.
  await p.click('.status [data-status="dnf"]');
  await p.waitForTimeout(300);
  rec = await p.evaluate(async () => (await (await import('/js/db.js')).getAll()).find((x) => x.title === 'Normal People'));
  expect(rec.status === 'dnf' && rec.page === 96, 'DNF page lost');
  expect(await p.locator('.format').isHidden(), 'format chips stay after leaving Finished');
  // Four status chips must keep 44px targets and fit the screen.
  const chipBoxes = await p.locator('.status .chip').evaluateAll((n) => n.map((x) => x.getBoundingClientRect()).map((r) => [Math.round(r.left), Math.round(r.right)]));
  expect(chipBoxes.every(([l, r]) => l >= 20 && r <= 370), 'status chips spill outside the gutters');
  await p.click('#detail [data-close]');
  await p.waitForTimeout(400);

  // Stats rows.
  await p.click('.tab[data-go="stats"]');
  await p.waitForTimeout(300);
  const stats = await p.locator('#statsCard .stat').evaluateAll((n) => n.map((x) => `${x.children[0].textContent}: ${x.children[1].textContent}`));
  console.log('stats:', stats.join(' | '));
  expect(stats.includes('To be read: 5') && stats.includes('Did not finish: 1') && stats.includes('Audiobooks: 2'), 'stats rows wrong');
  const wraps = await p.locator('#statsCard .stat').evaluateAll((n) => n.filter((x) => x.getBoundingClientRect().height > 60).length);
  expect(!wraps, 'a stats row wraps');
  await p.screenshot({ path: `${S}/T-stats.png` });
  await ctx.close();
}

// ---------- Scan chime ----------
async function chimeContext({ camera = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'], serviceWorkers: 'block' });
  // No camera for the cover case, so the fake camera's barcode can't be read first.
  if (!camera) await ctx.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('none', 'NotFoundError')); });
  await ctx.addInitScript(() => {
    window.__notes = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__notes++; return start.apply(this, a); };
    document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove());
  });
  await ctx.route('https://**', (r) => r.fulfill({ status: 404, body: '' }));
  await ctx.route('https://www.googleapis.com/**', (r) => r.fulfill({ json: { items: [{ volumeInfo: { title: 'Circe', authors: ['Madeline Miller'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780316556347' }] } }] } }));
  await ctx.route(/images-na\.ssl-images-amazon\.com/, (r) => r.fulfill({ body: coverSvg('amazon'), contentType: 'image/svg+xml' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.waitForTimeout(600);
  return { ctx, p };
}

{
  // Barcode: the fake camera shows a barcode; the chime plays as it's read.
  const { ctx, p } = await chimeContext();
  expect(await p.evaluate(() => window.__notes) === 0, 'chime played before any scan');
  await p.click('#scanBtn');
  await p.waitForSelector('#resultSheet.open', { timeout: 20000 });
  const notes = await p.evaluate(() => window.__notes);
  console.log('barcode read: oscillators started =', notes);
  expect(notes > 0 && notes <= 16, 'no chime on barcode read');
  await ctx.close();
}

{
  // Cover: a photo of a cover in Cover mode; the chime plays once the words are read.
  const { ctx, p } = await chimeContext({ camera: false });
  await p.click('#scanBtn');
  await p.waitForTimeout(800);
  await p.click('#scanner [data-mode="cover"]');
  await p.waitForTimeout(300);
  expect(await p.evaluate(() => window.__notes) === 0, 'chime played before the cover was read');
  await p.setInputFiles('#photoInput', `${S}/covers/circe.jpg`);
  await p.waitForSelector('#listSheet.open', { timeout: 120000 });
  const notes = await p.evaluate(() => window.__notes);
  console.log('cover read: oscillators started =', notes);
  expect(notes > 0, 'no chime on cover read');
  await ctx.close();
}

console.log('errors:', errors);
await b.close();

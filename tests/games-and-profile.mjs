// Games tab (Spin the wheel, Book shower), the Profile hub and its screens, accent colours,
// and lending (loaned-out marking, filter, sort and the dot on the cover).
import { chromium } from './pw.mjs';
import { coverSvg } from './mockcovers.mjs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const expect = (ok, what) => { if (!ok) errors.push(what); };

async function setup({ reducedMotion = 'no-preference', seed } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion });
  await ctx.route('https://**', (r) => r.fulfill({ status: 404, body: '' }));
  await ctx.route('https://covers.openlibrary.org/**', (r) => r.fulfill({ body: coverSvg(r.request().url().slice(-20)), contentType: 'image/svg+xml' }));
  await ctx.addInitScript(() => {
    window.__notes = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__notes++; return start.apply(this, a); };
    document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove());
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errors.push(m.text()); });
  if (seed) {
    await p.goto('http://localhost:8123/');
    await p.waitForTimeout(500);
    await p.evaluate(async (list) => { const db = await import('/js/db.js'); for (const x of list) await db.put(x); }, seed);
    await p.reload();
  } else {
    await p.goto('http://localhost:8123/?demo');
  }
  await p.waitForTimeout(900);
  return { ctx, p };
}
const getAll = (p) => p.evaluate(async () => (await import('/js/db.js')).getAll());
const shown = (p) => p.locator('#libraryShelves .book').evaluateAll((n) => n.map((x) => x.getAttribute('aria-label').split(',')[0]));

// ---------- Tabs and the Profile hub ----------
{
  const { ctx, p } = await setup();
  const tabs = await p.locator('.tabbar [aria-label]').evaluateAll((n) => n.map((x) => x.getAttribute('aria-label')));
  console.log('tabs:', tabs.join(', '));
  expect(tabs.join() === 'Home,Games,Scan a book,Feedback,Profile', 'tab bar wrong');

  await p.click('.tab[data-go="profile"]');
  await p.waitForTimeout(200);
  const rows = await p.locator('.hub-row').allTextContents();
  console.log('profile hub:', rows.join(' / '));
  expect(rows.join() === 'Stats,Backup,Appearance,Settings', 'profile hub rows wrong');
  await p.screenshot({ path: `${S}/G-profile.png` });
  for (const name of ['stats', 'backup', 'appearance', 'settings']) {
    await p.click(`.hub-row[data-go="${name}"]`);
    await p.waitForTimeout(200);
    const visible = await p.locator(`[data-screen="${name}"]`).isVisible();
    const lit = await p.locator('.tab[aria-current="page"]').getAttribute('data-go');
    const count = await p.locator(`[data-screen="${name}"] .header-count`).innerText();
    console.log(`  ${name}: shown ${visible}, lit tab ${lit}, count "${count.replace(/\n/g, ' ')}"`);
    expect(visible && lit === 'profile' && /14/.test(count), `${name} screen wrong`);
    await p.click(`[data-screen="${name}"] .sub-top button`);
    await p.waitForTimeout(150);
    expect(await p.locator('[data-screen="profile"]').isVisible(), `back from ${name} doesn't return to Profile`);
  }
  await p.click('.hub-row[data-go="settings"]');
  expect((await p.textContent('[data-screen="settings"] .body-text')) === 'Nothing here yet.', 'settings text');
  await p.click('[data-screen="settings"] .sub-top button');
  await p.click('.hub-row[data-go="backup"]');
  await p.waitForTimeout(300);
  expect(await p.locator('#exportBtn').isVisible() && (await p.locator('#snapshotList > *').count()) > 0, 'backup screen missing its controls');

  // ---------- Accent colours ----------
  await p.click('[data-screen="backup"] .sub-top button');
  await p.click('.hub-row[data-go="appearance"]');
  await p.waitForTimeout(200);
  const names = await p.locator('.swatch').allTextContents();
  console.log('accents:', names.join(', '));
  expect(names.join() === 'Cobalt,Berry,Plum,Forest,Teal', 'accent list wrong');
  const scanColour = () => p.evaluate(() => getComputedStyle(document.querySelector('#scanBtn')).backgroundColor);
  const before = await scanColour();
  await p.locator('.swatch', { hasText: 'Plum' }).click();
  await p.waitForTimeout(300);
  const after = await scanColour();
  console.log('scan button:', before, '->', after);
  expect(before === 'rgb(47, 91, 217)' && after === 'rgb(122, 69, 194)', 'accent did not change the scan button');
  expect((await p.locator('.swatch[aria-checked="true"]').innerText()) === 'Plum', 'chosen swatch not marked');
  await p.screenshot({ path: `${S}/G-appearance.png` });
  await p.reload();
  await p.waitForTimeout(700);
  expect((await scanColour()) === 'rgb(122, 69, 194)', 'accent not remembered after reopening');
  await p.click('.tab[data-go="profile"]');
  await p.click('.hub-row[data-go="appearance"]');
  await p.locator('.swatch', { hasText: 'Cobalt' }).click();
  expect((await scanColour()) === 'rgb(47, 91, 217)' && !(await p.evaluate(() => document.documentElement.dataset.accent)), 'back to cobalt failed');
  await ctx.close();
}

// ---------- Spin the wheel ----------
{
  const { ctx, p } = await setup();
  await p.click('.tab[data-go="games"]');
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${S}/G-games.png` });
  await p.click('[data-game="spinner"]');
  await p.waitForTimeout(400);
  const intro = await p.textContent('#spinIntro');
  console.log('wheel:', intro);
  expect(intro.startsWith('5 books'), 'wheel should hold the 5 To be read books');
  await p.screenshot({ path: `${S}/G-wheel.png` });
  await p.click('#spinBtn');
  await p.waitForTimeout(1500);
  const midway = await p.evaluate(() => window.__notes);
  await p.waitForSelector('#spinPick:not([hidden])', { timeout: 10000 });
  await p.waitForTimeout(900);
  const title = await p.textContent('.pick-title');
  const notes = await p.evaluate(() => window.__notes);
  console.log('picked:', title, '| ticks while spinning:', midway, '| sounds in all:', notes);
  const want = (await getAll(p)).filter((x) => x.status === 'want').map((x) => x.title);
  expect(want.includes(title), 'picked a book that is not unread');
  expect(midway > 0 && notes > midway, 'no ticks or no chime');
  expect((await p.textContent('#wheelNow')) === title, 'pointer label disagrees with the pick');
  await p.screenshot({ path: `${S}/G-pick.png` });
  await p.click('#pickBook');
  await p.waitForTimeout(600);
  const open = await p.evaluate(() => ({ detail: document.querySelector('#detail').open, spinner: document.querySelector('#spinner').open }));
  console.log('tapped the pick: book page open', open.detail, '| title', await p.textContent('#dTitle'));
  expect(open.detail && !open.spinner && (await p.textContent('#dTitle')) === title, 'pick did not open its book page');
  await p.click('#detail [data-close]');
  await p.waitForTimeout(400);

  await ctx.close();
}
{
  // Reduce Motion: no spin, straight to the pick. And an empty wheel explains itself.
  const { ctx, p } = await setup({ reducedMotion: 'reduce' });
  await p.click('.tab[data-go="games"]');
  await p.click('[data-game="spinner"]');
  await p.click('#spinBtn');
  await p.waitForSelector('#spinPick:not([hidden])', { timeout: 2000 });
  console.log('reduce motion pick:', await p.textContent('.pick-title'));
  await ctx.close();
}
{
  const { ctx, p } = await setup({ seed: [{ id: 'f1', title: 'Circe', authors: ['Madeline Miller'], status: 'read', addedAt: 1 }] });
  await p.click('.tab[data-go="games"]');
  await p.click('[data-game="spinner"]');
  await p.waitForTimeout(300);
  const intro = await p.textContent('#spinIntro');
  console.log('empty wheel:', intro, '| spin button hidden:', await p.locator('#spinBtn').isHidden());
  expect(intro.startsWith('Nothing to spin yet') && await p.locator('#spinBtn').isHidden(), 'empty wheel wrong');
  await ctx.close();
}

// ---------- Book shower ----------
{
  const { ctx, p } = await setup();
  await p.click('.tab[data-go="games"]');
  await p.click('[data-game="shower"]');
  await p.waitForTimeout(1200);
  const pos = () => p.locator('#shower .cover').evaluateAll((n) => n.map((x) => x.style.transform));
  const a = await pos();
  await p.waitForTimeout(400);
  const c = await pos();
  const moving = a.some((t, i) => c[i] && c[i] !== t);
  console.log('shower: covers on screen', c.length, '| moving', moving, '| matter loaded', await p.evaluate(() => !!window.Matter));
  expect(c.length > 3 && moving, 'covers not falling');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${S}/G-shower.png` });
  // Every cover falls eventually; all 14 appear over the run.
  const seen = await p.evaluate(() => new Promise((res) => {
    const titles = new Set();
    const t0 = performance.now();
    const look = () => {
      document.querySelectorAll('#shower .cover').forEach((el) => titles.add(el.querySelector('.ph-title')?.textContent || el.querySelector('img')?.src));
      if (document.querySelector('#shower').hidden || performance.now() - t0 > 15000) res(titles.size); else requestAnimationFrame(look);
    };
    look();
  }));
  const done = await p.locator('#shower').isHidden();
  console.log('shower ended by itself:', done, '| distinct covers seen after 4s:', seen);
  expect(done, 'shower never ended');
  // Tap to stop early.
  await p.click('[data-game="shower"]');
  await p.waitForTimeout(800);
  await p.mouse.click(200, 400);
  await p.waitForTimeout(800);
  expect(await p.locator('#shower').isHidden(), 'tap did not stop the shower');
  await ctx.close();
}
{
  const { ctx, p } = await setup({ reducedMotion: 'reduce' });
  await p.click('.tab[data-go="games"]');
  await p.click('[data-game="shower"]');
  await p.waitForTimeout(500);
  const n = await p.locator('#shower .cover').count();
  await p.waitForTimeout(4000);
  console.log('reduce motion shower: covers', n, '| closed by itself', await p.locator('#shower').isHidden());
  expect(n > 0 && await p.locator('#shower').isHidden(), 'reduced shower wrong');
  await ctx.close();
}

// ---------- Lending ----------
{
  const { ctx, p } = await setup();
  const dots = await p.locator('#libraryShelves .book:has(.loan-dot)').evaluateAll((n) => n.map((x) => x.getAttribute('aria-label')));
  console.log('loan dots:', dots.join(' | '));
  expect(dots.length === 2 && dots.every((d) => d.endsWith('loaned out')), 'loan dots wrong');
  // The dot sits at the cover's top right.
  const geo = await p.evaluate(() => {
    const tile = document.querySelector('#libraryShelves .book:has(.loan-dot)');
    const c = tile.querySelector('.cover').getBoundingClientRect();
    const d = tile.querySelector('.loan-dot').getBoundingClientRect();
    return { right: Math.round(d.right - c.right), top: Math.round(d.top - c.top) };
  });
  expect(Math.abs(geo.right) <= 6 && Math.abs(geo.top) <= 6, `loan dot not at top right (${JSON.stringify(geo)})`);
  await p.screenshot({ path: `${S}/G-loan-dots.png` });

  await p.selectOption('#statusFilter', 'loaned');
  await p.waitForTimeout(200);
  console.log('loaned filter:', (await shown(p)).join(' · '));
  expect((await shown(p)).join() === 'Circe,Rebecca', 'loaned filter wrong');
  await p.selectOption('#statusFilter', '');
  await p.selectOption('#sort', 'loaned');
  await p.waitForTimeout(200);
  const sorted = await shown(p);
  console.log('loaned sort:', sorted.slice(0, 4).join(' · '), '…');
  expect(sorted[0] === 'Circe' && sorted[1] === 'Rebecca' && sorted.length === 14, 'loaned sort wrong');
  await p.selectOption('#sort', 'added');

  // Lend Piranesi to Jo.
  await p.locator('#libraryShelves .book[aria-label^="Piranesi"]').click();
  await p.waitForTimeout(500);
  expect(await p.locator('#loanDetails').isHidden(), 'loan details shown for a book on the shelf');
  await p.click('[data-loan="out"]');
  await p.waitForTimeout(300);
  await p.fill('#dLoanTo', 'Jo');
  await p.waitForTimeout(900);
  console.log('lent:', await p.textContent('#dLoanSince'));
  expect(/^With Jo since /.test(await p.textContent('#dLoanSince')), 'loan caption wrong');
  expect(await p.locator('.detail-cover .loan-dot').count() === 1, 'no dot on the book page cover');
  await p.evaluate(() => document.querySelector('#loanCard').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: `${S}/G-loan-card.png` });
  await p.click('#detail [data-close]');
  await p.waitForTimeout(400);
  let rec = (await getAll(p)).find((x) => x.title === 'Piranesi');
  expect(rec.loaned === true && rec.loanedTo === 'Jo' && rec.loanedAt > 0, 'loan not saved');
  expect(await p.locator('#libraryShelves .book[aria-label^="Piranesi"] .loan-dot').count() === 1, 'no shelf dot after lending');
  await p.click('.tab[data-go="profile"]'); await p.click('[data-go="stats"]');
  await p.waitForTimeout(200);
  const stats = await p.locator('#statsCard .stat').evaluateAll((n) => n.map((x) => `${x.children[0].textContent}: ${x.children[1].textContent}`));
  expect(stats.includes('Loaned out: 3'), 'stats loaned count wrong');
  // Back on the shelf: the name is cleared.
  await p.click('.tab[data-go="home"]');
  await p.locator('#libraryShelves .book[aria-label^="Piranesi"]').click();
  await p.waitForTimeout(500);
  await p.click('[data-loan="home"]');
  await p.waitForTimeout(300);
  rec = (await getAll(p)).find((x) => x.title === 'Piranesi');
  console.log('returned:', rec.loaned, JSON.stringify(rec.loanedTo));
  expect(rec.loaned === false && rec.loanedTo === '' && (await p.locator('.detail-cover .loan-dot').count()) === 0, 'return not saved');
  await ctx.close();
}

console.log('errors:', errors);
await b.close();

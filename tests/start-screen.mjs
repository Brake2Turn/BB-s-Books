import { chromium } from './pw.mjs';
import { coverSvg } from './mockcovers.mjs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch();
const errors = [];
for (const [label, hour] of [['morning', 8], ['afternoon', 14], ['evening', 21], ['late', 2]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.route(/covers\.openlibrary\.org\/b\/isbn\/(\d+)/, (r) => r.fulfill({ body: coverSvg(r.request().url().match(/isbn\/(\d+)/)[1]), contentType: 'image/svg+xml' }));
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(2026, 9, 18, hour, 15));
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:8123/?demo');
  await p.waitForTimeout(label === 'morning' ? 2900 : 400);
  console.log(`${label} (${hour}:15):`, await p.textContent('.splash-greeting'), await p.textContent('.splash-name'));
  if (label === 'morning') {
    await p.screenshot({ path: `${S}/S0.png` });
    await p.clock.install({ time: new Date(2026, 9, 18, hour, 15) }).catch(() => {});
    await p.mouse.click(250, 560);
    for (const [i, t] of [[1, 120], [2, 330], [3, 600]].entries()) { await p.waitForTimeout(t[1] - (i ? [120, 330, 600][i - 1] : 0)); await p.screenshot({ path: `${S}/S${t[0]}.png` }); }
    await p.waitForSelector('#splash', { state: 'detached', timeout: 3000 });
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${S}/S4.png` });
    console.log('after tap: splash gone, library shows', await p.textContent('[data-count]'), 'books');
  }
  await ctx.close();
}
// keyboard: Enter opens it too
const ctx = await b.newContext({ serviceWorkers: 'block' });
const p = await ctx.newPage();
await p.goto('http://localhost:8123/');
await p.waitForTimeout(300);
await p.keyboard.press('Enter');
await p.waitForSelector('#splash', { state: 'detached', timeout: 3000 });
console.log('Enter key opens the library: yes');
console.log('errors:', errors);
await b.close();

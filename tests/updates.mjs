// An app update must arrive whole. The server here lets browsers keep files for an hour (as
// hosts like GitHub Pages do for minutes), then a new version of a file appears. After the
// update the page must use the new file, never an older copy the browser kept: a mix of old
// and new files is what left icons missing on the preview.
import { chromium } from './pw.mjs';
import { spawn } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const root = '/home/user/BB-s-Books';
const copy = mkdtempSync(join(tmpdir(), 'bbs-update-'));
for (const f of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'js', 'fonts', 'icons', 'vendor']) cpSync(join(root, f), join(copy, f), { recursive: true });
const srv = spawn(process.execPath, [process.env.HTTP_SERVER_BIN || '/opt/node-tools/node_modules/http-server/bin/http-server', '-p', '8125', '-c3600', '-s', '.'], { cwd: copy });
await new Promise((r) => setTimeout(r, 1500));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
// No request interception here: in Playwright it switches the browser's cache off, which would hide the problem.
await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto('http://localhost:8125/?demo');
await p.evaluate(() => navigator.serviceWorker.ready);
await p.reload();
await p.waitForTimeout(800);
const iconOf = () => p.evaluate(() => document.querySelector('.tab[data-go="games"] svg').innerHTML);
const before = await iconOf();

// Publish an update: a changed icon file and a new service worker version.
const marker = '<circle cx="12" cy="12" r="2" data-update="yes"/>';
const icons = readFileSync(join(copy, 'js/icons.js'), 'utf8');
writeFileSync(join(copy, 'js/icons.js'), icons.replace(/games: '([^']*)'/, (m, d) => `games: '${d}${marker}'`));
const sw = readFileSync(join(copy, 'sw.js'), 'utf8');
writeFileSync(join(copy, 'sw.js'), sw.replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-next'"));

// Opening the app twice is how a phone picks up an update (the new worker installs, then serves).
// A plain open, not a reload: a reload makes the browser re-check every file, which hides the problem.
// Each open is a fresh tab, as when she opens the app from her home screen.
let page = p;
for (let i = 0; i < 2; i++) {
  await page.close();
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8125/?demo');
  await page.waitForTimeout(1200);
}
const after = await page.evaluate(() => document.querySelector('.tab[data-go="games"] svg').innerHTML);
const shell = await page.evaluate(async () => {
  const keys = await caches.keys();
  const name = keys.find((k) => k.startsWith('bbs-shell-') && k.endsWith('-next'));
  if (!name) return 'no new shell cache';
  const res = await (await caches.open(name)).match('js/icons.js');
  return res ? (await res.text()).includes('data-update') : 'icons.js not cached';
});
console.log('games icon updated on screen:', after.includes('data-update'), '| was already new before:', before.includes('data-update'), '| new offline copy is the new file:', shell);
if (!after.includes('data-update')) errors.push('page kept an old copy of icons.js after the update');
if (shell !== true) errors.push(`the new version's offline copy is stale (${shell})`);
console.log('errors:', errors);
await b.close();
srv.kill('SIGKILL');
rmSync(copy, { recursive: true, force: true });

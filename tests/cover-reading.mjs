import { chromium } from './pw.mjs';
import { readFileSync } from 'fs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch();
const ctx = await b.newContext({ serviceWorkers: 'block' });
await ctx.route('**/test-covers/*', (r) => r.fulfill({ body: readFileSync(`${S}/covers/${r.request().url().split('/').pop()}`), contentType: 'image/jpeg' }));
// Decoy-heavy search results: the right book is never first.
const truth = {
  'secret-history': ['The Secret History', 'Donna Tartt'],
  circe: ['Circe', 'Madeline Miller'],
  'normal-people': ['Normal People', 'Sally Rooney'],
  piranesi: ['Piranesi', 'Susanna Clarke'],
  klara: ['Klara and the Sun', 'Kazuo Ishiguro'],
};
const decoys = [['The Secret Garden', 'Frances Hodgson Burnett'], ['A History of Secrets', 'Jane Doe'], ['Circe\'s Island', 'Ann Brown'], ['The Song of Achilles', 'Madeline Miller'],
  ['People Like Us', 'Dana Mele'], ['Normal Accidents', 'Charles Perrow'], ['Piranesi: Etchings of Rome', 'Luigi Ficacci'], ['Jonathan Strange & Mr Norrell', 'Susanna Clarke'],
  ['Never Let Me Go', 'Kazuo Ishiguro'], ['The Sun Also Rises', 'Ernest Hemingway'], ['Klara', 'Hans Muller'], ['Sunday Times Bestsellers 2020', 'Various']];
await ctx.route('https://www.googleapis.com/**', (r) => {
  const items = [...decoys.slice(0, 6), ...Object.values(truth), ...decoys.slice(6)].map(([t, a]) => ({ volumeInfo: { title: t, authors: [a] } }));
  r.fulfill({ json: { items } });
});
await ctx.route('https://openlibrary.org/**', (r) => r.fulfill({ json: { docs: [] } }));
const p = await ctx.newPage();
await p.goto('http://localhost:8123/');
await p.waitForFunction(() => window.Tesseract);
const results = await p.evaluate(async (names) => {
  const nu = await import('/js/scanner.js');
  const lookup = await import('/js/lookup.js');
  const out = [];
  for (const n of names) {
    const img = new Image(); img.src = `/test-covers/${n}.jpg`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
    const t1 = performance.now();
    const reading = await nu.readCoverText(c);
    const t2 = performance.now();
    const ranked = await lookup.searchCover(reading);
    out.push({ n, newQ: reading.query, title: reading.title, top: ranked[0] && ranked[0].title, top3: ranked.slice(0, 3).map((x) => x.title), newMs: Math.round(t2 - t1) });
  }
  return out;
}, Object.keys(truth));
const wrong = results.filter((r) => r.top !== truth[r.n][0]).map((r) => r.n);
for (const r of results) {
  console.log(`\n${r.n}\n  reader: "${r.newQ}" [title guess: "${r.title}"] (${r.newMs}ms)\n  top match: ${r.top} ${r.top === truth[r.n][0] ? 'CORRECT' : 'WRONG'}   | top 3: ${r.top3.join(' / ')}`);
}
console.log('errors:', wrong.length ? wrong.map((n) => `wrong match for ${n}`) : []);
await b.close();

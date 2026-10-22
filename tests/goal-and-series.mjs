// Reading goal (questions one at a time, one goal, the card on Home, counting finished books),
// Series (grouping, overlapped covers, the gold / orange / light blue lines, editing, lookups),
// and the Social tab.
import { chromium } from './pw.mjs';
import { coverSvg } from './mockcovers.mjs';
const S = process.argv[2] || new URL('./.fixtures', import.meta.url).pathname; // test images and screenshots
const b = await chromium.launch();
const errors = [];
const expect = (ok, what) => { if (!ok) errors.push(what); };

async function setup({ seed, routes } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.route('https://**', (r) => r.fulfill({ status: 404, body: '' }));
  await ctx.route('https://covers.openlibrary.org/**', (r) => r.fulfill({ body: coverSvg(r.request().url().slice(-22, -6)), contentType: 'image/svg+xml' }));
  if (routes) await routes(ctx);
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('splash')?.remove()));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', (d) => d.accept());
  if (seed) {
    await p.goto('http://localhost:8123/');
    await p.waitForTimeout(400);
    await p.evaluate(async (list) => { const db = await import('/js/db.js'); for (const x of list) await db.put(x); }, seed);
    await p.reload();
  } else {
    await p.goto('http://localhost:8123/?demo');
  }
  await p.waitForTimeout(900);
  return { ctx, p };
}
const getAll = (p) => p.evaluate(async () => (await import('/js/db.js')).getAll());
const meta = (p, k) => p.evaluate(async (key) => (await import('/js/db.js')).getMeta(key, null), k);
const openBook = async (p, title) => { await p.click('.tab[data-go="home"]'); await p.locator(`#libraryShelves .book[aria-label^="${title}"]`).click(); await p.waitForTimeout(450); };

// ---------- Social ----------
{
  const { ctx, p } = await setup();
  await p.click('.tab[data-go="social"]');
  await p.waitForTimeout(200);
  const text = await p.locator('[data-screen="social"] .glass-card').innerText();
  console.log('social:', text.replace(/\n/g, ' / '));
  expect(/coming soon/i.test(text), 'social screen missing "Coming soon"');
  await p.screenshot({ path: `${S}/S-social.png` });
  await ctx.close();
}

// ---------- Reading goal ----------
{
  const { ctx, p } = await setup();
  expect(await p.locator('#goalCard').isHidden(), 'goal card shown with no goal');
  await p.click('.tab[data-go="games"]');
  await p.click('[data-game="goal"]');
  await p.waitForTimeout(400);
  const q1 = await p.textContent('.goal-question');
  console.log('question 1:', q1, '| next disabled before choosing:', await p.locator('#goalNext').isDisabled());
  expect(await p.locator('#goalNext').isDisabled(), 'Next works before a time frame is chosen');
  await p.locator('.goal-choice', { hasText: 'This month' }).click();
  await p.click('#goalNext');
  await p.waitForTimeout(400);
  console.log('question 2:', await p.textContent('.goal-question'), '| suggested:', await p.textContent('.goal-number'));
  await p.locator('.goal-step[aria-label="One more"]').click();
  await p.locator('.goal-step[aria-label="One more"]').click();
  const target = Number(await p.textContent('.goal-number'));
  await p.click('#goalNext');
  await p.waitForTimeout(400);
  console.log('question 3:', await p.textContent('.goal-question'));
  expect(await p.locator('#goalNext').isDisabled(), 'Next works before the audiobook question is answered');
  await p.locator('.goal-choice', { hasText: 'Only books I read' }).click();
  await p.click('#goalNext');
  await p.waitForTimeout(400);
  const summary = await p.textContent('.goal-summary');
  console.log('summary:', summary);
  await p.screenshot({ path: `${S}/S-goal-summary.png` });
  await p.click('#goalNext'); // Set goal
  await p.waitForTimeout(500);
  const g = await meta(p, 'goal');
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  expect(g && g.target === target && g.audio === false && new Date(g.end).getDate() === monthEnd.getDate(), `goal saved wrong ${JSON.stringify(g)}`);
  expect(summary === `${target} books by ${monthEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`, 'summary wording');

  await p.click('.tab[data-go="home"]');
  await p.waitForTimeout(300);
  const card = async () => `${await p.textContent('#goalCard .goal-count')} | ${await p.textContent('#goalCard .goal-caption')}`;
  console.log('home card:', await card());
  expect((await p.textContent('#goalCard .goal-count')) === `0 of ${target}`, 'goal card count');
  // Both cards fit above the shelves without crowding them: the first shelf row starts on the first screen.
  const shelfTop = await p.evaluate(() => document.querySelector('#libraryShelves').getBoundingClientRect().top);
  console.log('first shelf starts at', Math.round(shelfTop), 'px');
  expect(shelfTop < 520, 'reading and goal cards take too much room');
  await p.screenshot({ path: `${S}/S-home-goal.png` });

  // Finishing a book counts; an audiobook doesn't (this goal leaves them out); un-finishing takes it off.
  await openBook(p, 'Klara and the Sun');
  await p.click('.status [data-status="read"]');
  await p.waitForTimeout(300);
  await p.click('#detail [data-close]');
  await p.waitForTimeout(300);
  console.log('after finishing Klara:', await card());
  expect((await p.textContent('#goalCard .goal-count')) === `1 of ${target}`, 'finished book not counted');
  const klara = (await getAll(p)).find((x) => x.title === 'Klara and the Sun');
  expect(klara.finishedAt > Date.now() - 60000, 'finishedAt not set');
  await openBook(p, 'The Night Circus');
  await p.click('.status [data-status="read"]');
  await p.click('.format [data-format="audio"]');
  await p.waitForTimeout(300);
  await p.click('#detail [data-close]');
  await p.waitForTimeout(300);
  expect((await p.textContent('#goalCard .goal-count')) === `1 of ${target}`, 'audiobook counted when the goal leaves them out');
  await openBook(p, 'Klara and the Sun');
  await p.click('.status [data-status="reading"]');
  await p.waitForTimeout(300);
  await p.click('#detail [data-close]');
  await p.waitForTimeout(300);
  expect((await p.textContent('#goalCard .goal-count')) === `0 of ${target}`, 'leaving Finished still counted');
  expect((await getAll(p)).find((x) => x.title === 'Klara and the Sun').finishedAt === 0, 'finishedAt not cleared');

  // Pace: half way through the time with nothing finished is "a little behind".
  await p.evaluate(async () => {
    const db = await import('/js/db.js');
    const now = Date.now();
    await db.setMeta('goal', { start: now - 10 * 86400000, end: now + 10 * 86400000 - 1000, target: 10, audio: true, setAt: now });
  });
  await p.reload();
  await p.waitForTimeout(800);
  console.log('pace check:', await card());
  expect((await p.textContent('#goalCard .goal-caption')) === 'A little behind · 10 days left', 'pace caption');

  // One goal at a time: tapping the card shows it, with Set a new goal and Remove goal.
  await p.click('#goalCard');
  await p.waitForTimeout(400);
  console.log('overview:', await p.textContent('.goal-summary'), '| button:', await p.textContent('#goalNext'));
  expect((await p.textContent('#goalNext')).trim() === 'Set a new goal', 'overview button');
  await p.click('#goalNext');
  await p.locator('.goal-choice', { hasText: 'This year' }).click();
  await p.click('#goalNext'); await p.click('#goalNext');
  await p.locator('.goal-choice', { hasText: 'Yes, count them' }).click();
  await p.click('#goalNext');
  expect(await p.locator('.goal-body', { hasText: 'This replaces your current goal.' }).count() === 1, 'no replace note');
  await p.click('#goalNext');
  await p.waitForTimeout(400);
  const g2 = await meta(p, 'goal');
  expect(g2.audio === true && new Date(g2.end).getMonth() === 11, 'replacing the goal failed');
  await p.click('#goalCard');
  await p.waitForTimeout(300);
  await p.click('.goal-remove');
  await p.waitForTimeout(400);
  expect((await meta(p, 'goal')) === null && await p.locator('#goalCard').isHidden(), 'remove goal failed');
  console.log('goal removed, card hidden:', await p.locator('#goalCard').isHidden());
  await ctx.close();
}

// ---------- Series ----------
{
  const { ctx, p } = await setup();
  await p.click('.tab[data-go="games"]');
  await p.click('[data-game="series"]');
  await p.waitForTimeout(500);
  const read = () => p.locator('.series-card').evaluateAll((n) => n.map((c) => ({ name: c.querySelector('.series-name').textContent, state: c.dataset.state, status: c.querySelector('.series-status').textContent, border: getComputedStyle(c).borderTopColor, books: c.querySelectorAll('.series-book').length })));
  let cards = await read();
  console.log('series:', cards.map((c) => `${c.name} [${c.state}] ${c.status} (${c.books}) ${c.border}`).join(' | '));
  const lotr = cards.find((c) => c.name === 'The Lord of the Rings');
  const hg = cards.find((c) => c.name === 'The Hunger Games');
  expect(lotr && lotr.state === 'complete' && lotr.border === 'rgb(201, 151, 28)' && lotr.books === 3, 'complete series should be gold');
  expect(hg && hg.state === 'incomplete' && hg.border === 'rgb(224, 127, 34)' && hg.status === '3 of 5 · Missing some', 'incomplete series should be orange');
  // Covers overlap a fair bit, in reading order.
  const geo = await p.locator('.series-card[data-series="the lord of the rings"] .series-book').evaluateAll((n) => n.map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), x.getAttribute('aria-label')]; }));
  const overlap = geo[0][1] - geo[1][0];
  console.log('overlap between covers:', overlap, 'px | order:', geo.map((g) => g[2]).join(' → '));
  expect(overlap >= 30 && geo[0][2].startsWith('Book 1') && geo[2][2].startsWith('Book 3'), 'covers not overlapped in order');
  await p.screenshot({ path: `${S}/S-series.png` });

  // A new book coming: light blue, saved on every book in the series.
  await p.locator('.series-card[data-series="the hunger games"] .series-edit-btn').click();
  await p.locator('.series-card[data-series="the hunger games"] .series-details .chip').click();
  await p.waitForTimeout(400);
  cards = await read();
  const hg2 = cards.find((c) => c.name === 'The Hunger Games');
  console.log('with a new book coming:', hg2.state, hg2.status, hg2.border);
  expect(hg2.state === 'upcoming' && hg2.border === 'rgb(90, 174, 230)', 'upcoming series should be light blue');
  expect((await getAll(p)).filter((x) => x.series === 'The Hunger Games').every((x) => x.seriesNext === true), 'seriesNext not on every book');
  await p.screenshot({ path: `${S}/S-series-upcoming.png` });
  // Change the count to three and take the flag off: now complete.
  await p.locator('.series-card[data-series="the hunger games"] .series-details input').fill('3');
  await p.locator('.series-card[data-series="the hunger games"] .series-details input').press('Enter');
  await p.locator('.series-card[data-series="the hunger games"] .series-details input').blur();
  await p.waitForTimeout(300);
  await p.locator('.series-card[data-series="the hunger games"] .series-details .chip').click();
  await p.waitForTimeout(400);
  expect((await read()).find((c) => c.name === 'The Hunger Games').state === 'complete', 'series with all books should be complete');

  // Tapping a cover opens that book.
  await p.locator('.series-card[data-series="the lord of the rings"] .series-book').nth(1).click({ position: { x: 12, y: 40 } }); // the strip of it that shows
  await p.waitForTimeout(500);
  console.log('tapped a cover:', await p.textContent('#dTitle'));
  expect((await p.textContent('#dTitle')) === 'The Two Towers', 'cover tap did not open the book');

  // Adding a book to a new series on its page.
  await p.click('#detail [data-close]');
  await p.waitForTimeout(300);
  await openBook(p, 'Piranesi');
  await p.fill('#dSeries', 'House of Many Rooms');
  await p.fill('#dSeriesNo', '1');
  await p.locator('#dSeriesNo').blur();
  await p.click('#detail [data-close]');
  await p.waitForTimeout(400);
  const pir = (await getAll(p)).find((x) => x.title === 'Piranesi');
  expect(pir.series === 'House of Many Rooms' && pir.seriesNo === 1, 'series fields not saved');
  await p.click('.tab[data-go="games"]');
  await p.click('[data-game="series"]');
  await p.waitForTimeout(400);
  const house = (await read()).find((c) => c.name === 'House of Many Rooms');
  console.log('new series:', house && `${house.state} ${house.status}`);
  expect(house && house.state === 'incomplete' && house.status === '1 book · How many are there?', 'new series wrong');
  // Joining an existing series picks up its details.
  await p.click('#seriesDlg [data-close]');
  await openBook(p, 'Circe');
  expect(await p.locator('#seriesNames option[value="The Lord of the Rings"]').count() === 1, 'series names not suggested');
  await ctx.close();
}

// ---------- Series from the book databases ----------
{
  const { ctx, p } = await setup();
  const parsed = await p.evaluate(async () => {
    const { parseSeries, seriesFromTitle } = await import('/js/lookup.js');
    return [parseSeries('Harry Potter ; 2'), parseSeries('Discworld #8'), parseSeries('The Expanse, book 3'), parseSeries('Wayward Children'), seriesFromTitle('In an Absent Dream (Wayward Children, #4)'), seriesFromTitle('Circe')];
  });
  console.log('parsed:', JSON.stringify(parsed));
  expect(JSON.stringify(parsed) === JSON.stringify([{ name: 'Harry Potter', no: 2 }, { name: 'Discworld', no: 8 }, { name: 'The Expanse', no: 3 }, { name: 'Wayward Children', no: null }, { name: 'Wayward Children', no: 4 }, null]), 'series parsing wrong');
  await ctx.close();
}
{
  // A book saved before series existed is looked up once, in the background.
  const { ctx, p } = await setup({
    seed: [{ id: 'o1', title: 'Guards! Guards!', authors: ['Terry Pratchett'], isbn: '9780552166669', genre: 'Fantasy', status: 'read', addedAt: 1, updatedAt: 1 }],
    routes: (c) => c.route('https://openlibrary.org/isbn/9780552166669.json', (r) => r.fulfill({ json: { series: ['Discworld ; 8'], works: [] } })),
  });
  await p.waitForTimeout(1500);
  const o1 = (await getAll(p)).find((x) => x.id === 'o1');
  console.log('looked up:', o1.series, o1.seriesNo);
  expect(o1.series === 'Discworld' && o1.seriesNo === 8, 'series backfill failed');
  await ctx.close();
}

console.log('errors:', errors);
await b.close();

// Series: every series on her shelves, each book's cover overlapping the next, and a coloured
// line around each series: gold when she has them all, orange when some are missing, light blue
// when a new book is on the way.
//
// On each book: series (name), seriesNo (its number), and, copied onto every book of the series
// so backups carry them, seriesTotal (books out so far) and seriesNext (a new one is coming).
import { coverEl } from './covers.js';

const $ = (sel) => document.querySelector(sel);
const fmt = (n) => n.toLocaleString('en-GB');
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const key = (name) => (name || '').trim().toLowerCase();

let hooks; // { books: () => [...], save(book), openDetail(id) }
const els = { dlg: $('#seriesDlg'), list: $('#seriesList'), intro: $('#seriesIntro') };
let editing = ''; // the series whose details are open

/** Group her books into series, in reading order. */
export function groups(books) {
  const map = new Map();
  for (const b of books) {
    if (!b.series || !b.series.trim()) continue;
    const k = key(b.series);
    if (!map.has(k)) map.set(k, { key: k, name: b.series.trim(), books: [] });
    map.get(k).books.push(b);
  }
  return [...map.values()].map((g) => {
    g.books.sort((a, b) => (a.seriesNo ?? 1e9) - (b.seriesNo ?? 1e9) || (a.published || '').localeCompare(b.published || '') || a.title.localeCompare(b.title));
    // Series details are copied onto every book; the most recently changed book has the latest.
    const latest = [...g.books].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    g.name = latest.series.trim();
    g.total = Number(latest.seriesTotal) || null;
    g.next = !!latest.seriesNext;
    const numbers = new Set(g.books.map((b) => b.seriesNo).filter((n) => n != null && Number.isInteger(n)));
    const have = Math.max(numbers.size, g.books.length);
    g.have = g.books.length;
    g.complete = !!g.total && (numbers.size
      ? [...Array(g.total)].every((_, i) => numbers.has(i + 1))
      : have >= g.total);
    g.state = g.next ? 'upcoming' : g.complete ? 'complete' : 'incomplete';
    return g;
  }).sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
}

function statusLine(g) {
  const count = g.total ? `${fmt(g.have)} of ${fmt(g.total)}` : `${fmt(g.have)} ${plural(g.have, 'book')}`;
  if (g.state === 'upcoming') return `${count} · New book coming`;
  if (g.state === 'complete') return `All ${fmt(g.total)} · Complete`;
  return g.total ? `${count} · Missing some` : `${count} · How many are there?`;
}

function card(g) {
  const art = document.createElement('article');
  art.className = 'glass-card series-card';
  art.dataset.state = g.state;
  art.dataset.series = g.key;

  const head = document.createElement('div');
  head.className = 'series-head';
  const name = document.createElement('h3');
  name.className = 'series-name';
  name.textContent = g.name;
  const status = document.createElement('p');
  status.className = 'caption series-status';
  status.textContent = statusLine(g);
  head.append(name, status);

  const stack = document.createElement('div');
  stack.className = 'series-stack';
  stack.style.setProperty('--n', String(g.books.length));
  g.books.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'series-book';
    btn.style.zIndex = String(i + 1);
    btn.setAttribute('aria-label', `${b.seriesNo != null ? `Book ${b.seriesNo}: ` : ''}${b.title}`);
    btn.append(coverEl(b));
    btn.addEventListener('click', () => { els.dlg.close(); hooks.openDetail(b.id); });
    stack.append(btn);
  });

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'text-btn series-edit-btn';
  edit.textContent = editing === g.key ? 'Done' : 'Edit details';
  edit.setAttribute('aria-expanded', String(editing === g.key));
  edit.addEventListener('click', () => { editing = editing === g.key ? '' : g.key; render(); });

  art.append(head, stack, edit);
  if (editing === g.key) art.append(details(g));
  return art;
}

/** How many books the series has so far, and whether a new one is coming. */
function details(g) {
  const box = document.createElement('div');
  box.className = 'series-details';
  const label = document.createElement('label');
  label.className = 'series-total';
  label.textContent = 'Books out so far';
  const total = document.createElement('input');
  total.type = 'number';
  total.inputMode = 'numeric';
  total.min = '1';
  total.className = 'glass-input';
  total.value = g.total || '';
  total.placeholder = String(Math.max(g.have, ...g.books.map((b) => b.seriesNo || 0)));
  label.append(total);
  const chips = document.createElement('div');
  chips.className = 'chips tint-chips';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'chip';
  next.setAttribute('aria-pressed', String(g.next));
  next.textContent = 'A new book is coming';
  chips.append(next);
  const save = async (patch) => {
    for (const b of g.books) await hooks.save({ ...hooks.books().find((x) => x.id === b.id), ...patch });
    render();
  };
  total.addEventListener('change', () => {
    const n = Math.round(Number(total.value));
    save({ seriesTotal: n >= 1 ? n : null });
  });
  next.addEventListener('click', () => save({ seriesNext: !g.next }));
  box.append(label, chips);
  return box;
}

function render() {
  const list = groups(hooks.books());
  const done = list.filter((g) => g.state === 'complete').length;
  els.intro.textContent = list.length
    ? `${fmt(list.length)} ${plural(list.length, 'series', 'series')} on your shelves${done ? `, ${fmt(done)} complete` : ''}.`
    : 'No series yet. Add one on a book’s page, under Series, and it shows up here.';
  els.dlg.querySelector('.series-key').hidden = !list.length;
  const scroll = els.dlg.querySelector('.detail-scroll').scrollTop;
  els.list.replaceChildren(...list.map(card));
  els.dlg.querySelector('.detail-scroll').scrollTop = scroll;
}

export function open() {
  editing = '';
  render();
  els.dlg.showModal();
  els.dlg.querySelector('.detail-scroll').scrollTop = 0;
}

els.dlg.querySelector('[data-close]').addEventListener('click', () => els.dlg.close());

export function init(h) { hooks = h; }

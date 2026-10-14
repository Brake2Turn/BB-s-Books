import * as db from './db.js';
import * as scan from './scan-flow.js';
import { coverEl, dominantColour, toneFor, textOn } from './covers.js';
import { icon, hydrateIcons } from './icons.js';
import { sampleBooks } from './demo.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  library: $('#library'),
  empty: $('#empty'),
  noMatch: $('#noMatch'),
  count: $('#count'),
  search: $('#search'),
  sort: $('#sort'),
  filter: $('#filter'),
  viewToggle: $('.view-toggle'),
  scanBtn: $('#scanBtn'),
  detail: $('#detail'),
  dCover: $('.detail-cover'),
  dTitle: $('#dTitle'),
  dAuthor: $('#dAuthor'),
  dMeta: $('#dMeta'),
  dBlurb: $('#dBlurb'),
  status: $('.status'),
  stars: $('#stars'),
  dReview: $('#dReview'),
  saveBtn: $('#saveBtn'),
  saved: $('#saved'),
  recoverBtn: $('#recoverBtn'),
  deleteBtn: $('#deleteBtn'),
  menuBtn: $('#menuBtn'),
  menu: $('#menu'),
  importFile: $('#importFile'),
  toast: $('#toast'),
};

let books = [];
let view = 'grid';
let current = null; // book open in the detail view
let draftRating = 0;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const authorLine = (b) => (b.authors || []).join(', ');

function pref(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* private mode: preferences just aren't remembered */ }
  return null;
}

function toast(msg, ms = 2400) {
  // Dialogs sit above everything, so show the toast inside whichever one is open.
  const host = document.querySelector('dialog[open]') || document.body;
  if (els.toast.parentElement !== host) host.append(els.toast);
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => els.toast.classList.remove('show'), ms);
}

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalise(s) {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function findDuplicate(book) {
  return books.find((b) => (book.isbn && b.isbn === book.isbn)
    || (normalise(b.title) === normalise(book.title) && normalise(authorLine(b)) === normalise(authorLine(book))));
}

async function saveRecord(book) {
  await db.put(book);
  books = books.some((b) => b.id === book.id) ? books.map((b) => (b.id === book.id ? book : b)) : [...books, book];
  return book;
}

// ---------- Library ----------

function visibleBooks() {
  const q = normalise(els.search.value);
  const status = els.filter.value;
  const list = books.filter((b) => (!q || normalise(`${b.title} ${authorLine(b)}`).includes(q)) && (!status || b.status === status));
  const cmp = {
    added: (a, b) => b.addedAt - a.addedAt,
    title: (a, b) => a.title.localeCompare(b.title),
    author: (a, b) => authorLine(a).localeCompare(authorLine(b)) || a.title.localeCompare(b.title),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title),
  }[els.sort.value];
  return list.sort(cmp);
}

function hashOf(s) {
  return [...(s || '')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

function gridItem(book) {
  const btn = document.createElement('button');
  btn.className = 'book';
  btn.dataset.id = book.id;
  btn.setAttribute('aria-label', `${book.title}${book.authors?.length ? `, ${authorLine(book)}` : ''}${book.rating ? `, rated ${book.rating} of 5` : ''}`);
  btn.append(coverEl(book));
  const rating = document.createElement('span');
  rating.className = 'rating';
  rating.innerHTML = icon('star').repeat(book.rating || 0);
  btn.append(rating);
  btn.addEventListener('click', () => openDetail(book.id, btn.querySelector('.cover')));
  return btn;
}

function shelfItem(book) {
  const slot = document.createElement('div');
  slot.className = 'spine-slot';
  slot.dataset.id = book.id;
  const spine = document.createElement('button');
  spine.className = 'spine';
  spine.setAttribute('aria-label', `${book.title}${book.authors?.length ? `, ${authorLine(book)}` : ''}`);
  const thickness = book.pages ? Math.round(Math.min(56, Math.max(22, 16 + book.pages / 16))) : 30;
  const height = 150 + (hashOf(book.title) % 38);
  const colour = book.spine || toneFor(book.title);
  spine.style.setProperty('--w', `${thickness}px`);
  spine.style.setProperty('--h', `${height}px`);
  spine.style.setProperty('--spine', colour);
  spine.style.setProperty('--spine-ink', textOn(colour));
  const label = document.createElement('span');
  label.textContent = book.title;
  spine.append(label);
  spine.addEventListener('click', () => openDetail(book.id, spine));
  slot.append(spine);
  if (book.cover && book.spine === undefined) learnSpineColour(book, spine);
  return slot;
}

/** Pull a spine colour from the cover once, and remember it. */
async function learnSpineColour(book, spineEl) {
  const colour = await dominantColour(book.cover);
  const latest = books.find((b) => b.id === book.id);
  if (!latest) return;
  await saveRecord({ ...latest, spine: colour || null });
  if (colour && spineEl.isConnected) {
    spineEl.style.setProperty('--spine', colour);
    spineEl.style.setProperty('--spine-ink', textOn(colour));
  }
}

function render(incomingId) {
  const list = visibleBooks();
  els.library.classList.toggle('shelf-view', view === 'shelf');
  els.library.replaceChildren(...list.map((b) => {
    const el = view === 'shelf' ? shelfItem(b) : gridItem(b);
    if (b.id === incomingId) el.style.visibility = 'hidden';
    return el;
  }));
  els.empty.hidden = books.length > 0;
  els.noMatch.hidden = !(books.length && !list.length);
  const n = books.length;
  const read = books.filter((b) => b.status === 'read').length;
  els.count.textContent = n ? `${n} book${n === 1 ? '' : 's'}${read ? `, ${read} read` : ''}` : 'An empty shelf, for now';
}

function setView(next) {
  view = next;
  pref('bbs-view', next);
  els.viewToggle.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === next)));
  render();
}

async function load() {
  books = await db.getAll();
  if (db.DEMO && !books.length) {
    await db.replaceAll(sampleBooks());
    books = await db.getAll();
  }
  render();
}

// Hooks for the scan screen.
async function saveBook(data) {
  return saveRecord({
    id: uid(),
    title: data.title || 'Untitled',
    authors: data.authors || [],
    blurb: data.blurb || '',
    cover: data.cover || '',
    coverRatio: data.coverRatio || '',
    isbn: data.isbn || '',
    publisher: data.publisher || '',
    published: data.published || '',
    pages: data.pages || null,
    status: '',
    rating: 0,
    review: '',
    addedAt: Date.now(),
  });
}

/** Render with the new book in place but hidden, scrolled into view, ready for the cover to land. */
function placeIncoming(id) {
  els.search.value = '';
  els.filter.value = '';
  render(id);
  const tile = els.library.querySelector(`[data-id="${id}"]`);
  tile.scrollIntoView({ block: 'center', behavior: 'instant' });
  return tile;
}

function landed(tile) {
  tile.style.visibility = '';
  const tick = document.createElement('span');
  tick.className = 'tick';
  tick.innerHTML = icon('check');
  tile.append(tick); // on the tile, not inside the cover, so it isn't clipped
  setTimeout(() => tick.remove(), 1900);
  const book = books.find((b) => b.id === tile.dataset.id);
  if (book && book.cover) learnSpineColour(book, tile.querySelector('.spine') || document.createElement('i'));
}

// ---------- Detail ----------

function renderStars() {
  els.stars.replaceChildren(...[1, 2, 3, 4, 5].map((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `star${n <= draftRating ? ' on' : ''}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(n === draftRating));
    b.setAttribute('aria-label', `${n} star${n === 1 ? '' : 's'}`);
    b.innerHTML = icon('star');
    b.addEventListener('click', () => {
      draftRating = draftRating === n ? 0 : n; // tap the same star again to clear
      renderStars();
      saveDetail(true);
    });
    return b;
  }));
}

function renderStatus() {
  els.status.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-checked', String(current.status === b.dataset.status)));
}

function openDetail(id, originEl) {
  current = books.find((b) => b.id === id);
  if (!current) return;
  const c = current;
  els.dCover.replaceChildren(coverEl(c));
  els.dTitle.textContent = c.title;
  els.dAuthor.textContent = authorLine(c) || 'Author unknown';
  els.dMeta.textContent = [c.publisher, c.published && c.published.slice(0, 4), c.pages && `${c.pages} pages`, c.isbn && `ISBN ${c.isbn}`].filter(Boolean).join('  ·  ');
  els.dBlurb.textContent = c.blurb || 'No blurb came with this edition.';
  els.dBlurb.classList.toggle('empty', !c.blurb);
  draftRating = c.rating || 0;
  renderStars();
  renderStatus();
  els.dReview.value = c.review || '';
  els.saved.textContent = c.reviewedAt && c.review ? `Saved ${new Date(c.reviewedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` : '';
  els.detail.showModal();
  els.detail.querySelector('.detail-scroll').scrollTop = 0;

  // Open the cover out of its place on the shelf.
  if (originEl && !reduced()) {
    const from = originEl.getBoundingClientRect();
    const to = els.dCover.getBoundingClientRect();
    if (to.width) {
      els.dCover.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`, transformOrigin: '0 0' },
        { transform: 'none', transformOrigin: '0 0' },
      ], { duration: 320, easing: 'cubic-bezier(.22,.8,.3,1)' });
    }
  }
}

async function saveDetail(quiet = false) {
  if (!current) return;
  const review = els.dReview.value.trim();
  current = await saveRecord({ ...current, rating: draftRating, review, reviewedAt: Date.now() });
  render();
  els.saved.textContent = quiet ? 'Saved' : 'Review saved';
}

els.status.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-status]');
  if (!b || !current) return;
  const status = current.status === b.dataset.status ? '' : b.dataset.status;
  current = await saveRecord({ ...current, status });
  renderStatus();
  render();
});

async function deleteCurrent() {
  if (!current) return;
  if (!confirm(`Remove “${current.title}” from your library? Your rating and review go with it.`)) return;
  await db.remove(current.id);
  books = books.filter((b) => b.id !== current.id);
  current = null;
  els.detail.close();
  render();
  toast('Removed from your library.');
}

function recoverCover() {
  if (!current) return;
  const book = current;
  els.detail.close();
  scan.open({
    onPhoto: async (dataUrl, ratio) => {
      scan.close();
      await saveRecord({ ...books.find((b) => b.id === book.id), cover: dataUrl, coverRatio: ratio, spine: undefined });
      render();
      openDetail(book.id);
      toast('Cover updated.');
    },
  });
}

// ---------- Backup ----------

function exportLibrary() {
  const blob = new Blob([JSON.stringify({ app: 'bbs-books', version: 2, books }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bbs-books-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importLibrary(file) {
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.books;
    if (!Array.isArray(list) || list.some((b) => !b.id || !b.title)) throw new Error('bad file');
    if (!confirm(`Replace your library with the ${list.length} books in this backup?`)) return;
    await db.replaceAll(list);
    await load();
    toast(`Restored ${list.length} books.`);
  } catch {
    toast('That file isn’t a BB’s Books backup.');
  }
}

// ---------- Wiring ----------

hydrateIcons();
scan.init({ findDuplicate, saveBook, placeIncoming, landed, openDetail, toast });

els.scanBtn.addEventListener('click', () => scan.open());
els.viewToggle.addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
els.search.addEventListener('input', () => render());
els.filter.addEventListener('change', () => render());
els.sort.addEventListener('change', () => { pref('bbs-sort', els.sort.value); render(); });
els.sort.value = pref('bbs-sort') || 'added';
view = pref('bbs-view') === 'shelf' ? 'shelf' : 'grid';
els.viewToggle.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));

els.detail.querySelector('[data-close]').addEventListener('click', () => els.detail.close());
els.saveBtn.addEventListener('click', () => saveDetail(false));
els.deleteBtn.addEventListener('click', deleteCurrent);
els.recoverBtn.addEventListener('click', recoverCover);
els.dReview.addEventListener('input', () => { els.saved.textContent = 'Not saved yet'; });
els.detail.addEventListener('close', () => {
  // Never lose a half-written review because she closed the book without tapping Save.
  if (current && els.dReview.value.trim() !== (current.review || '')) saveDetail(true).then(() => toast('Review saved.'));
});

els.menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  els.menu.hidden = !els.menu.hidden;
  els.menuBtn.setAttribute('aria-expanded', String(!els.menu.hidden));
});
document.addEventListener('click', (e) => { if (!els.menu.contains(e.target)) { els.menu.hidden = true; els.menuBtn.setAttribute('aria-expanded', 'false'); } });
els.menu.querySelector('[data-action="export"]').addEventListener('click', () => { els.menu.hidden = true; exportLibrary(); });
els.importFile.addEventListener('change', () => {
  els.menu.hidden = true;
  if (els.importFile.files[0]) importLibrary(els.importFile.files[0]);
  els.importFile.value = '';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline mode unavailable', err));
}
// Ask the browser not to clear her library to free up space.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

load();

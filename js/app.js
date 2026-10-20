import * as db from './db.js';
import * as scan from './scan-flow.js';
import { coverEl } from './covers.js';
import { icon, hydrateIcons } from './icons.js';
import { sampleBooks } from './demo.js';
import { GENRES } from './genres.js';
import { genreFor } from './lookup.js';
import { coverPicker } from './cover-picker.js';
import { ripple } from './ripple.js';
import * as games from './games.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const els = {
  screens: $$('.screen'),
  tabs: $$('.tabbar .tab'),
  readingCard: $('#readingCard'),
  filterRow: $('.filter-row'),
  statusFilter: $('#statusFilter'),
  libraryShelves: $('#libraryShelves'),
  search: $('#search'),
  sort: $('#sort'),
  genreFilter: $('#genreFilter'),
  genreWrap: $('#genreWrap'),
  dGenre: $('#dGenre'),
  statsCard: $('#statsCard'),
  scanBtn: $('#scanBtn'),
  detail: $('#detail'),
  dCover: $('.detail-cover'),
  dTitle: $('#dTitle'),
  dAuthor: $('#dAuthor'),
  dMeta: $('#dMeta'),
  dBlurb: $('#dBlurb'),
  status: $('.status'),
  format: $('.format'),
  progressCard: $('#progressCard'),
  dTrack: $('#dTrack'),
  dProgress: $('#dProgress'),
  dPage: $('#dPage'),
  dPages: $('#dPages'),
  stars: $('#stars'),
  dReview: $('#dReview'),
  saveBtn: $('#saveBtn'),
  saved: $('#saved'),
  changeCoverBtn: $('#changeCoverBtn'),
  coverCard: $('#coverCard'),
  coverPickerHost: $('#coverCard .cover-picker'),
  deleteBtn: $('#deleteBtn'),
  exportBtn: $('#exportBtn'),
  importFile: $('#importFile'),
  storageNote: $('#storageNote'),
  backupNote: $('#backupNote'),
  snapshotList: $('#snapshotList'),
  feedbackForm: $('#feedbackForm'),
  fbMessage: $('#fbMessage'),
  fbName: $('#fbName'),
  fbSend: $('#fbSend'),
  fbStatus: $('#fbStatus'),
  toast: $('#toast'),
  loanCard: $('#loanCard'),
  loanDetails: $('#loanDetails'),
  dLoanTo: $('#dLoanTo'),
  dLoanSince: $('#dLoanSince'),
  accentPicker: $('#accentPicker'),
};

// Feedback is emailed by FormSubmit (formsubmit.co), which needs no server of our own.
// The first message triggers a one-time "activate" email to this address.
const FEEDBACK_TO = 'moorem0013@gmail.com';

let books = [];
let screen = 'home';
let filter = '';
let genre = ''; // '' = all genres, '-' = books with no genre yet
let current = null; // book open on the book page
let draftRating = 0;
let picker = null; // cover picker on the book page, while open

// Accent choices (Profile → Appearance). Values live in styles.css; cobalt is the guide's own.
const ACCENTS = [['cobalt', 'Cobalt', '#2F5BD9'], ['berry', 'Berry', '#B02A5E'], ['plum', 'Plum', '#7A45C2'], ['forest', 'Forest', '#2A7049'], ['teal', 'Teal', '#1B6F75']];

function applyAccent(name) {
  if (!ACCENTS.some(([n]) => n === name) || name === 'cobalt') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = name;
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const authorLine = (b) => (b.authors || []).join(', ');

/**
 * Sort key for the first author, surname first, as a bookshop files them:
 * "Daphne du Maurier" files as "du Maurier Daphne", "Austen, Jane" stays as it is.
 * Books with no author go to the end.
 */
function authorKey(b) {
  const name = (b.authors?.[0] || '').trim();
  if (!name) return '\uffff';
  if (name.includes(',')) return name;
  const words = name.split(/\s+/);
  while (words.length > 1 && /^(jr|sr|ii|iii|iv|phd)\.?$/i.test(words[words.length - 1])) words.pop();
  let i = words.length - 1;
  while (i > 1 && /^(de|du|da|del|della|der|di|la|le|van|von|st\.?)$/i.test(words[i - 1])) i--;
  return [...words.slice(i), ...words.slice(0, i)].join(' ');
}
const byName = (a, b) => a.localeCompare(b, 'en-GB', { sensitivity: 'base' });
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const fmt = (n) => n.toLocaleString('en-GB');

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
  book = { ...book, updatedAt: Date.now() }; // lets a restore keep whichever copy of a book is newer
  await db.put(book);
  books = books.some((b) => b.id === book.id) ? books.map((b) => (b.id === book.id ? book : b)) : [...books, book];
  return book;
}

/** "58% · 181 of 312 pages", in the words the style guide uses. */
function progressOf(book) {
  const pages = Number(book.pages) || 0;
  const page = Math.min(Number(book.page) || 0, pages || Infinity);
  if (book.status === 'read') return { pct: 100, text: 'Finished' };
  if (book.status === 'dnf') {
    if (!page) return { pct: 0, text: 'Note where you stopped, if you like' };
    if (!pages) return { pct: 0, text: `Stopped on page ${fmt(page)}` };
    const pct = Math.round((page / pages) * 100);
    return { pct, text: `Stopped at ${pct}% · ${fmt(page)} of ${fmt(pages)} pages` };
  }
  if (!pages) return { pct: 0, text: page ? `On page ${fmt(page)}` : 'Pick up where you left off' };
  if (!page) return { pct: 0, text: 'Not started' };
  const pct = Math.round((page / pages) * 100);
  return { pct, text: `${pct}% · ${fmt(page)} of ${fmt(pages)} pages` };
}

function setProgress(track, pct) {
  track.style.setProperty('--progress', `${pct}%`);
  track.setAttribute('aria-valuenow', String(pct));
}

// ---------- Screens ----------

// Screens reached from Profile; the Profile tab stays lit while one is open.
const PROFILE_SCREENS = ['stats', 'backup', 'appearance', 'settings'];

function showScreen(name) {
  screen = name;
  els.screens.forEach((s) => { s.hidden = s.dataset.screen !== name; });
  const tab = PROFILE_SCREENS.includes(name) ? 'profile' : name;
  els.tabs.forEach((t) => {
    if (t.dataset.go === tab) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  render();
}

// ---------- Shelves ----------

function bookTile(book) {
  const btn = document.createElement('button');
  btn.className = 'book';
  btn.dataset.id = book.id;
  btn.setAttribute('aria-label', `${book.title}${book.authors?.length ? `, ${authorLine(book)}` : ''}${book.loaned ? ', loaned out' : ''}`);
  btn.append(coverEl(book));
  if (book.loaned) btn.append(loanDot());
  btn.addEventListener('click', () => openDetail(book.id, btn.querySelector('.cover')));
  return btn;
}

/** The little dot at the top right of a loaned-out cover. */
function loanDot() {
  const dot = document.createElement('span');
  dot.className = 'loan-dot';
  dot.setAttribute('aria-hidden', 'true');
  return dot;
}

/** ShelfRow: three covers on a ledge; the ledge stays full width on a partial row. */
function shelves(list, emptyText) {
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'shelf-row shelf-empty';
    empty.innerHTML = '<p class="caption"></p><div class="ledge"></div>';
    empty.querySelector('p').textContent = emptyText;
    return [empty];
  }
  const rows = [];
  for (let i = 0; i < list.length; i += 3) {
    const row = document.createElement('div');
    row.className = 'shelf-row';
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.append(...list.slice(i, i + 3).map(bookTile));
    const ledge = document.createElement('div');
    ledge.className = 'ledge';
    row.append(grid, ledge);
    rows.push(row);
  }
  return rows;
}

const byRecent = (a, b) => b.addedAt - a.addedAt;
const matches = (filter) => (b) => !filter || (filter === 'loaned' ? !!b.loaned : b.status === filter);

function renderCounts() {
  const n = books.length;
  $$('[data-count]').forEach((el) => { el.textContent = fmt(n); });
  $$('[data-count-unit]').forEach((el) => { el.textContent = plural(n, 'book'); });
}

function renderReadingCard() {
  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => (b.readingAt || b.addedAt) - (a.readingAt || a.addedAt))[0];
  els.readingCard.hidden = !reading;
  if (!reading) return;
  els.readingCard.dataset.id = reading.id;
  els.readingCard.querySelector('.rc-cover').replaceChildren(coverEl(reading));
  els.readingCard.querySelector('.rc-title').textContent = reading.title;
  els.readingCard.querySelector('.rc-author').textContent = authorLine(reading);
  const p = progressOf(reading);
  setProgress(els.readingCard.querySelector('.track'), p.pct);
  els.readingCard.querySelector('.rc-caption').textContent = p.text;
}

/** The genre menu lists only genres on her shelves, in the standard order. */
function renderGenreFilter() {
  const present = GENRES.filter((g) => books.some((b) => b.genre === g));
  const unsorted = books.some((b) => !b.genre);
  els.genreWrap.hidden = !present.length;
  if (genre && genre !== '-' && !present.includes(genre)) genre = '';
  const options = [['', 'All genres'], ...present.map((g) => [g, g]), ...(unsorted && present.length ? [['-', 'No genre yet']] : [])];
  els.genreFilter.replaceChildren(...options.map(([value, label]) => new Option(label, value, false, value === genre)));
}

/** Home: the reading card, then every book, searchable and filterable. */
function renderHome() {
  renderReadingCard();
  // Without the reading card the chips move up onto the white zone, where glass reads grey: use tint there.
  els.filterRow.classList.toggle('glass-chips', !els.readingCard.hidden);
  els.filterRow.classList.toggle('tint-chips', els.readingCard.hidden);
  renderGenreFilter();

  const q = normalise(els.search.value);
  const cmp = {
    added: byRecent,
    title: (a, b) => a.title.localeCompare(b.title),
    author: (a, b) => byName(authorKey(a), authorKey(b)) || byName(a.title, b.title),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title),
    // Loaned-out books first, most recently lent at the top; then the rest, newest first.
    loaned: (a, b) => (!!b.loaned - !!a.loaned) || (b.loanedAt || 0) - (a.loanedAt || 0) || byRecent(a, b),
  }[els.sort.value] || byRecent;
  const list = books
    .filter(matches(filter))
    .filter((b) => !genre || (genre === '-' ? !b.genre : b.genre === genre))
    .filter((b) => !q || normalise(`${b.title} ${authorLine(b)}`).includes(q))
    .sort(cmp);
  const total = books.length;
  const empty = !total ? 'Scan a book to start this shelf' : q ? 'Nothing matches that search' : 'Nothing here yet';
  els.libraryShelves.replaceChildren(...shelves(list, empty));
  sizeSelects();
}

const measurer = document.createElement('canvas').getContext('2d');

/**
 * A <select> is as wide as its longest option; size each filter pill to the option
 * showing instead, so the row stays compact. The chosen pill is marked "active".
 */
function sizeSelects() {
  els.filterRow.querySelectorAll('select').forEach((sel) => {
    const cs = getComputedStyle(sel);
    measurer.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = sel.options[sel.selectedIndex]?.text || '';
    sel.style.width = `${Math.ceil(measurer.measureText(text).width) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2}px`;
    sel.classList.toggle('active', sel.selectedIndex > 0 && sel.id !== 'sort');
  });
}

/** Most common genre among finished books (or all books, if none are finished yet). */
function favouriteGenre() {
  const pool = books.filter((b) => b.status === 'read' && b.genre);
  const counts = {};
  (pool.length ? pool : books.filter((b) => b.genre)).forEach((b) => { counts[b.genre] = (counts[b.genre] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function renderStats() {
  const finished = books.filter((b) => b.status === 'read');
  const count = (s) => books.filter((b) => b.status === s).length;
  const pagesRead = finished.reduce((t, b) => t + (Number(b.pages) || 0), 0)
    + books.filter((b) => b.status === 'reading' || b.status === 'dnf').reduce((t, b) => t + (Number(b.page) || 0), 0);
  const rated = books.filter((b) => b.rating);
  const avg = rated.length ? (rated.reduce((t, b) => t + b.rating, 0) / rated.length).toFixed(1) : null;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  // Short labels and values, so every row fits on one line.
  const rows = [
    ['Finished', fmt(finished.length)],
    ['Reading', fmt(count('reading'))],
    ['To be read', fmt(count('want'))],
    ['Did not finish', fmt(count('dnf'))],
    ['Audiobooks', fmt(finished.filter((b) => b.format === 'audio').length)],
    ['Loaned out', fmt(books.filter((b) => b.loaned).length)],
    ['Pages read', fmt(pagesRead)],
    ['Average rating', avg ? `${avg} of 5` : 'None yet'],
    ['This month', `${fmt(books.filter((b) => b.addedAt >= monthStart).length)} added`],
    ['Top genre', favouriteGenre() || 'None yet'],
  ];
  els.statsCard.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'stat';
    const l = document.createElement('span');
    l.textContent = label;
    const v = document.createElement('b');
    v.textContent = value;
    row.append(l, v);
    return row;
  }));
}

function render() {
  renderCounts();
  if (screen === 'home') renderHome();
  if (screen === 'stats') renderStats();
  if (screen === 'backup') renderBackup();
  if (screen === 'appearance') renderAppearance();
}

async function load() {
  books = await db.getAll();
  if (db.DEMO && !books.length) {
    await db.replaceAll(sampleBooks());
    books = await db.getAll();
  }
  await protectLibrary();
  render();
  fillMissingGenres();
}

// ---------- Keeping her library safe ----------

// Bump when the shape of a book record changes. Older records are upgraded in normaliseBook,
// after a safety copy of the library is taken.
const DATA_VERSION = 4;
const KEEP_SNAPSHOTS = 5; // each copy includes any cover photos, so keep a few, not dozens

/**
 * Bring an older record up to date. Additive only: fills in fields that are missing and
 * keeps everything else exactly as it was, including fields this version doesn't know about.
 */
function normaliseBook(b) {
  return {
    authors: [],
    blurb: '',
    cover: '',
    isbn: '',
    publisher: '',
    published: '',
    pages: null,
    page: 0,
    status: '', // '' | 'want' (shown as "To be read") | 'reading' | 'read' (Finished) | 'dnf' (Did not finish)
    format: '', // how a finished book was read: '' | 'physical' | 'audio'
    loaned: false, // lent to someone
    loanedTo: '', // who has it (optional)
    loanedAt: 0, // when it was lent
    rating: 0,
    review: '',
    ...b,
    addedAt: b.addedAt || Date.now(),
  };
}

/**
 * Runs on every launch, before anything is shown:
 * 1. after an app update that changes the data's shape, save a copy first, then upgrade records;
 * 2. save one automatic copy a day; keep the newest few;
 * 3. ask the browser to protect the library from automatic clean-up.
 * A failure here must never stop the library from opening.
 */
async function protectLibrary() {
  try {
    const stored = await db.getMeta('dataVersion', 0);
    if (stored < DATA_VERSION) {
      if (books.length) await db.saveSnapshot(books, 'Before an app update', librarySignature(books));
      const upgraded = books.map(normaliseBook);
      const changed = upgraded.filter((b, i) => JSON.stringify(b) !== JSON.stringify(books[i]));
      if (changed.length) await db.putMany(changed);
      books = upgraded;
      await db.setMeta('dataVersion', DATA_VERSION);
    }
    // A daily copy, but only when something has changed since the last one.
    // The newest copy's time and fingerprint come from the settings store, so this reads
    // none of the copies (each can be large). Libraries from before that was kept look up
    // their newest copy once.
    let latest = await db.getMeta('lastSnapshot', null);
    if (!latest) {
      const [newest] = await db.snapshotKeys();
      const copy = newest ? await db.getSnapshot(newest) : null;
      latest = copy ? { at: copy.at, sig: copy.sig || librarySignature(copy.books) } : null;
    }
    const sig = librarySignature(books);
    if (books.length && (!latest || (Date.now() - latest.at > 20 * 3600 * 1000 && latest.sig !== sig))) {
      await db.saveSnapshot(books, 'Daily copy', sig);
    }
    await db.pruneSnapshots(KEEP_SNAPSHOTS);
  } catch (err) {
    console.warn('Library safety step skipped', err);
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/** A cheap fingerprint of the library: changes whenever a book is added, removed or edited. */
const librarySignature = (list) => `${list.length}:${Math.max(0, ...list.map((b) => b.updatedAt || b.addedAt || 0))}`;

const dateLabel = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  + (new Date(t).toDateString() === new Date().toDateString() ? `, ${new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '');

/** Appearance: one swatch per accent colour. The choice is kept on this device. */
function renderAppearance() {
  const chosen = pref('bbs-accent') || 'cobalt';
  els.accentPicker.replaceChildren(...ACCENTS.map(([name, label, hex]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(name === chosen));
    b.style.setProperty('--swatch', hex);
    b.innerHTML = '<i></i>';
    b.append(label);
    b.addEventListener('click', () => {
      pref('bbs-accent', name);
      applyAccent(name);
      renderAppearance();
    });
    return b;
  }));
}

async function renderBackup() {
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  els.storageNote.textContent = persisted
    ? 'Saved on this phone and protected, so the browser won’t clear it to save space.'
    : installed
      ? 'Saved on this phone. Back it up now and then to keep a copy somewhere else.'
      : 'Saved in this browser. Add the app to your home screen so it’s never cleared.';
  const last = await db.getMeta('lastBackup', 0).catch(() => 0);
  els.backupNote.textContent = last ? `Last backup: ${dateLabel(last)}` : 'Not backed up yet';

  const copies = await db.listSnapshots().catch(() => []);
  els.snapshotList.replaceChildren(...(copies.length ? copies.map((c) => {
    const row = document.createElement('div');
    row.className = 'snapshot';
    const label = document.createElement('span');
    label.textContent = `${dateLabel(c.at)} `;
    const small = document.createElement('small');
    small.textContent = `· ${fmt(c.count)} ${plural(c.count, 'book')}`;
    label.append(small);
    const btn = document.createElement('button');
    btn.className = 'text-btn';
    btn.textContent = 'Restore';
    btn.setAttribute('aria-label', `Restore the copy from ${dateLabel(c.at)}`);
    btn.addEventListener('click', () => restoreSnapshot(c));
    row.append(label, btn);
    return row;
  }) : [Object.assign(document.createElement('p'), { className: 'caption', textContent: 'The first copy is saved once you add a book.' })]));
}

async function restoreSnapshot(copy) {
  if (!confirm(`Go back to your library as it was on ${dateLabel(copy.at)} (${copy.count} ${plural(copy.count, 'book')})? Today’s library is saved as a copy first.`)) return;
  if (books.length) await db.saveSnapshot(books, 'Before a restore', librarySignature(books));
  await db.replaceAll(copy.books);
  await db.pruneSnapshots(KEEP_SNAPSHOTS + 1);
  books = await db.getAll();
  render();
  renderBackup();
  toast('Library restored');
}

/**
 * Books added before genres existed have no genre field. Look each up once, gently
 * (one at a time, with a pause), and remember the answer even when it's "none found".
 */
async function fillMissingGenres() {
  if (fillMissingGenres.running) return;
  fillMissingGenres.running = true;
  for (const b of books.filter((x) => x.genre === undefined)) {
    if (!navigator.onLine) break;
    try {
      const g = await genreFor(b);
      const latest = books.find((x) => x.id === b.id);
      if (latest && latest.genre === undefined) await saveRecord({ ...latest, genre: g });
      render();
    } catch { /* offline or rate-limited: try again next time the app opens */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  fillMissingGenres.running = false;
}

// ---------- Hooks for the scan screen ----------

async function saveBook(data) {
  return saveRecord({
    id: uid(),
    title: data.title || 'Untitled',
    authors: data.authors || [],
    blurb: data.blurb || '',
    cover: data.cover || '',
    isbn: data.isbn || '',
    publisher: data.publisher || '',
    published: data.published || '',
    pages: data.pages || null,
    genre: data.genre || '',
    page: 0,
    status: '',
    format: '',
    loaned: false,
    loanedTo: '',
    loanedAt: 0,
    rating: 0,
    review: '',
    addedAt: Date.now(),
  });
}

/** Show Home with the new book in its place but hidden, ready for the cover to land there. */
function placeIncoming(id) {
  filter = '';
  genre = '';
  els.search.value = '';
  els.statusFilter.value = '';
  if (screen !== 'home') showScreen('home');
  render();
  const tile = els.libraryShelves.querySelector(`[data-id="${id}"]`);
  tile.style.visibility = 'hidden';
  tile.scrollIntoView({ block: 'center', behavior: 'instant' });
  return tile;
}

function landed(tile) {
  tile.style.visibility = '';
  if (reduced()) return;
  // The ledge takes the weight: a small dip under the new book.
  const ledge = tile.closest('.shelf-row')?.querySelector('.ledge');
  if (ledge) ledge.animate([{ transform: 'none' }, { transform: 'translateY(2px) scaleY(.85)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
  tile.animate([{ transform: 'translateY(-3px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' });
}

// ---------- Book page ----------

function renderStars() {
  els.stars.replaceChildren(...[1, 2, 3, 4, 5].map((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `star${n <= draftRating ? ' on' : ''}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(n === draftRating));
    b.setAttribute('aria-label', `${n} ${plural(n, 'star')}`);
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
  els.status.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(current.status === b.dataset.status)));
  els.progressCard.hidden = current.status !== 'reading' && current.status !== 'dnf';
  els.format.hidden = current.status !== 'read';
  els.format.querySelectorAll('[data-format]').forEach((b) => b.setAttribute('aria-pressed', String(current.format === b.dataset.format)));
  const p = progressOf(current);
  setProgress(els.dTrack, p.pct);
  els.dProgress.textContent = p.text;
  els.dPage.value = current.page || '';
  els.dPages.value = current.pages || '';
}

/** Lending: on her shelf or loaned out, and who has it. */
function renderLoan() {
  const out = !!current.loaned;
  els.loanCard.querySelectorAll('[data-loan]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.loan === 'out') === out)));
  els.loanDetails.hidden = !out;
  if (document.activeElement !== els.dLoanTo) els.dLoanTo.value = current.loanedTo || '';
  const since = current.loanedAt ? new Date(current.loanedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
  const who = (current.loanedTo || '').trim();
  els.dLoanSince.textContent = since ? `${who ? `With ${who}` : 'Loaned out'} since ${since}` : '';
}

/** The big cover on the book page, with the loan dot when it's lent out. */
function renderDetailCover() {
  els.dCover.replaceChildren(coverEl(current), ...(current.loaned ? [loanDot()] : []));
}

function openDetail(id, originEl) {
  current = books.find((b) => b.id === id);
  if (!current) return;
  const c = current;
  renderDetailCover();
  els.dTitle.textContent = c.title;
  els.dAuthor.textContent = authorLine(c) || 'Author unknown';
  els.dMeta.textContent = [c.published && c.published.slice(0, 4), c.pages && `${fmt(c.pages)} pages`, c.isbn && `ISBN ${c.isbn}`].filter(Boolean).join(' · ');
  els.dGenre.replaceChildren(new Option('Add a genre', ''), ...GENRES.map((g) => new Option(g, g)));
  els.dGenre.value = c.genre || '';
  els.dGenre.classList.toggle('unset', !c.genre);
  els.dBlurb.textContent = c.blurb || 'No blurb came with this edition.';
  els.dBlurb.classList.toggle('empty', !c.blurb);
  draftRating = c.rating || 0;
  renderStars();
  renderStatus();
  renderLoan();
  els.dReview.value = c.review || '';
  els.saved.textContent = c.reviewedAt && c.review ? `Saved ${new Date(c.reviewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}` : '';
  closeCoverPicker();
  els.detail.showModal();
  els.detail.querySelector('.detail-scroll').scrollTop = 0;

  // The cover grows out of its place on the shelf.
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
  current = await saveRecord({ ...current, rating: draftRating, review: els.dReview.value.trim(), reviewedAt: Date.now() });
  render();
  els.saved.textContent = quiet ? 'Saved' : 'Review saved';
}

els.status.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-status]');
  if (!b || !current) return;
  const status = current.status === b.dataset.status ? '' : b.dataset.status;
  current = await saveRecord({ ...current, status, readingAt: status === 'reading' ? Date.now() : current.readingAt });
  renderStatus();
  render();
});

els.format.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-format]');
  if (!b || !current) return;
  const format = current.format === b.dataset.format ? '' : b.dataset.format;
  current = await saveRecord({ ...current, format });
  renderStatus();
  render();
});

els.loanCard.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-loan]');
  if (!b || !current) return;
  const out = b.dataset.loan === 'out';
  if (out === !!current.loaned) return;
  current = await saveRecord({ ...current, loaned: out, loanedAt: out ? Date.now() : 0, loanedTo: out ? current.loanedTo || '' : '' });
  renderLoan();
  renderDetailCover();
  render();
  if (out) els.dLoanTo.focus({ preventScroll: true });
});

let loanTimer = 0;
async function saveLoanTo() {
  clearTimeout(loanTimer);
  if (!current || (current.loanedTo || '') === els.dLoanTo.value.trim()) return;
  current = await saveRecord({ ...current, loanedTo: els.dLoanTo.value.trim() });
  renderLoan();
}
els.dLoanTo.addEventListener('input', () => { clearTimeout(loanTimer); loanTimer = setTimeout(saveLoanTo, 600); });
els.dLoanTo.addEventListener('change', saveLoanTo);

els.dGenre.addEventListener('change', async () => {
  if (!current) return;
  current = await saveRecord({ ...current, genre: els.dGenre.value });
  els.dGenre.classList.toggle('unset', !current.genre);
  render();
});

async function savePages() {
  if (!current) return;
  const pages = Math.max(0, parseInt(els.dPages.value, 10) || 0) || null;
  const page = Math.max(0, parseInt(els.dPage.value, 10) || 0);
  current = await saveRecord({ ...current, pages, page: pages ? Math.min(page, pages) : page });
  renderStatus();
  render();
}
els.dPage.addEventListener('change', savePages);
els.dPages.addEventListener('change', savePages);

async function deleteCurrent() {
  if (!current) return;
  if (!confirm(`Remove “${current.title}” from your library? Your rating and review go with it.`)) return;
  await db.remove(current.id);
  books = books.filter((b) => b.id !== current.id);
  current = null;
  els.detail.close();
  render();
  toast('Removed from your library');
}

// ---------- Changing a cover ----------

function closeCoverPicker() {
  if (picker) picker.stop();
  picker = null;
  els.coverCard.hidden = true;
  els.changeCoverBtn.hidden = false;
}

/** Open the cover picker on the book page: other editions' covers, or a photo of her copy. */
function openCoverPicker() {
  if (!current) return;
  const book = current;
  els.coverCard.hidden = false;
  els.changeCoverBtn.hidden = true;
  els.coverCard.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
  picker = coverPicker(els.coverPickerHost, book, {
    selected: () => (current ? current.cover : ''),
    photo: () => '',
    onPick: async (url, { upgrade } = {}) => {
      current = await saveRecord({ ...current, cover: url });
      // The sharper version arrives a moment later: swap the image without re-animating.
      if (upgrade) els.dCover.querySelector('img')?.setAttribute('src', url);
      else renderDetailCover();
      render();
      if (!upgrade) toast('Cover updated');
    },
    onTakePhoto: () => photographCover(book.id),
  });
}

/** Use a photo of her own copy as the cover. */
function photographCover(id) {
  els.detail.close();
  let done = false;
  scan.open({
    onPhoto: async (dataUrl) => {
      done = true;
      scan.close();
      await saveRecord({ ...books.find((b) => b.id === id), cover: dataUrl });
      render();
      openDetail(id);
      toast('Cover updated');
    },
  });
  // If she backs out of the camera, bring her back to the book.
  $('#scanner').addEventListener('close', () => { if (!done) openDetail(id); }, { once: true });
}

// ---------- Backup ----------

/**
 * Save the whole library to a file. On phones this opens the share sheet, so the backup can
 * go to iCloud Drive or Google Drive, Files, email or AirDrop; elsewhere it downloads.
 */
async function exportLibrary() {
  const json = JSON.stringify({ app: 'bbs-books', version: DATA_VERSION, exportedAt: new Date().toISOString(), books }, null, 2);
  const name = `bbs-books-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  let saved = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'BB’s Books backup' });
      saved = true;
    } catch (err) {
      if (err.name === 'AbortError') return; // she closed the share sheet
    }
  }
  if (!saved) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  await db.setMeta('lastBackup', Date.now());
  renderBackup();
  toast('Backup saved');
}

/** When a backup and the library both have a book, keep the copy that was changed last. */
const lastTouched = (b) => b.updatedAt || b.reviewedAt || b.addedAt || 0;

/**
 * Add the books from a backup file to the library. Nothing is deleted: books only in the
 * library stay, books only in the backup are added, and where both have a book (same ID,
 * ISBN or title and author) the more recently changed copy wins.
 */
async function importLibrary(file) {
  let list;
  try {
    const data = JSON.parse(await file.text());
    list = Array.isArray(data) ? data : data.books;
    if (!Array.isArray(list) || list.some((b) => !b || !b.id || !b.title)) throw new Error('bad file');
  } catch {
    toast('That file isn’t a BB’s Books backup');
    return;
  }
  const incoming = list.map(normaliseBook);
  const updates = [];
  let added = 0;
  for (const b of incoming) {
    const mine = books.find((x) => x.id === b.id) || findDuplicate(b);
    if (!mine) { updates.push(b); added++; } else if (lastTouched(b) > lastTouched(mine)) updates.push({ ...b, id: mine.id });
  }
  if (!updates.length) { toast('Everything in that backup is already here'); return; }
  const changed = updates.length - added;
  const parts = [added && `add ${added} ${plural(added, 'book')}`, changed && `update ${changed}`].filter(Boolean).join(' and ');
  if (!confirm(`This will ${parts}. Nothing in your library is removed. Go ahead?`)) return;
  if (books.length) await db.saveSnapshot(books, 'Before a restore', librarySignature(books));
  await db.putMany(updates);
  books = await db.getAll();
  render();
  renderBackup();
  toast(added ? `Added ${fmt(added)} ${plural(added, 'book')}` : 'Library updated');
}

// ---------- Feedback ----------

async function sendFeedback(e) {
  e.preventDefault();
  const message = els.fbMessage.value.trim();
  if (!message) {
    els.fbStatus.textContent = 'Write a message first';
    els.fbMessage.focus();
    return;
  }
  els.fbSend.disabled = true;
  els.fbStatus.textContent = 'Sending…';
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_TO}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: 'BB’s Books feedback',
        _template: 'box',
        _captcha: 'false',
        name: els.fbName.value.trim() || 'Not given',
        message,
        books: String(books.length),
        sent: new Date().toLocaleString('en-GB'),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || String(data.success) === 'false') throw new Error(data.message || `status ${res.status}`);
    els.feedbackForm.reset();
    els.fbStatus.textContent = '';
    toast('Sent. Thank you');
  } catch (err) {
    console.warn('Feedback failed', err);
    els.fbStatus.textContent = navigator.onLine ? 'That didn’t send. Try again in a moment.' : 'You’re offline. Try again when you have signal.';
  } finally {
    els.fbSend.disabled = false;
  }
}

// ---------- Start-up screen ----------

/** "Good morning", "Good afternoon" or "Good evening" for the hour (late night counts as evening). */
function greeting(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The greeting shown each time the app opens. There are no buttons: a tap anywhere sends
 * ripples out from her finger while the screen melts away into the library.
 */
function initSplash() {
  const splash = $('#splash');
  splash.querySelector('.splash-greeting').textContent = greeting();
  splash.prepend($('#washTemplate').content.cloneNode(true));
  splash.focus({ preventScroll: true });
  let opened = false;

  const open = (x, y) => {
    if (opened) return;
    opened = true;
    if (navigator.vibrate) navigator.vibrate(10);
    if (reduced()) {
      splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => splash.remove());
      return;
    }
    ripple(splash, x, y);
    splash.querySelector('.splash-content').animate([
      { transform: 'none', opacity: 1 },
      { transform: 'scale(1.06)', opacity: 0 },
    ], { duration: 460, easing: 'ease-in', fill: 'forwards' });
    splash.querySelector('.splash-hint').remove();
    // The ripples get half a second to spread before the screen melts into the library.
    splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: 500, easing: 'ease-in-out', fill: 'forwards' })
      .finished.then(() => splash.remove());
  };

  splash.addEventListener('click', (e) => open(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2));
  splash.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(innerWidth / 2, innerHeight / 2); }
  });
}

// ---------- Wiring ----------

// The same washes sit behind the app and behind the book page.
const washes = $('#washTemplate').content;
initSplash();
document.body.prepend(washes.cloneNode(true));
els.detail.prepend(washes.cloneNode(true));
$('#spinner').prepend(washes.cloneNode(true));
hydrateIcons();
scan.init({ findDuplicate, saveBook, placeIncoming, landed, openDetail, toast, count: () => books.length });
$('#scanner .celebrate').prepend(washes.cloneNode(true));
games.init({ books: () => books, openDetail, toast });
applyAccent(pref('bbs-accent'));

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) showScreen(go.dataset.go);
});
els.scanBtn.addEventListener('click', () => scan.open());
els.readingCard.addEventListener('click', () => openDetail(els.readingCard.dataset.id, els.readingCard.querySelector('.cover')));

els.statusFilter.addEventListener('change', () => { filter = els.statusFilter.value; renderHome(); });
els.search.addEventListener('input', renderHome);
els.sort.addEventListener('change', () => { pref('bbs-sort', els.sort.value); renderHome(); });
els.sort.value = pref('bbs-sort') || 'added';
els.genreFilter.addEventListener('change', () => { genre = els.genreFilter.value; renderHome(); });

els.detail.querySelector('[data-close]').addEventListener('click', () => els.detail.close());
els.saveBtn.addEventListener('click', () => saveDetail(false));
els.deleteBtn.addEventListener('click', deleteCurrent);
els.changeCoverBtn.addEventListener('click', openCoverPicker);
els.dReview.addEventListener('input', () => { els.saved.textContent = 'Not saved yet'; });
els.detail.addEventListener('close', () => {
  closeCoverPicker();
  saveLoanTo();
  // Never lose a half-written review because she closed the book without tapping Save.
  if (current && els.dReview.value.trim() !== (current.review || '')) saveDetail(true).then(() => toast('Review saved'));
});

els.exportBtn.addEventListener('click', exportLibrary);
els.feedbackForm.addEventListener('submit', sendFeedback);
els.fbMessage.addEventListener('input', () => { els.fbStatus.textContent = ''; });
els.importFile.addEventListener('change', () => {
  if (els.importFile.files[0]) importLibrary(els.importFile.files[0]);
  els.importFile.value = '';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline mode unavailable', err));
}

load();

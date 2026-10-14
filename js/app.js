import * as db from './db.js';
import * as lookup from './lookup.js';
import * as scanner from './scanner.js';
import * as reveal from './reveal.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  library: $('#library'),
  empty: $('#empty'),
  count: $('#count'),
  search: $('#search'),
  sort: $('#sort'),
  scanBtn: $('#scanBtn'),
  scanner: $('#scanner'),
  video: $('#video'),
  frame: $('#frame'),
  scanHint: $('#scanHint'),
  scanStatus: $('#scanStatus'),
  captureBtn: $('#captureBtn'),
  photoInput: $('#photoInput'),
  results: $('#results'),
  resultList: $('#resultList'),
  retakeBtn: $('#retakeBtn'),
  detail: $('#detail'),
  dCover: $('.detail-cover'),
  dTitle: $('#dTitle'),
  dAuthor: $('#dAuthor'),
  dMeta: $('#dMeta'),
  dBlurb: $('#dBlurb'),
  stars: $('#stars'),
  dReview: $('#dReview'),
  saveBtn: $('#saveBtn'),
  saved: $('#saved'),
  deleteBtn: $('#deleteBtn'),
  menuBtn: $('#menuBtn'),
  menu: $('#menu'),
  importFile: $('#importFile'),
  toast: $('#toast'),
};

let books = [];
let mode = 'barcode';
let busy = false;
let current = null; // book open in the detail view
let draftRating = 0;

// ---------- Helpers ----------

function toast(msg, ms = 2600) {
  // Dialogs sit on top of everything, so show the toast inside whichever one is open.
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

function authorLine(b) {
  return (b.authors || []).join(', ');
}

function normalise(s) {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function findDuplicate(book) {
  return books.find((b) => (book.isbn && b.isbn === book.isbn)
    || (normalise(b.title) === normalise(book.title) && normalise(authorLine(b)) === normalise(authorLine(book))));
}

// Cloth-binding colours for books without a cover picture.
const SPINES = ['#8c3b2e', '#2f5d50', '#3b4f7a', '#7a5a2f', '#5b3a6b', '#a0522d', '#35606e', '#6d2f45'];

function coverEl(book, className = 'cover') {
  const wrap = document.createElement('div');
  wrap.className = className;
  const fallback = () => {
    wrap.classList.add('placeholder');
    wrap.style.setProperty('--ph', SPINES[[...book.title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % SPINES.length]);
    wrap.innerHTML = '';
    const t = document.createElement('span');
    t.className = 'ph-title';
    t.textContent = book.title;
    const a = document.createElement('span');
    a.className = 'ph-author';
    a.textContent = authorLine(book);
    wrap.append(t, a);
  };
  const src = book.cover || book.photo;
  if (!src) {
    fallback();
    return wrap;
  }
  const img = new Image();
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = src;
  img.onerror = () => {
    // Remote cover failed: try the photo she took, otherwise draw a placeholder.
    if (book.photo && img.src !== book.photo) img.src = book.photo;
    else fallback();
  };
  // Open Library returns a 1x1 gif when it has no cover.
  img.onload = () => { if (img.naturalWidth < 10) img.onerror(); };
  wrap.append(img);
  return wrap;
}

// ---------- Library ----------

function sortedFiltered() {
  const q = normalise(els.search.value);
  const list = q
    ? books.filter((b) => normalise(`${b.title} ${authorLine(b)}`).includes(q))
    : books.slice();
  const by = els.sort.value;
  const cmp = {
    added: (a, b) => b.addedAt - a.addedAt,
    title: (a, b) => a.title.localeCompare(b.title),
    author: (a, b) => authorLine(a).localeCompare(authorLine(b)) || a.title.localeCompare(b.title),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title),
  }[by];
  return list.sort(cmp);
}

function render(incomingId) {
  const list = sortedFiltered();
  els.library.replaceChildren(...list.map((book) => {
    const btn = document.createElement('button');
    btn.className = book.id === incomingId ? 'book incoming' : 'book';
    btn.dataset.id = book.id;
    btn.setAttribute('aria-label', `${book.title}${book.authors?.length ? ` by ${authorLine(book)}` : ''}`);
    btn.append(coverEl(book));
    if (book.rating) {
      const r = document.createElement('span');
      r.className = 'badge';
      r.textContent = `★ ${book.rating}`;
      btn.append(r);
    }
    btn.addEventListener('click', () => openDetail(book.id, btn));
    return btn;
  }));
  els.empty.hidden = books.length > 0;
  const n = books.length;
  els.count.textContent = n ? `${n} book${n === 1 ? '' : 's'} on the shelves` : 'Your library';
}

async function load() {
  books = await db.getAll();
  render();
}

async function saveBook(data, photo) {
  const book = {
    id: uid(),
    title: data.title || 'Untitled',
    authors: data.authors || [],
    blurb: data.blurb || '',
    cover: data.cover || '',
    photo: data.cover ? '' : (photo || ''),
    isbn: data.isbn || '',
    publisher: data.publisher || '',
    published: data.published || '',
    pages: data.pages || null,
    rating: 0,
    review: '',
    addedAt: Date.now(),
  };
  await db.put(book);
  books.push(book);
  return book;
}

/** A scan found a book: show it off, and let her decide whether it goes on the shelf. */
async function presentFound(data, photo) {
  closeScanner();
  const dup = findDuplicate(data);
  const preview = { ...data, photo: data.cover ? '' : photo };
  const choice = await reveal.show(preview, coverEl(preview), { duplicate: !!dup });

  if (dup) {
    reveal.close();
    if (choice === 'primary') openDetail(dup.id);
    return;
  }
  if (choice !== 'primary') {
    await reveal.dismiss();
    return;
  }

  const book = await saveBook(data, photo);
  els.search.value = ''; // make sure the new book is visible
  render(book.id);
  const tile = els.library.querySelector(`[data-id="${book.id}"]`);
  tile.scrollIntoView({ block: 'center', behavior: 'instant' });
  await reveal.plopInto(tile);
  tile.classList.remove('incoming');
  tile.classList.add('landed');
  // Neighbours on the same shelf get knocked about a bit.
  [...els.library.children]
    .filter((el) => el !== tile && Math.abs(el.offsetTop - tile.offsetTop) < 4)
    .forEach((el) => {
      el.classList.add('jiggle');
      el.addEventListener('animationend', () => el.classList.remove('jiggle'), { once: true });
    });
  tile.addEventListener('animationend', () => tile.classList.remove('landed'), { once: true });
  if (navigator.vibrate) navigator.vibrate([20, 40, 30]);
  toast(`“${book.title}” is on the shelf`);
}

// ---------- Scanner ----------

function setStatus(msg) {
  els.scanStatus.textContent = msg;
}

function setMode(next) {
  mode = next;
  els.scanner.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  els.frame.className = `frame frame-${mode}`;
  els.results.hidden = true;
  els.captureBtn.hidden = mode !== 'cover' || !scanner.cameraLive();
  els.scanHint.textContent = mode === 'barcode'
    ? 'Line the barcode on the back up inside the box'
    : 'Fit the front cover inside the frame, then tap the button';
  setStatus('');
  scanner.stopBarcodeLoop();
  if (mode === 'barcode' && scanner.cameraLive()) beginBarcode();
}

function beginBarcode() {
  busy = false;
  scanner.startBarcodeLoop(els.video, {
    onIsbn: handleIsbn,
    onOther: () => setStatus('That barcode isn’t a book ISBN. Try the one on the back cover.'),
  });
}

function retryBarcodeSoon() {
  busy = false;
  setTimeout(() => { if (els.scanner.open && mode === 'barcode' && scanner.cameraLive() && !busy) beginBarcode(); }, 2500);
}

async function handleIsbn(isbn) {
  busy = true;
  if (navigator.vibrate) navigator.vibrate(60);
  setStatus(`Found ${isbn}. Looking it up…`);
  try {
    const book = await lookup.byIsbn(isbn);
    if (!book) {
      setStatus('Couldn’t find that book. Try scanning the cover instead.');
      retryBarcodeSoon();
      return;
    }
    await presentFound(book);
  } catch (err) {
    setStatus(err.message);
    retryBarcodeSoon();
  }
}

async function handleCapture() {
  if (busy) return;
  busy = true;
  els.captureBtn.disabled = true;
  els.video.pause();
  await readCover(scanner.capturePhoto(els.video, els.frame));
}

async function readCover(shot) {
  const photo = shot.toDataURL('image/jpeg', 0.8);
  try {
    setStatus('Reading the cover…');
    const text = await scanner.readCoverText(shot, (m) => {
      if (m.status === 'recognizing text') setStatus(`Reading the cover… ${Math.round(m.progress * 100)}%`);
      else if (m.status && m.status.startsWith('loading')) setStatus('Getting ready to read covers (first time only)…');
    });
    if (!text || text.replace(/\W/g, '').length < 3) {
      throw new Error('Couldn’t make out any words. Try again with more light, or scan the barcode.');
    }
    setStatus(`Searching for “${text}”…`);
    const found = await lookup.search(text);
    if (!found.length) throw new Error('No matching books found. Try again, or scan the barcode.');
    showResults(found, photo);
  } catch (err) {
    setStatus(err.message);
    resumeCover();
  }
}

function resumeCover() {
  busy = false;
  els.captureBtn.disabled = false;
  els.results.hidden = true;
  els.video.play().catch(() => {});
}

function showResults(found, photo) {
  setStatus('');
  els.resultList.replaceChildren(...found.map((b) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'result';
    btn.append(coverEl(b, 'cover small'));
    const text = document.createElement('div');
    const t = document.createElement('strong');
    t.textContent = b.title;
    const a = document.createElement('span');
    a.className = 'muted';
    a.textContent = [authorLine(b), b.published && b.published.slice(0, 4)].filter(Boolean).join(' · ');
    text.append(t, a);
    btn.append(text);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const full = await lookup.fillBlurb(b);
      await presentFound(full, photo);
    });
    li.append(btn);
    return li;
  }));
  els.results.hidden = false;
}

async function openScanner() {
  els.scanner.showModal();
  setStatus('Starting camera…');
  try {
    await scanner.startCamera(els.video);
    setMode(mode);
  } catch (err) {
    setMode(mode);
    setStatus(err.name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow the camera for this site in your settings, or use a photo instead.'
      : `${err.name === 'NotFoundError' ? 'No camera found.' : err.message} You can use a photo instead.`);
  }
}

function closeScanner() {
  scanner.stopCamera(els.video);
  busy = false;
  els.captureBtn.disabled = false;
  if (els.scanner.open) els.scanner.close();
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
    b.textContent = '★';
    b.addEventListener('click', () => {
      draftRating = draftRating === n ? 0 : n; // tap the same star again to clear
      renderStars();
      saveDetail(true);
    });
    return b;
  }));
}

function openDetail(id, originEl) {
  current = books.find((b) => b.id === id);
  if (!current) return;
  const c = current;
  els.dCover.replaceChildren(coverEl(c, 'detail-img'));
  els.dTitle.textContent = c.title;
  els.dAuthor.textContent = authorLine(c) || 'Unknown author';
  els.dMeta.textContent = [c.publisher, c.published, c.pages && `${c.pages} pages`, c.isbn && `ISBN ${c.isbn}`].filter(Boolean).join(' · ');
  els.dBlurb.textContent = c.blurb || 'No blurb was found for this book.';
  els.dBlurb.classList.toggle('muted', !c.blurb);
  draftRating = c.rating || 0;
  renderStars();
  els.dReview.value = c.review || '';
  els.saved.textContent = c.reviewedAt ? `Saved ${new Date(c.reviewedAt).toLocaleDateString()}` : '';

  // Zoom the cover out of its spot on the shelf.
  if (originEl && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const r = originEl.getBoundingClientRect();
    els.detail.style.setProperty('--from-x', `${r.left + r.width / 2 - innerWidth / 2}px`);
    els.detail.style.setProperty('--from-y', `${r.top + r.height / 2 - innerHeight / 2}px`);
    els.detail.style.setProperty('--from-s', `${Math.max(0.15, r.width / Math.min(innerWidth, 720))}`);
    els.detail.classList.add('zoom');
  } else {
    els.detail.classList.remove('zoom');
  }
  els.detail.showModal();
  els.detail.querySelector('.detail-scroll').scrollTop = 0;
}

async function saveDetail(quiet = false) {
  if (!current) return;
  const updated = {
    ...current,
    rating: draftRating,
    review: els.dReview.value.trim(),
    reviewedAt: Date.now(),
  };
  await db.put(updated);
  books = books.map((b) => (b.id === updated.id ? updated : b));
  current = updated;
  render();
  els.saved.textContent = quiet ? 'Rating saved' : 'Review saved ✓';
}

async function deleteCurrent() {
  if (!current) return;
  if (!confirm(`Remove “${current.title}” from your library? Your rating and review will be lost.`)) return;
  await db.remove(current.id);
  books = books.filter((b) => b.id !== current.id);
  current = null;
  els.detail.close();
  render();
  toast('Book removed');
}

// ---------- Backup ----------

function exportLibrary() {
  const blob = new Blob([JSON.stringify({ app: 'bbs-books', version: 1, books }, null, 2)], { type: 'application/json' });
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
    toast(`Restored ${list.length} books`);
  } catch {
    toast('That file doesn’t look like a BB’s Books backup');
  }
}

// ---------- Wiring ----------

els.scanBtn.addEventListener('click', openScanner);
els.scanner.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
els.captureBtn.addEventListener('click', handleCapture);
els.photoInput.addEventListener('change', async () => {
  const file = els.photoInput.files[0];
  els.photoInput.value = '';
  if (!file || busy) return;
  busy = true;
  scanner.stopBarcodeLoop();
  els.results.hidden = true;
  try {
    const canvas = await scanner.fileToCanvas(file);
    if (mode === 'barcode') {
      setStatus('Looking for a barcode…');
      const isbn = await scanner.readBarcodeFromCanvas(canvas);
      if (!isbn) throw new Error('Couldn’t find an ISBN barcode in that photo. Try a closer, sharper one, or switch to Cover.');
      await handleIsbn(isbn);
    } else {
      await readCover(canvas);
    }
  } catch (err) {
    busy = false;
    setStatus(err.message);
    if (mode === 'barcode' && scanner.cameraLive()) beginBarcode();
  }
});
els.retakeBtn.addEventListener('click', () => { setStatus(''); resumeCover(); });
els.scanner.addEventListener('close', () => scanner.stopCamera(els.video));
els.scanner.querySelector('[data-close]').addEventListener('click', closeScanner);

els.detail.querySelector('[data-close]').addEventListener('click', () => els.detail.close());
els.detail.addEventListener('click', (e) => { if (e.target === els.detail) els.detail.close(); });
els.saveBtn.addEventListener('click', () => saveDetail(false));
els.deleteBtn.addEventListener('click', deleteCurrent);
els.dReview.addEventListener('input', () => { els.saved.textContent = 'Unsaved changes'; });
els.detail.addEventListener('close', () => {
  // Don't lose a half-written review if she closes the book without tapping Save.
  if (current && els.dReview.value.trim() !== (current.review || '')) saveDetail(true).then(() => toast('Review saved'));
});

els.search.addEventListener('input', render);
els.sort.addEventListener('change', () => {
  try { localStorage.setItem('bbs-sort', els.sort.value); } catch { /* optional */ }
  render();
});
try { els.sort.value = localStorage.getItem('bbs-sort') || 'added'; } catch { /* optional */ }

els.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); els.menu.hidden = !els.menu.hidden; });
document.addEventListener('click', (e) => { if (!els.menu.contains(e.target)) els.menu.hidden = true; });
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

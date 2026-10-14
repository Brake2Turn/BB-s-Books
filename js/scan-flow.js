// The scan screen: camera, the result sheet, search fallback, and the move onto the shelf.
import * as lookup from './lookup.js';
import * as scanner from './scanner.js';
import { coverEl } from './covers.js';

const $ = (sel) => document.querySelector(sel);
const dlg = $('#scanner');
const els = {
  video: $('#video'),
  camera: dlg.querySelector('.camera'),
  frame: $('#frame'),
  seg: dlg.querySelector('.scan-top .seg'),
  hint: $('#scanHint'),
  status: $('#scanStatus'),
  shutter: $('#captureBtn'),
  photoInput: $('#photoInput'),
  searchOpen: $('#searchOpen'),
  result: $('#resultSheet'),
  rCover: dlg.querySelector('.result-cover'),
  rTitle: dlg.querySelector('.result-title'),
  rAuthor: dlg.querySelector('.result-author'),
  rMeta: dlg.querySelector('.result-meta'),
  rBlurb: dlg.querySelector('.result-blurb'),
  rNote: dlg.querySelector('.result-note'),
  coverSwap: dlg.querySelector('.cover-swap'),
  primary: dlg.querySelector('[data-choice="primary"]'),
  secondary: dlg.querySelector('[data-choice="secondary"]'),
  list: $('#listSheet'),
  listTitle: dlg.querySelector('#listSheet .sheet-title'),
  listSub: dlg.querySelector('#listSheet .sheet-sub'),
  searchForm: $('#searchForm'),
  searchInput: $('#searchInput'),
  resultList: $('#resultList'),
  listBack: $('#listBack'),
};

const HINTS = {
  barcode: 'Hold the barcode on the back inside the frame',
  cover: 'Fit the front cover inside the frame',
  photo: 'Fit the front of your copy inside the frame',
};

let ctx;            // library hooks supplied by app.js
let mode = 'barcode';
let scanMode = 'barcode'; // the mode to return to after taking a cover photo
let busy = false;
let onPhoto = null; // set while taking a photo for a cover
let found = null;   // { book, photo, dup, coverReady }
let dismissed = { isbn: '', until: 0 }; // a barcode she just said no to, while it's still in view

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const authorLine = (b) => (b.authors || []).join(', ');

function setStatus(msg) { els.status.textContent = msg || ''; }
function haptic(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }

// ---------- Modes ----------

function setMode(next) {
  mode = next;
  dlg.scrollTop = 0;
  if (next !== 'photo') scanMode = next;
  els.seg.hidden = next === 'photo';
  els.seg.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === next)));
  els.frame.className = `frame frame-${next === 'barcode' ? 'barcode' : 'cover'}`;
  els.hint.textContent = HINTS[next];
  els.shutter.hidden = next === 'barcode' || !scanner.cameraLive();
  els.shutter.disabled = false;
  els.searchOpen.hidden = next === 'photo';
  scanner.stopBarcodeLoop();
  busy = false;
  if (next === 'barcode' && scanner.cameraLive()) {
    scanner.startBarcodeLoop(els.video, {
      onIsbn: handleIsbn,
      onOther: () => setStatus('That barcode isn’t an ISBN. Try the one with 978 or 979 beneath it.'),
    });
  }
}

function resumeCamera() {
  els.video.play().catch(() => {});
  setMode(mode);
}

// ---------- Sheets ----------

function openSheet(sheet) {
  [els.result, els.list].forEach((s) => {
    const on = s === sheet;
    s.classList.toggle('open', on);
    s.setAttribute('aria-hidden', String(!on));
  });
}

function closeSheets() { openSheet(null); }

function showList({ title, sub = '', search = false, items = [], photo = '', photoRatio = '' }) {
  scanner.stopBarcodeLoop();
  els.listTitle.textContent = title;
  els.listSub.textContent = sub;
  els.searchForm.hidden = !search;
  renderList(items, photo, photoRatio);
  openSheet(els.list);
  // Focus after the sheet has risen, without letting the browser scroll the camera view.
  if (search) setTimeout(() => { els.searchInput.focus({ preventScroll: true }); dlg.scrollTop = 0; }, 340);
}

function renderList(items, photo = '', photoRatio = '') {
  els.resultList.replaceChildren(...items.map((b) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'pick';
    btn.append(coverEl(b));
    const text = document.createElement('span');
    const t = document.createElement('strong');
    t.textContent = b.title;
    const a = document.createElement('em');
    a.textContent = [authorLine(b), b.published && b.published.slice(0, 4)].filter(Boolean).join(', ');
    text.append(t, a);
    btn.append(text);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      showResult(await lookup.fillBlurb(b), { photo, photoRatio });
    });
    li.append(btn);
    return li;
  }));
}

/** Show a found book in the result sheet. The cover is revealed once the right edition's picture loads. */
function showResult(book, { photo = '', photoRatio = '' } = {}) {
  scanner.stopBarcodeLoop();
  setStatus('');
  const dup = ctx.findDuplicate(book);
  // From a cover photo, her own copy is the default picture: it's exactly her edition.
  found = { book: { ...book }, photo, photoRatio, dup, usingPhoto: !!photo };

  els.rTitle.textContent = book.title;
  els.rAuthor.textContent = authorLine(book) || 'Author unknown';
  els.rMeta.textContent = [book.published && book.published.slice(0, 4), book.pages && `${book.pages} pages`, book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join('  ·  ');
  els.rBlurb.textContent = book.blurb || '';
  els.rNote.hidden = !dup;
  els.rNote.textContent = dup ? 'This one is already on your shelf.' : '';
  els.primary.textContent = dup ? 'Open book' : 'Add to library';
  els.secondary.textContent = dup ? 'Scan another' : 'Not this one';
  els.primary.disabled = false;
  updateCoverSwap();

  // Start with her photo or a typographic stand-in, then reveal the published cover.
  setResultCover(photo ? { ...book, cover: photo, coverRatio: photoRatio } : { ...book, cover: '' }, false);
  openSheet(els.result);
  if (!reduced()) {
    els.rCover.animate([
      { transform: 'translateX(-28px) rotate(-4deg)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ], { duration: 320, delay: 140, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'backwards' });
  }

  const ticket = found;
  found.coverReady = lookup.resolveCover(book).then((withCover) => {
    if (found !== ticket) return;
    found.book.cover = withCover.cover;
    found.book.coverRatio = withCover.coverRatio;
    if (!found.usingPhoto) setResultCover(found.book, true);
    if (!withCover.cover && !photo) {
      els.rNote.hidden = false;
      els.rNote.textContent = dup ? els.rNote.textContent : 'We couldn’t find a picture of this edition. You can add a photo of your copy.';
    }
  });
}

function setResultCover(book, reveal) {
  const el = coverEl(book);
  const previous = els.rCover.firstElementChild;
  const img = el.querySelector('img');
  if (!reveal || !previous || !img) {
    els.rCover.replaceChildren(el);
    return;
  }
  // Reveal: the real cover fades in over the stand-in, then takes its place.
  el.classList.add('over');
  els.rCover.append(el);
  const settle = () => setTimeout(() => { previous.remove(); el.classList.remove('over'); }, 260);
  img.addEventListener('load', settle, { once: true });
  img.addEventListener('error', settle, { once: true });
}

function updateCoverSwap() {
  const span = els.coverSwap.querySelector('span');
  if (found.dup) { els.coverSwap.hidden = true; return; }
  els.coverSwap.hidden = false;
  if (found.photo) span.textContent = found.usingPhoto ? 'Use the published cover' : 'Use my photo as the cover';
  else span.textContent = 'Not your edition’s cover? Take a photo of yours';
}

els.coverSwap.addEventListener('click', () => {
  if (found.photo) {
    found.usingPhoto = !found.usingPhoto;
    setResultCover(found.usingPhoto ? { ...found.book, cover: found.photo, coverRatio: found.photoRatio || '' } : found.book, true);
    updateCoverSwap();
    return;
  }
  // Take a photo of her copy, then come back to this sheet.
  closeSheets();
  onPhoto = (dataUrl, ratio) => {
    onPhoto = null;
    found.photo = dataUrl;
    found.photoRatio = ratio;
    found.usingPhoto = true;
    setResultCover({ ...found.book, cover: dataUrl, coverRatio: ratio }, true);
    updateCoverSwap();
    setMode(scanMode);
    scanner.stopBarcodeLoop();
    openSheet(els.result);
  };
  setMode('photo');
});

els.primary.addEventListener('click', async () => {
  if (!found) return;
  els.primary.disabled = true;
  if (found.dup) {
    const id = found.dup.id;
    close();
    ctx.openDetail(id);
    return;
  }
  await addToLibrary();
});

els.secondary.addEventListener('click', () => {
  if (found && found.book.isbn) dismissed = { isbn: found.book.isbn, until: Date.now() + 2500 };
  found = null;
  closeSheets();
  setStatus('');
  resumeCamera();
});

// ---------- Scanning ----------

async function handleIsbn(isbn) {
  if (isbn === dismissed.isbn && Date.now() < dismissed.until) {
    // Still looking at the book she just turned down: keep ignoring it until it leaves the frame.
    dismissed.until = Date.now() + 2500;
    setTimeout(() => { if (dlg.open && mode === 'barcode' && !found) setMode('barcode'); }, 250);
    return;
  }
  busy = true;
  els.frame.classList.add('locked');
  haptic(10);
  setStatus('Looking it up…');
  try {
    const book = await lookup.byIsbn(isbn);
    if (!book) throw new Error('We couldn’t find that one. Try the barcode again or search by title.');
    showResult(book);
  } catch (err) {
    setStatus(err.message);
    setTimeout(() => { if (dlg.open && mode === 'barcode' && !found) setMode('barcode'); }, 2500);
  } finally {
    els.frame.classList.remove('locked');
  }
}

async function readCover(canvas) {
  const photo = canvas.toDataURL('image/jpeg', 0.82);
  const photoRatio = `${canvas.width} / ${canvas.height}`;
  try {
    setStatus('Reading the cover…');
    const text = await scanner.readCoverText(canvas, (m) => {
      if (m.status === 'recognizing text') setStatus(`Reading the cover… ${Math.round(m.progress * 100)}%`);
      else if (m.status && m.status.startsWith('loading')) setStatus('Getting ready to read covers. This happens once.');
    });
    if (!text || text.replace(/\W/g, '').length < 3) {
      throw new Error('We couldn’t make out the words. Try again in better light, or search by title.');
    }
    setStatus('Searching…');
    const items = await lookup.search(text);
    if (!items.length) throw new Error('We couldn’t find that one. Try the barcode, or search by title.');
    found = null;
    showList({ title: 'Which book is it?', sub: `Read from the cover: “${text}”`, items, photo, photoRatio });
    setStatus('');
  } catch (err) {
    setStatus(err.message);
    resumeCamera();
  }
}

async function takePhoto(canvas) {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  const ratio = `${canvas.width} / ${canvas.height}`;
  const cb = onPhoto;
  if (cb) cb(dataUrl, ratio);
}

els.shutter.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  els.shutter.disabled = true;
  els.video.pause();
  const canvas = scanner.capturePhoto(els.video, els.frame);
  if (mode === 'photo') {
    await takePhoto(canvas);
    els.video.play().catch(() => {});
  } else {
    await readCover(canvas);
  }
});

els.photoInput.addEventListener('change', async () => {
  const file = els.photoInput.files[0];
  els.photoInput.value = '';
  if (!file || busy) return;
  busy = true;
  scanner.stopBarcodeLoop();
  closeSheets();
  try {
    const canvas = await scanner.fileToCanvas(file);
    if (mode === 'photo') {
      await takePhoto(canvas);
    } else if (mode === 'barcode') {
      setStatus('Looking for a barcode…');
      const isbn = await scanner.readBarcodeFromCanvas(canvas);
      if (!isbn) throw new Error('We couldn’t find an ISBN barcode in that photo. Try a closer one, or switch to Cover.');
      await handleIsbn(isbn);
    } else {
      await readCover(canvas);
    }
  } catch (err) {
    setStatus(err.message);
    setMode(mode);
  }
});

els.searchOpen.addEventListener('click', () => {
  found = null;
  els.searchInput.value = '';
  showList({ title: 'Search by title', sub: 'Add a book whose barcode won’t scan.', search: true });
});

els.searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = els.searchInput.value.trim();
  if (!q) return;
  els.searchInput.blur();
  const msg = document.createElement('li');
  msg.className = 'meta';
  msg.textContent = 'Searching…';
  els.resultList.replaceChildren(msg);
  try {
    const items = await lookup.search(q, 8);
    if (items.length) renderList(items);
    else msg.textContent = 'Nothing found. Try fewer words, or just the author’s surname.';
  } catch {
    msg.textContent = 'We couldn’t reach the book databases. Check your connection and try again.';
  }
});

els.listBack.addEventListener('click', () => { closeSheets(); setStatus(''); resumeCamera(); });

dlg.querySelector('.seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (b && !found) { closeSheets(); setStatus(''); setMode(b.dataset.mode); }
});
dlg.querySelector('[data-close]').addEventListener('click', () => close());
dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });

// ---------- Onto the shelf ----------

/** Run keyframes, or a plain fade when the viewer prefers less motion. */
function move(el, frames, opts) {
  const kf = reduced() ? [{ opacity: 1 }, { opacity: 0 }] : frames;
  return el.animate(kf, { fill: 'forwards', ...opts }).finished.catch(() => {});
}

async function addToLibrary() {
  // Give the cover search a moment to finish so the shelf gets the real picture.
  await Promise.race([found.coverReady, new Promise((r) => setTimeout(r, 4000))]);
  const data = { ...found.book };
  if (found.usingPhoto) {
    data.cover = found.photo;
    data.coverRatio = found.photoRatio || '';
  }
  const saved = await ctx.saveBook(data);
  const tile = ctx.placeIncoming(saved.id);

  const source = els.rCover.querySelector('.cover');
  const from = source.getBoundingClientRect();
  const to = tile.querySelector('.cover, .spine').getBoundingClientRect();

  // A copy of the cover travels from the sheet to its place on the shelf.
  const flyer = source.cloneNode(true);
  flyer.classList.add('flying');
  Object.assign(flyer.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  dlg.append(flyer);
  source.style.visibility = 'hidden';

  closeSheets();
  dlg.classList.add('settling');
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  // Heavily damped settle: one small give at the end, like a book set down.
  await move(flyer, [
    { transform: 'none', boxShadow: '0 18px 40px rgba(46,38,32,.22)', offset: 0 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 24}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2})`, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy + 2}px) scale(${sx}, ${sy * 0.985})`, boxShadow: '0 1px 2px rgba(46,38,32,.1)', offset: 0.86 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, boxShadow: '0 0 0 rgba(46,38,32,0)', offset: 1 },
  ], { duration: 640, easing: 'cubic-bezier(.22,.8,.3,1)' });

  ctx.landed(tile);
  flyer.remove();
  haptic(18);
  close();
  ctx.toast('Added to your shelf.');
}

// ---------- Open / close ----------

/** Open the scanner. Pass onPhoto to just take a photo of a cover (e.g. replacing one). */
export async function open(opts = {}) {
  ctx = ctx || opts.ctx;
  found = null;
  onPhoto = opts.onPhoto || null;
  closeSheets();
  setStatus('');
  dlg.classList.remove('settling');
  dlg.showModal();
  try {
    await scanner.startCamera(els.video);
    setMode(onPhoto ? 'photo' : scanMode);
  } catch (err) {
    setMode(onPhoto ? 'photo' : scanMode);
    setStatus(err.name === 'NotAllowedError'
      ? 'Camera access is off for this site. Turn it on in your browser settings, or use a photo instead.'
      : 'There’s no camera available here. You can use a photo or search by title instead.');
  }
}

export function close() {
  scanner.stopCamera(els.video);
  found = null;
  onPhoto = null;
  busy = false;
  closeSheets();
  if (dlg.open) dlg.close();
  dlg.classList.remove('settling');
}

export function init(hooks) { ctx = hooks; }

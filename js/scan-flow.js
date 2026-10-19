// The scan screen: camera, the result sheet, search fallback, and the move onto the shelf.
import * as lookup from './lookup.js';
import * as scanner from './scanner.js';
import { coverEl } from './covers.js';
import { coverPicker } from './cover-picker.js';
import { ripple } from './ripple.js';
import * as sound from './sound.js';

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
  picker: dlg.querySelector('#resultSheet .cover-picker'),
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
let found = null;   // { book, photo, usingPhoto, picked, dup, coverReady, picker }
let session = 0;    // bumped on every open and close, so late results from a closed scanner are dropped
let adding = false; // true while a book is being added and celebrated
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

let listPhoto = ''; // a cover photo carried through an edited search

function showList({ title, sub = '', search = false, query = '', items = [], photo = '' }) {
  listPhoto = photo;
  els.searchInput.value = query;
  scanner.stopBarcodeLoop();
  els.listTitle.textContent = title;
  els.listSub.textContent = sub;
  els.searchForm.hidden = !search;
  renderList(items, photo);
  openSheet(els.list);
  // Focus after the sheet has risen, without letting the browser scroll the camera view.
  if (search && !query) setTimeout(() => { els.searchInput.focus({ preventScroll: true }); dlg.scrollTop = 0; }, 340);
}

function renderList(items, photo = '') {
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
      const s = session;
      const full = await lookup.fillBlurb(b);
      if (s === session) showResult(full, { photo });
    });
    li.append(btn);
    return li;
  }));
}

/** Show a found book in the result sheet, with the possible covers to choose from. */
function showResult(book, { photo = '' } = {}) {
  scanner.stopBarcodeLoop();
  setStatus('');
  const dup = ctx.findDuplicate(book);
  if (found && found.picker) found.picker.stop();
  // From a cover photo, her own copy is the default picture: it's exactly her edition.
  found = { book: { ...book }, photo, dup, usingPhoto: !!photo, picked: false };

  els.rTitle.textContent = book.title;
  els.rAuthor.textContent = authorLine(book) || 'Author unknown';
  els.rMeta.textContent = [book.published && book.published.slice(0, 4), book.pages && `${book.pages} pages`, book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join('  ·  ');
  els.rBlurb.textContent = book.blurb || '';
  els.rNote.hidden = !dup;
  els.rNote.textContent = dup ? 'This one is already in your library.' : '';
  els.primary.textContent = dup ? 'Open book' : 'Add to library';
  els.secondary.textContent = dup ? 'Scan another' : 'Not this one';
  els.primary.disabled = false;
  els.secondary.disabled = false;

  // Start with her photo or a typographic stand-in, then reveal the published cover.
  setResultCover(photo ? { ...book, cover: photo } : { ...book, cover: '' }, false);
  openSheet(els.result);
  if (!reduced()) {
    els.rCover.animate([
      { transform: 'translateX(-28px) rotate(-4deg)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ], { duration: 320, delay: 140, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'backwards' });
  }

  const ticket = found;
  els.picker.hidden = !!dup;
  if (!dup) {
    found.picker = coverPicker(els.picker, book, {
      selected: () => (ticket.usingPhoto ? ticket.photo : ticket.book.cover),
      photo: () => ticket.photo,
      onPick: (url) => {
        ticket.picked = true;
        ticket.usingPhoto = url === ticket.photo;
        if (!ticket.usingPhoto) ticket.book.cover = url;
        setResultCover({ ...ticket.book, cover: url }, true);
      },
      onTakePhoto: () => takeCoverPhoto(ticket),
    });
  }
  found.coverReady = lookup.resolveCover(book).then((cover) => {
    if (found !== ticket || ticket.picked) return;
    ticket.book.cover = cover;
    if (!ticket.usingPhoto) setResultCover(ticket.book, true);
    if (ticket.picker) ticket.picker.refresh();
    if (!cover && !photo && !dup) {
      els.rNote.hidden = false;
      els.rNote.textContent = 'We couldn’t find a picture of this edition. Pick another cover below, or take a photo of yours.';
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
  // Reveal: the new cover fades in over the old one, then takes its place.
  el.classList.add('over');
  els.rCover.append(el);
  const settle = () => setTimeout(() => {
    [...els.rCover.children].forEach((c) => { if (c !== el) c.remove(); });
    el.classList.remove('over');
  }, 260);
  img.addEventListener('load', settle, { once: true });
  img.addEventListener('error', settle, { once: true });
}

/** Take a photo of her copy for this book, then come back to the result sheet. */
function takeCoverPhoto(ticket) {
  closeSheets();
  onPhoto = (dataUrl) => {
    onPhoto = null;
    if (found !== ticket) return;
    ticket.photo = dataUrl;
    ticket.usingPhoto = true;
    ticket.picked = true;
    setResultCover({ ...ticket.book, cover: dataUrl }, true);
    if (ticket.picker) ticket.picker.refresh();
    setMode(scanMode);
    scanner.stopBarcodeLoop();
    openSheet(els.result);
  };
  setMode('photo');
}

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
  if (adding) return;
  if (found && found.book.isbn) dismissed = { isbn: found.book.isbn, until: Date.now() + 2500 };
  if (found && found.picker) found.picker.stop();
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
  sound.playScan();
  setStatus('Looking it up…');
  const s = session;
  try {
    const book = await lookup.byIsbn(isbn);
    if (s !== session) return; // the scanner was closed while we looked
    if (!book) throw new Error('We couldn’t find that one. Try the barcode again or search by title.');
    showResult(book);
  } catch (err) {
    if (s !== session) return;
    setStatus(err.name === 'AbortError' ? 'The book databases are slow to answer. Try again in a moment.' : err.message);
    setTimeout(() => { if (s === session && mode === 'barcode' && !found) setMode('barcode'); }, 2500);
  } finally {
    els.frame.classList.remove('locked');
  }
}

async function readCover(canvas) {
  const photo = canvas.toDataURL('image/jpeg', 0.82);
  const s = session;
  try {
    setStatus('Reading the cover…');
    const reading = await scanner.readCoverText(canvas, (m) => {
      if (m.status === 'recognizing text') setStatus(`Reading the cover… ${Math.round(m.progress * 100)}%`);
      else if (m.status && m.status.startsWith('loading')) setStatus('Getting ready to read covers. This happens once.');
    });
    if (!reading.query || reading.query.replace(/\W/g, '').length < 3) {
      throw new Error('We couldn’t make out the words. Try again in better light, or search by title.');
    }
    if (s !== session) return;
    sound.playScan();
    setStatus('Searching…');
    const items = await lookup.searchCover(reading);
    if (s !== session) return; // closed while searching
    found = null;
    // The words it read stay editable, so a misread is a quick fix rather than a rescan.
    showList({
      title: items.length ? 'Which book is it?' : 'We couldn’t find that one',
      sub: items.length ? 'Not here? Fix the words below and search again.' : 'Check the words it read, or try the barcode.',
      search: true,
      query: reading.query,
      items,
      photo,
    });
    setStatus('');
  } catch (err) {
    if (s !== session) return;
    setStatus(err.message);
    resumeCamera();
  }
}

function takePhoto(canvas) {
  if (onPhoto) onPhoto(canvas.toDataURL('image/jpeg', 0.82));
}

els.shutter.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  els.shutter.disabled = true;
  els.video.pause();
  const canvas = scanner.capturePhoto(els.video, els.frame);
  if (mode === 'photo') {
    takePhoto(canvas);
    els.video.play().catch(() => {});
  } else {
    await readCover(canvas);
  }
});

els.photoInput.addEventListener('change', async () => {
  const file = els.photoInput.files[0];
  els.photoInput.value = '';
  sound.unlock();
  if (!file || busy) return;
  busy = true;
  scanner.stopBarcodeLoop();
  closeSheets();
  try {
    const canvas = await scanner.fileToCanvas(file);
    if (mode === 'photo') {
      takePhoto(canvas);
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
  showList({ title: 'Search by title', sub: 'Add a book whose barcode won’t scan.', search: true });
});

els.searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = els.searchInput.value.trim();
  if (!q) return;
  els.searchInput.blur();
  const msg = document.createElement('li');
  msg.className = 'caption';
  msg.textContent = 'Searching…';
  els.resultList.replaceChildren(msg);
  try {
    const items = await lookup.search(q, 8);
    if (items.length) renderList(items, listPhoto);
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
// While a book is being added the scanner can't be closed: the add would be left half done.
dlg.querySelector('[data-close]').addEventListener('click', () => { if (!adding) close(); });
dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (!adding) close(); });

// ---------- Onto the shelf ----------

/** Run keyframes, or a plain fade when the viewer prefers less motion. */
function move(el, frames, opts) {
  const kf = reduced() ? [{ opacity: 1 }, { opacity: 0 }] : frames;
  return el.animate(kf, { fill: 'forwards', ...opts }).finished.catch(() => {});
}

// ---------- Celebration ----------

const CHEERS = ['A fine addition', 'The shelf grows', 'Good choice', 'Another one for the shelves', 'One more story to keep'];

/** Milestones: the 1st, 5th, 10th, 25th, 50th and 100th book, then every hundred after that. */
const isMilestone = (n) => [1, 5, 10, 25, 50].includes(n) || (n >= 100 && n % 100 === 0);

const UNITS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
/** "Two hundred", "One thousand", "Two thousand three hundred" for the round milestones. */
function hundredsInWords(n) {
  const th = Math.floor(n / 1000);
  const h = Math.floor((n % 1000) / 100);
  if (th > 9) return n.toLocaleString('en-GB');
  const words = [th && `${UNITS[th]} thousand`, h && `${UNITS[h]} hundred`].filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The words for the moment. Milestones get their own gold headline; other books a warm line. */
export function cheerFor(n, book) {
  const byline = [book.title, (book.authors || [])[0]].filter(Boolean).join(' by ');
  const lines = {
    1: ['Your very first book', `Every library starts with one. Yours starts with ${byline}.`],
    5: ['Five books on the shelf', `${byline} makes five. It’s starting to look like a library.`],
    10: ['Ten books and counting', `${byline} takes you into double figures.`],
    25: ['Twenty-five books strong', `${byline} makes twenty-five. That’s a proper shelf.`],
    50: ['Fifty books, half a century', `${byline} makes fifty. Halfway to a hundred.`],
    100: ['One hundred books', `${byline} takes you to a hundred. A true library.`],
  };
  if (isMilestone(n)) {
    const [big, sub] = lines[n] || [`${hundredsInWords(n)} books`, `${byline} makes ${n.toLocaleString('en-GB')}. What a collection.`];
    return { big, sub, milestone: true };
  }
  return { big: `Book ${n.toLocaleString('en-GB')}`, sub: `${CHEERS[n % CHEERS.length]}: ${byline}.`, milestone: false };
}

const confettiCanvas = dlg.querySelector('.confetti');
const celebrateText = dlg.querySelector('.celebrate-text');

/**
 * A burst of confetti on a plain canvas: the guide's wash colours and cobalt for a normal
 * book, all gold (with glinting pieces) for a milestone.
 */
function confetti(originX, originY, { side = false, gold = false } = {}) {
  if (reduced()) return;
  const css = getComputedStyle(document.documentElement);
  const colours = (gold
    ? ['--gold-light', '--gold', '--gold', '--gold-mid', '--gold-deep', '--white']
    : ['--wash-coral', '--wash-pink', '--wash-sky', '--wash-apricot', '--accent', '--accent', '--white'])
    .map((t) => css.getPropertyValue(t).trim());
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = innerWidth;
  const h = innerHeight;
  confettiCanvas.width = w * dpr;
  confettiCanvas.height = h * dpr;
  const ctx2 = confettiCanvas.getContext('2d');
  ctx2.scale(dpr, dpr);

  const make = (x, y, angle, spread, speed, count) => Array.from({ length: count }, () => {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.55 + Math.random() * 0.6);
    return {
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      size: 5 + Math.random() * 6,
      round: Math.random() < 0.3,
      colour: colours[Math.floor(Math.random() * colours.length)],
      wobble: Math.random() * 10,
      glint: gold && Math.random() < 0.35, // some gold pieces catch the light as they turn
    };
  });
  // One burst from behind the cover, plus cannons from the bottom corners for milestones.
  let bits = make(originX, originY, -Math.PI / 2, Math.PI * 1.6, 15, 150);
  if (side) bits = bits.concat(make(0, h, -Math.PI / 3, 0.6, 22, 70), make(w, h, -Math.PI * 2 / 3, 0.6, 22, 70));

  const start = performance.now();
  const life = side ? 2600 : 2100;
  const frame = (now) => {
    const t = now - start;
    ctx2.clearRect(0, 0, w, h);
    ctx2.globalAlpha = Math.max(0, Math.min(1, (life - t) / 500));
    for (const p of bits) {
      p.vy += 0.32;            // gravity
      p.vx *= 0.985; p.vy *= 0.985; // air
      p.x += p.vx + Math.sin((t / 120) + p.wobble) * 0.6;
      p.y += p.vy;
      p.r += p.vr;
      ctx2.save();
      ctx2.translate(p.x, p.y);
      ctx2.rotate(p.r);
      ctx2.fillStyle = p.colour;
      if (p.glint) ctx2.globalAlpha = Math.max(0, Math.min(1, (life - t) / 500)) * (0.55 + 0.45 * Math.abs(Math.sin(t / 70 + p.wobble)));
      if (p.round) { ctx2.beginPath(); ctx2.arc(0, 0, p.size / 2.4, 0, Math.PI * 2); ctx2.fill(); }
      else ctx2.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.4 + Math.abs(Math.sin(t / 90 + p.wobble))));
      ctx2.restore();
      if (p.glint) ctx2.globalAlpha = Math.max(0, Math.min(1, (life - t) / 500));
    }
    if (t < life) requestAnimationFrame(frame);
    else ctx2.clearRect(0, 0, w, h);
  };
  requestAnimationFrame(frame);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The big moment: the cover springs to the middle of the screen in front of the washes,
 * shines, confetti bursts from behind it and the count is called out.
 * Resolves with the transform the cover ended on, once she taps or the moment has had its time.
 */
async function celebrate(flyer, from, book) {
  const n = ctx.count();
  const cheer = cheerFor(n, book);
  celebrateText.querySelector('.celebrate-big').textContent = cheer.big;
  celebrateText.querySelector('.celebrate-sub').textContent = cheer.sub;
  celebrateText.querySelector('.celebrate-eyebrow span').textContent = cheer.milestone ? 'A milestone' : 'Added to your library';
  celebrateText.classList.toggle('milestone', cheer.milestone);
  dlg.classList.add('celebrating');

  const tw = Math.min(innerWidth * 0.46, 200);
  const th = tw * (from.height / from.width);
  const s1 = tw / from.width;
  const dx = innerWidth / 2 - tw / 2 - from.left;
  const dy = innerHeight * 0.32 - th / 2 - from.top;
  const centre = `translate(${dx}px, ${dy}px) scale(${s1})`;

  if (reduced()) {
    flyer.style.transform = centre;
    flyer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
  } else {
    // Spring up: dip, overshoot, settle, with a little tilt.
    flyer.animate([
      { transform: 'none' },
      { transform: `translate(${dx}px, ${dy + 40}px) scale(${s1 * 0.85}) rotate(-8deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy - 14}px) scale(${s1 * 1.08}) rotate(3deg)`, offset: 0.78 },
      { transform: `translate(${dx}px, ${dy + 4}px) scale(${s1 * 0.98}) rotate(-1deg)`, offset: 0.9 },
      { transform: centre },
    ], { duration: 820, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'forwards' });
    setTimeout(() => {
      confetti(innerWidth / 2, innerHeight * 0.32, { side: cheer.milestone, gold: cheer.milestone });
      const shine = document.createElement('i');
      shine.className = 'shine';
      flyer.append(shine);
      shine.animate([{ transform: 'translateX(-130%)' }, { transform: 'translateX(130%)' }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
    }, 380);
  }
  setTimeout(() => celebrateText.classList.add('show'), reduced() ? 0 : 520);
  haptic(cheer.milestone ? [30, 60, 30, 60, 120] : [25, 50, 60]);

  // Stay until she taps (or presses Enter or Space). Taps in the first moment are ignored,
  // so the tap that added the book can't skip its own celebration.
  await wait(700);
  const at = await new Promise((resolve) => {
    const stop = new AbortController();
    const done = (x, y) => { stop.abort(); resolve({ x, y }); };
    dlg.addEventListener('click', (e) => done(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2), { signal: stop.signal });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(innerWidth / 2, innerHeight / 2); }
    }, { signal: stop.signal });
  });
  // The same ripple as the start-up screen, spreading from her finger as the library returns.
  ripple(dlg, at.x, at.y);
  if (navigator.vibrate) navigator.vibrate(10);
  celebrateText.classList.remove('show');
  await wait(reduced() ? 0 : 320);
  return centre;
}

async function addToLibrary() {
  const f = found; // close() clears `found`; keep our own reference for the whole add
  adding = true;
  els.secondary.disabled = true;
  if (f.picker) f.picker.stop();
  let flyer = null;
  try {
    // Give the cover search a moment to finish so the shelf gets the real picture.
    await Promise.race([f.coverReady, wait(4000)]);
    const data = { ...f.book, cover: f.usingPhoto ? f.photo : f.book.cover };
    const saved = await ctx.saveBook(data);

    const source = els.rCover.querySelector('.cover');
    const from = source.getBoundingClientRect();
    // A copy of the cover does the celebrating, then travels to its place on the shelf.
    flyer = source.cloneNode(true);
    flyer.classList.add('flying');
    Object.assign(flyer.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    dlg.append(flyer);
    source.style.visibility = 'hidden';
    closeSheets();

    const centre = await celebrate(flyer, from, saved);

    const tile = ctx.placeIncoming(saved.id);
    dlg.classList.remove('celebrating');
    dlg.classList.add('settling');
    if (tile) {
      const to = tile.querySelector('.cover').getBoundingClientRect();
      const sx = to.width / from.width;
      const sy = to.height / from.height;
      const dx = to.left - from.left;
      const dy = to.top - from.top;
      // Swoop down to the shelf and land with one small give, like a book set down.
      await move(flyer, [
        { transform: centre, offset: 0 },
        { transform: `translate(${dx}px, ${dy + 3}px) scale(${sx * 1.02}, ${sy * 0.97})`, offset: 0.82 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, offset: 1 },
      ], { duration: 620, easing: 'cubic-bezier(.5,0,.3,1)' });
      ctx.landed(tile);
    }
    haptic(18);
    await wait(reduced() ? 0 : 500); // let the ripple finish spreading over the library
  } catch (err) {
    console.warn('Adding the book failed', err);
    ctx.toast('That didn’t save. Try adding it again.');
  } finally {
    adding = false;
    if (flyer) flyer.remove();
    close();
  }
}

// ---------- Open / close ----------

/** Open the scanner. Pass onPhoto to just take a photo of a cover (e.g. replacing one). */
export async function open(opts = {}) {
  const s = ++session;
  sound.unlock(); // still inside the tap that opened the scanner, so the chime is allowed later
  found = null;
  onPhoto = opts.onPhoto || null;
  closeSheets();
  setStatus('');
  dlg.classList.remove('settling', 'celebrating');
  dlg.showModal();
  try {
    await scanner.startCamera(els.video);
    if (s !== session) { scanner.stopCamera(els.video); return; } // closed before the camera came on
    setMode(onPhoto ? 'photo' : scanMode);
  } catch (err) {
    if (s !== session) return;
    setMode(onPhoto ? 'photo' : scanMode);
    setStatus(err.name === 'NotAllowedError'
      ? 'Camera access is off for this site. Turn it on in your browser settings, or use a photo instead.'
      : 'There’s no camera available here. You can use a photo or search by title instead.');
  }
}

export function close() {
  session++;
  scanner.stopCamera(els.video);
  if (found && found.picker) found.picker.stop();
  found = null;
  onPhoto = null;
  busy = false;
  closeSheets();
  if (dlg.open) dlg.close();
  dlg.classList.remove('settling', 'celebrating');
}

export function init(hooks) { ctx = hooks; }

// Games: Spin the wheel (picks her next read) and Book shower (every cover tumbles down the screen).
import { coverEl } from './covers.js';
import * as sound from './sound.js';

const $ = (sel) => document.querySelector(sel);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const haptic = (p) => { if (navigator.vibrate) navigator.vibrate(p); };

let hooks; // { books: () => [...], openDetail(id), toast(msg) }

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Spin the wheel ----------

const spin = {
  dlg: $('#spinner'),
  canvas: $('#wheel'),
  intro: $('#spinIntro'),
  stage: $('.wheel-stage'),
  wrap: $('.wheel-wrap'),
  now: $('#wheelNow'),
  btn: $('#spinBtn'),
  pick: $('#spinPick'),
  pickBook: $('#pickBook'),
  again: $('#spinAgain'),
};
let wheel = { books: [], rot: 0, token: 0, chosen: null };

/** Unread = marked To be read, or never given a status. */
export const unread = (list) => list.filter((b) => b.status === 'want' || !b.status);

// Slice colours: the washes and the placeholder cover tones, all pale enough for ink labels.
const SLICE_TONES = ['--wash-sky', '--wash-pink', '--wash-apricot', '--cover-sage', '--cover-periwinkle', '--wash-coral', '--cover-lilac', '--cover-cream'];

function drawWheel() {
  const { canvas } = spin;
  const size = canvas.clientWidth;
  if (!size) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (canvas.width !== Math.round(size * dpr)) { canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr); }
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const tones = SLICE_TONES.map((t) => css.getPropertyValue(t).trim());
  const ink = css.getPropertyValue('--ink').trim();
  const white = css.getPropertyValue('--white').trim();
  const n = wheel.books.length;
  const r = size / 2;
  const seg = TAU / n;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(wheel.rot);
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * seg;
    // Never put the same tone side by side, including where the circle closes.
    let tone = tones[i % tones.length];
    if (i === n - 1 && n > 1 && i % tones.length === 0) tone = tones[1];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r - 3, a0, a0 + seg);
    ctx.closePath();
    ctx.fillStyle = tone;
    ctx.fill();
    if (n > 1) { ctx.strokeStyle = white; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  // Titles along each slice, while there are few enough slices to read them.
  if (n <= 24) {
    const fontSize = n <= 10 ? 13 : 11;
    ctx.font = `700 ${fontSize}px "Nunito Sans", system-ui, sans-serif`;
    ctx.fillStyle = ink;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const room = r - 3 - 30 - 14; // from the hub's edge to the rim, with a little padding
    for (let i = 0; i < n; i++) {
      let label = wheel.books[i].title;
      if (ctx.measureText(label).width > room) {
        while (label.length > 1 && ctx.measureText(`${label}…`).width > room) label = label.slice(0, -1);
        label = `${label.trimEnd()}…`;
      }
      ctx.save();
      ctx.rotate(-Math.PI / 2 + (i + 0.5) * seg);
      ctx.fillText(label, r - 14, 0);
      ctx.restore();
    }
  }
  ctx.restore();
  // White rim
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, TAU);
  ctx.strokeStyle = white;
  ctx.lineWidth = 4;
  ctx.stroke();
}

/** The slice under the pointer at the top. */
const underPointer = () => Math.floor(mod(-wheel.rot, TAU) / (TAU / wheel.books.length)) % wheel.books.length;

function showNow() {
  const b = wheel.books[underPointer()];
  spin.now.textContent = b ? b.title : '';
}

export function openSpinner() {
  wheel = { books: shuffle(unread(hooks.books())), rot: Math.random() * TAU, token: wheel.token + 1, chosen: null };
  const n = wheel.books.length;
  spin.intro.textContent = n
    ? `${n} ${n === 1 ? 'book' : 'books'} you haven’t read yet ${n === 1 ? 'is' : 'are'} on the wheel.`
    : 'Nothing to spin yet. Books marked To be read, or with no status, go on the wheel.';
  spin.stage.hidden = false;
  spin.wrap.hidden = !n;
  spin.btn.hidden = !n;
  spin.now.hidden = !n;
  spin.btn.disabled = false;
  spin.pick.hidden = true;
  spin.pick.classList.remove('show');
  spin.dlg.showModal();
  spin.dlg.querySelector('.detail-scroll').scrollTop = 0;
  if (n) { drawWheel(); showNow(); }
}

function spinWheel() {
  const n = wheel.books.length;
  if (!n) return;
  sound.unlock(); // inside her tap, so the ticks and chime are allowed
  const token = ++wheel.token;
  spin.btn.disabled = true;
  spin.pick.hidden = true;
  spin.pick.classList.remove('show');
  spin.stage.hidden = false;
  const seg = TAU / n;
  const k = Math.floor(Math.random() * n);
  const jitter = (Math.random() - 0.5) * 0.7; // land somewhere inside the slice, not always dead centre
  const start = wheel.rot;
  const delta = mod(-(k + 0.5 + jitter) * seg - start, TAU);
  const end = start + (reduced() ? 0 : (5 + Math.floor(Math.random() * 2)) * TAU) + delta;
  const duration = reduced() ? 0 : 4600 + Math.random() * 800;
  const t0 = performance.now();
  let last = underPointer();
  let lastTick = 0;
  const frame = (now) => {
    if (token !== wheel.token || !spin.dlg.open) return;
    const t = duration ? Math.min(1, (now - t0) / duration) : 1;
    wheel.rot = start + (end - start) * (1 - (1 - t) ** 4);
    drawWheel();
    const i = underPointer();
    if (i !== last) {
      last = i;
      showNow();
      if (now - lastTick > 35) { sound.tick(); lastTick = now; }
    }
    if (t < 1) requestAnimationFrame(frame);
    else setTimeout(() => { if (token === wheel.token && spin.dlg.open) reveal(wheel.books[underPointer()]); }, reduced() ? 150 : 450);
  };
  requestAnimationFrame(frame);
}

/** Show the chosen book the way a scanned one appears: the cover springs in, with its title. */
function reveal(book) {
  wheel.chosen = book;
  sound.playScan();
  haptic([25, 50, 60]);
  const cover = coverEl(book);
  const shine = document.createElement('span');
  shine.className = 'shine';
  cover.append(shine); // inside the cover, which clips it to the cover's shape
  spin.pickBook.querySelector('.pick-cover').replaceChildren(cover);
  spin.pickBook.querySelector('.pick-title').textContent = book.title;
  spin.pickBook.querySelector('.pick-author').textContent = (book.authors || []).join(', ');
  spin.pickBook.setAttribute('aria-label', `${book.title}. Open this book`);
  spin.stage.hidden = true;
  spin.pick.hidden = false;
  void spin.pick.offsetWidth; // restart the spring-in animation
  spin.pick.classList.add('show');
  spin.btn.disabled = false;
  spin.dlg.querySelector('.detail-scroll').scrollTop = 0;
  spin.pickBook.focus({ preventScroll: true });
}

spin.btn.addEventListener('click', spinWheel);
spin.again.addEventListener('click', () => {
  spin.pick.hidden = true;
  spin.stage.hidden = false;
  drawWheel();
  spinWheel();
});
spin.pickBook.addEventListener('click', () => {
  if (!wheel.chosen) return;
  const id = wheel.chosen.id;
  spin.dlg.close();
  hooks.openDetail(id);
});
spin.dlg.querySelector('[data-close]').addEventListener('click', () => spin.dlg.close());
spin.dlg.addEventListener('close', () => { wheel.token++; });
window.addEventListener('resize', () => { if (spin.dlg.open && !spin.stage.hidden) drawWheel(); });

// ---------- Book shower ----------

const shower = $('#shower');
let rain = null; // the running shower, if any

function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/matter/matter.min.js';
    s.onload = () => (window.Matter ? resolve(window.Matter) : reject(new Error('no Matter')));
    s.onerror = reject;
    document.head.append(s);
  });
}

function stopShower() {
  if (!rain) return;
  const r = rain;
  rain = null;
  r.stopped = true;
  shower.classList.add('fading');
  setTimeout(() => {
    if (rain) return; // a new shower started meanwhile
    shower.hidden = true;
    shower.classList.remove('fading');
    shower.replaceChildren();
  }, 500);
}

/** Reduce Motion: no tumbling. The covers fade in where they would land, then fade away. */
function quietShower(list) {
  const r = { stopped: false };
  rain = r;
  const W = innerWidth;
  const H = innerHeight;
  const w = 64;
  list.slice(0, 40).forEach((b) => {
    const el = coverEl(b);
    el.style.width = `${w}px`;
    el.style.transform = `translate(${Math.random() * (W - w)}px, ${H * 0.25 + Math.random() * (H * 0.6)}px)`;
    shower.append(el);
  });
  setTimeout(() => { if (rain === r) stopShower(); }, 3200);
}

export async function startShower() {
  const list = shuffle(hooks.books());
  if (!list.length) { hooks.toast('Add a book first, then make it rain'); return; }
  if (rain) return;
  shower.replaceChildren();
  shower.classList.remove('fading');
  shower.hidden = false;
  const hint = document.createElement('p');
  hint.className = 'toast show shower-hint';
  hint.textContent = 'Tap to stop';
  if (reduced()) { quietShower(list); shower.append(hint); return; }

  let Matter;
  const r = { stopped: false };
  rain = r;
  try {
    Matter = await loadMatter();
  } catch {
    shower.hidden = true;
    rain = null;
    hooks.toast('Book shower needs to load once with a connection');
    return;
  }
  if (r.stopped) return;
  shower.append(hint);
  setTimeout(() => hint.remove(), 2500);

  const { Engine, Bodies, Composite, Body } = Matter;
  const W = innerWidth;
  const H = innerHeight;
  const engine = Engine.create();
  engine.gravity.y = 1.1;
  const wall = 200;
  Composite.add(engine.world, [
    Bodies.rectangle(W / 2, H + wall / 2, W * 3, wall, { isStatic: true }), // floor
    Bodies.rectangle(-wall / 2, H / 2 - H, wall, H * 4, { isStatic: true }),
    Bodies.rectangle(W + wall / 2, H / 2 - H, wall, H * 4, { isStatic: true }),
  ]);

  // Size covers so the pile on screen at any moment stays well under the screen's area.
  const live = Math.min(list.length, 28);
  const w = Math.round(Math.max(48, Math.min(96, Math.sqrt((0.45 * W * H) / (1.5 * live)))));
  const h = Math.round(w * 1.5);
  const every = Math.max(70, Math.min(180, 2600 / list.length)); // ms between covers
  const stay = 4200; // how long a cover rests on the pile before dropping away
  const falling = [];
  let next = 0;
  let lastSpawn = -Infinity;
  let lastTime = performance.now();

  const spawn = (book, now) => {
    const el = coverEl(book);
    el.style.width = `${w}px`;
    shower.append(el);
    const body = Bodies.rectangle(w / 2 + Math.random() * (W - w), -h - Math.random() * 120, w, h, {
      angle: (Math.random() - 0.5) * 1.2,
      restitution: 0.35,
      friction: 0.35,
      frictionAir: 0.008 + Math.random() * 0.01,
      density: 0.0012,
      chamfer: { radius: 4 },
    });
    Body.setVelocity(body, { x: (Math.random() - 0.5) * 6, y: Math.random() * 4 });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
    Composite.add(engine.world, body);
    falling.push({ body, el, born: now, dropped: false });
  };

  const frame = (now) => {
    if (r.stopped || rain !== r) return;
    const dt = Math.min(32, now - lastTime);
    lastTime = now;
    if (next < list.length && now - lastSpawn >= every) {
      spawn(list[next++], now);
      lastSpawn = now;
    }
    Engine.update(engine, dt);
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      // After a rest on the pile, a cover stops colliding and falls on down off the screen.
      if (!f.dropped && now - f.born > stay + (i % 5) * 300) {
        f.dropped = true;
        f.body.collisionFilter.mask = 0;
        Body.setAngularVelocity(f.body, (Math.random() - 0.5) * 0.2);
      }
      const { x, y } = f.body.position;
      if (y - h > H + 40) {
        Composite.remove(engine.world, f.body);
        f.el.remove();
        falling.splice(i, 1);
        continue;
      }
      f.el.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${f.body.angle}rad)`;
    }
    if (next >= list.length && !falling.length) { stopShower(); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

shower.addEventListener('click', stopShower);
shower.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') stopShower(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && rain) stopShower(); });

export function init(h) {
  hooks = h;
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-game]');
    if (!g) return;
    if (g.dataset.game === 'spinner') openSpinner();
    if (g.dataset.game === 'shower') startShower();
  });
}

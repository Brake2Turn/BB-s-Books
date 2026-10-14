// The "you found a book!" moment: whizz in, flip to reveal the cover, then plop onto the shelf.
const dlg = document.querySelector('#reveal');
const bg = dlg.querySelector('.reveal-bg');
const bookEl = dlg.querySelector('.reveal-book');
const inner = dlg.querySelector('.flip-inner');
const front = dlg.querySelector('.flip-front');
const burst = dlg.querySelector('.burst');
const info = dlg.querySelector('.reveal-info');
const titleEl = dlg.querySelector('.reveal-title');
const authorEl = dlg.querySelector('.reveal-author');
const blurbEl = dlg.querySelector('.reveal-blurb');
const noteEl = dlg.querySelector('.reveal-note');
const primary = dlg.querySelector('[data-choice="primary"]');
const secondary = dlg.querySelector('[data-choice="secondary"]');

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function anim(el, keyframes, opts) {
  const a = el.animate(keyframes, { fill: 'forwards', ...opts, duration: reduced() ? 1 : opts.duration });
  return a.finished.catch(() => {});
}

function waitForImage(root, ms = 3000) {
  const img = root.querySelector('img');
  if (!img || (img.complete && img.naturalWidth)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, ms);
  });
}

function starBurst() {
  if (reduced()) return;
  const colours = ['#f5c542', '#ff8a65', '#fff3c4', '#e0a526', '#ffd1dc'];
  burst.replaceChildren();
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span');
    s.textContent = i % 3 ? '✦' : '★';
    s.style.color = colours[i % colours.length];
    burst.append(s);
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 140 + Math.random() * 90;
    s.animate([
      { transform: 'translate(-50%, -50%) scale(.2)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(${0.8 + Math.random() * 0.8}) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'forwards' });
  }
}

function setInfo(book, duplicate) {
  titleEl.textContent = book.title;
  authorEl.textContent = (book.authors || []).join(', ') || 'Unknown author';
  blurbEl.textContent = book.blurb || '';
  blurbEl.hidden = !book.blurb;
  noteEl.hidden = !duplicate;
  primary.textContent = duplicate ? 'Open it' : 'Add to my library';
  secondary.textContent = duplicate ? 'Close' : 'Not this one';
}

let choose = null;
primary.addEventListener('click', () => choose && choose('primary'));
secondary.addEventListener('click', () => choose && choose('secondary'));
dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (choose) choose('secondary'); });

/**
 * Show a found book. Resolves with 'primary' (add / open) or 'secondary' (skip / close).
 * The dialog stays open so the caller can follow up with plopInto() or dismiss().
 */
export async function show(book, coverNode, { duplicate = false } = {}) {
  setInfo(book, duplicate);
  front.replaceChildren(coverNode);
  dlg.classList.remove('show-info');
  [bg, bookEl, inner, info].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
  primary.disabled = secondary.disabled = true;
  dlg.showModal();

  anim(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  const loaded = waitForImage(coverNode);

  // Whizz in from off-screen, spinning, and wobble to a stop.
  await anim(bookEl, [
    { transform: 'translate(-120vw, 40vh) rotate(-600deg) scale(.3)', filter: 'blur(6px)', offset: 0 },
    { transform: 'translate(10vw, -6vh) rotate(18deg) scale(1.08)', filter: 'blur(0)', offset: 0.62 },
    { transform: 'translate(-4vw, 1vh) rotate(-8deg) scale(.97)', offset: 0.8 },
    { transform: 'translate(1vw, 0) rotate(3deg) scale(1.01)', offset: 0.92 },
    { transform: 'none', offset: 1 },
  ], { duration: 1000, easing: 'cubic-bezier(.25,.8,.35,1)' });

  await loaded;
  // Little anticipation shake, then flip over to reveal the cover.
  await anim(bookEl, [
    { transform: 'none' }, { transform: 'rotate(-3deg) scale(1.02)' }, { transform: 'rotate(3deg) scale(1.02)' },
    { transform: 'rotate(-2deg)' }, { transform: 'none' },
  ], { duration: 380, easing: 'ease-in-out' });
  setTimeout(starBurst, reduced() ? 0 : 280);
  await anim(inner, [
    { transform: 'rotateY(0) scale(1)' },
    { transform: 'rotateY(90deg) scale(1.15)', offset: 0.45 },
    { transform: 'rotateY(180deg) scale(1)' },
  ], { duration: 750, easing: 'cubic-bezier(.4,0,.2,1.2)' });

  dlg.classList.add('show-info');
  primary.disabled = secondary.disabled = false;
  primary.focus({ preventScroll: true });

  const choice = await new Promise((resolve) => { choose = resolve; });
  choose = null;
  primary.disabled = secondary.disabled = true;
  return choice;
}

/** Fling the book away and close. */
export async function dismiss() {
  dlg.classList.remove('show-info');
  anim(bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
  await anim(bookEl, [
    { transform: 'none' },
    { transform: 'translate(-3vw, -2vh) rotate(-6deg)', offset: 0.2 },
    { transform: 'translate(130vw, -20vh) rotate(160deg) scale(.6)' },
  ], { duration: 550, easing: 'cubic-bezier(.5,0,.75,0)' });
  dlg.close();
}

/** Close without any flourish (e.g. before opening the book page). */
export function close() {
  if (dlg.open) dlg.close();
}

/** Drop the book from the middle of the screen into its spot on the shelf. */
export async function plopInto(target) {
  dlg.classList.remove('show-info');
  const from = bookEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const s = to.width / from.width;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const squash = (from.height * s * 0.09).toFixed(1);

  anim(bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 650, delay: 200 });
  await anim(bookEl, [
    { transform: 'none', offset: 0 },
    { transform: 'translate(0, -40px) rotate(-5deg) scale(1.06)', offset: 0.22, easing: 'cubic-bezier(.5,0,.9,.6)' },
    { transform: `translate(${dx}px, ${dy}px) rotate(4deg) scale(${s})`, offset: 0.72 },
    { transform: `translate(${dx}px, ${dy}px) translateY(${squash}px) scale(${s * 1.18}, ${s * 0.8})`, offset: 0.8 },
    { transform: `translate(${dx}px, ${dy}px) translateY(-${squash}px) scale(${s * 0.94}, ${s * 1.07})`, offset: 0.9 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s})`, offset: 1 },
  ], { duration: 1050, easing: 'ease-out' });
  dlg.close();
}

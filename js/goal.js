// Reading goal: a few questions, one at a time, then one goal at a time on Home.
// The goal lives in the settings store ('goal' in meta): { start, end, target, audio, setAt }.
// A book counts once she marks it Finished between the goal's start and end (book.finishedAt).
import * as db from './db.js';

const $ = (sel) => document.querySelector(sel);
const DAY = 86400000;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n) => n.toLocaleString('en-GB');
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const dayLabel = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const endOfDay = (t) => { const d = new Date(t); d.setHours(23, 59, 59, 999); return d.getTime(); };

let hooks; // { books: () => [...], toast(msg), changed() }
let goal = null;

const els = {
  dlg: $('#goalDlg'),
  body: $('#goalBody'),
  dots: $('#goalDots'),
  back: $('#goalBack'),
  next: $('#goalNext'),
};

// ---------- The goal itself ----------

export const current = () => goal;

export async function load() {
  goal = await db.getMeta('goal', null).catch(() => null);
  return goal;
}

/** Books finished inside the goal's window (audiobooks only if the goal counts them). */
export function progress(g = goal, books = hooks.books(), now = Date.now()) {
  if (!g) return null;
  const done = books.filter((b) => b.status === 'read' && b.finishedAt >= g.start && b.finishedAt <= g.end && (g.audio || b.format !== 'audio')).length;
  const span = Math.max(1, g.end - g.start);
  const expected = g.target * Math.min(1, Math.max(0, (now - g.start) / span));
  const daysLeft = Math.max(0, Math.ceil((g.end - now) / DAY));
  const pct = Math.min(100, Math.round((done / g.target) * 100));
  let caption;
  if (done >= g.target) caption = 'Goal reached';
  else if (now > g.end) caption = `Ended ${dayLabel(g.end)}`;
  else {
    const pace = done - expected >= 1 ? 'Ahead of pace' : expected - done >= 1 ? 'A little behind' : 'On track';
    caption = `${pace} · ${daysLeft <= 1 ? 'last day' : `${fmt(daysLeft)} days left`}`;
  }
  return { done, pct, caption, ended: now > g.end };
}

/** "12 books by 31 December" */
export const goalLine = (g) => `${fmt(g.target)} ${plural(g.target, 'book')} by ${dayLabel(g.end)}`;

// ---------- The questions ----------

const FRAMES = [
  ['month', 'This month', () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime(); }],
  ['quarter', 'The next three months', () => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d.getTime(); }],
  ['year', 'This year', () => new Date(new Date().getFullYear(), 11, 31).getTime()],
  ['custom', 'Pick an end date', null],
];

let draft; // answers so far
let step;  // index into STEPS

/** Books she finished in the last 90 days, scaled to the chosen window: a gentle suggestion. */
function suggestion(end) {
  const days = Math.max(1, Math.round((end - Date.now()) / DAY));
  const recent = hooks.books().filter((b) => b.status === 'read' && b.finishedAt > Date.now() - 90 * DAY).length;
  if (recent) return { n: Math.max(1, Math.round((recent / 90) * days)), fromPace: true };
  return { n: Math.max(1, Math.round(days / 14)), fromPace: false }; // about one a fortnight
}

function choice(label, sub, selected, onPick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'goal-choice';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', String(selected));
  b.innerHTML = '<span class="goal-choice-label"></span><span class="caption"></span>';
  b.firstChild.textContent = label;
  b.lastChild.textContent = sub;
  b.addEventListener('click', onPick);
  return b;
}

function question(text, hint) {
  const frag = document.createDocumentFragment();
  const h = document.createElement('h3');
  h.className = 'goal-question';
  h.id = 'goalQuestion';
  h.textContent = text;
  frag.append(h);
  if (hint) {
    const p = document.createElement('p');
    p.className = 'body-text goal-hint';
    p.textContent = hint;
    frag.append(p);
  }
  return frag;
}

const STEPS = [
  {
    // 1. Time frame
    render() {
      const list = document.createElement('div');
      list.className = 'goal-choices';
      list.setAttribute('role', 'radiogroup');
      list.setAttribute('aria-labelledby', 'goalQuestion');
      FRAMES.forEach(([key, label, end]) => {
        const sub = end ? `Until ${dayLabel(end())}` : 'Choose the day it ends';
        list.append(choice(label, sub, draft.frame === key, () => {
          draft.frame = key;
          if (end) draft.end = endOfDay(end());
          else if (!draft.custom) draft.end = 0;
          else draft.end = draft.custom;
          draft.target = 0; // re-suggest for the new window
          draw();
        }));
      });
      const out = [question('What’s your time frame?', 'Your goal runs from today until the day you choose.'), list];
      if (draft.frame === 'custom') {
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'glass-input goal-date';
        input.setAttribute('aria-label', 'End date');
        input.min = new Date(Date.now() + DAY).toISOString().slice(0, 10);
        if (draft.custom) input.value = new Date(draft.custom).toISOString().slice(0, 10);
        input.addEventListener('change', () => {
          const t = input.value ? endOfDay(new Date(`${input.value}T12:00:00`).getTime()) : 0;
          draft.custom = t > Date.now() ? t : 0;
          draft.end = draft.custom;
          draft.target = 0;
          updateNav();
        });
        out.push(input);
      }
      return out;
    },
    ready: () => draft.end > Date.now(),
  },
  {
    // 2. How many books
    render() {
      const s = suggestion(draft.end);
      if (!draft.target) draft.target = s.n;
      const wrap = document.createElement('div');
      wrap.className = 'goal-stepper';
      const minus = document.createElement('button');
      const plus = document.createElement('button');
      const value = document.createElement('output');
      minus.type = plus.type = 'button';
      minus.className = plus.className = 'round-btn goal-step';
      minus.setAttribute('aria-label', 'One fewer');
      plus.setAttribute('aria-label', 'One more');
      minus.textContent = '−';
      plus.textContent = '+';
      value.className = 'goal-number';
      value.setAttribute('aria-live', 'polite');
      const show = () => {
        value.textContent = fmt(draft.target);
        minus.disabled = draft.target <= 1;
      };
      minus.addEventListener('click', () => { draft.target = Math.max(1, draft.target - 1); show(); });
      plus.addEventListener('click', () => { draft.target = Math.min(999, draft.target + 1); show(); });
      show();
      const unit = document.createElement('p');
      unit.className = 'goal-unit';
      unit.textContent = 'books';
      wrap.append(minus, value, plus);
      const hint = s.fromPace
        ? `At your recent pace, that’s about ${fmt(s.n)}.`
        : 'Pick a number that feels exciting but doable.';
      return [question('How many books do you want to read?', hint), wrap, unit];
    },
    ready: () => draft.target >= 1,
  },
  {
    // 3. Audiobooks
    render() {
      const list = document.createElement('div');
      list.className = 'goal-choices';
      list.setAttribute('role', 'radiogroup');
      list.setAttribute('aria-labelledby', 'goalQuestion');
      list.append(
        choice('Yes, count them', 'Books you listen to count too', draft.audio === true, () => { draft.audio = true; draw(); }),
        choice('Only books I read', 'Audiobooks don’t count', draft.audio === false, () => { draft.audio = false; draw(); }),
      );
      return [question('Do audiobooks count?'), list];
    },
    ready: () => draft.audio !== null,
  },
  {
    // 4. Check and set
    render() {
      const line = document.createElement('p');
      line.className = 'goal-summary';
      line.textContent = goalLine({ target: draft.target, end: draft.end });
      const what = document.createElement('p');
      what.className = 'body-text goal-hint';
      what.textContent = `${draft.audio ? 'Audiobooks count. ' : 'Audiobooks don’t count. '}Books you mark Finished from today count towards it.`;
      const out = [question('Your goal'), line, what];
      if (goal) {
        const note = document.createElement('p');
        note.className = 'caption';
        note.textContent = 'This replaces your current goal.';
        out.push(note);
      }
      return out;
    },
    ready: () => true,
  },
];

/** The first screen when a goal is already set: how it's going, and change or remove it. */
function overview() {
  const p = progress();
  const line = document.createElement('p');
  line.className = 'goal-summary';
  line.textContent = goalLine(goal);
  const track = document.createElement('span');
  track.className = 'track';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', String(p.pct));
  track.style.setProperty('--progress', `${p.pct}%`);
  track.innerHTML = '<i></i>';
  const cap = document.createElement('p');
  cap.className = 'caption';
  cap.textContent = `${fmt(p.done)} of ${fmt(goal.target)} · ${p.caption}`;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'text-btn goal-remove';
  remove.textContent = 'Remove goal';
  remove.addEventListener('click', async () => {
    if (!confirm('Remove your reading goal? Your books stay exactly as they are.')) return;
    goal = null;
    await db.setMeta('goal', null);
    hooks.changed();
    els.dlg.close();
    hooks.toast('Goal removed');
  });
  return [question('Your reading goal'), line, track, cap, remove];
}

function updateNav() {
  const s = STEPS[step];
  els.back.hidden = step < 0 || (step === 0 && !goal);
  els.next.disabled = !!s && !s.ready();
  els.next.querySelector('span').textContent = step < 0 ? 'Set a new goal' : step === STEPS.length - 1 ? 'Set goal' : 'Next';
  els.next.classList.toggle('has-arrow', step >= 0 && step < STEPS.length - 1);
  // One dot per question, the current one filled.
  els.dots.hidden = step < 0;
  els.dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i <= step));
}

function draw(animate = false) {
  const parts = step < 0 ? overview() : STEPS[step].render();
  els.body.replaceChildren(...parts);
  updateNav();
  if (animate && !reduced()) els.body.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,.8,.3,1)' });
  else if (animate) els.body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
}

function go(to) {
  step = to;
  draw(true);
  els.dlg.querySelector('.detail-scroll').scrollTop = 0;
  const q = els.body.querySelector('.goal-question');
  if (q) { q.tabIndex = -1; q.focus({ preventScroll: true }); }
}

async function finish() {
  goal = { start: startOfDay(Date.now()), end: draft.end, target: draft.target, audio: draft.audio, setAt: Date.now() };
  await db.setMeta('goal', goal);
  hooks.changed();
  els.dlg.close();
  hooks.toast('Goal set');
}

export function open() {
  draft = { frame: '', end: 0, custom: 0, target: 0, audio: null };
  step = goal ? -1 : 0;
  els.dlg.showModal();
  go(step);
}

els.next.addEventListener('click', () => {
  if (step < 0) return go(0);
  if (!STEPS[step].ready()) return;
  if (step === STEPS.length - 1) return finish();
  go(step + 1);
});
els.back.addEventListener('click', () => go(step === 0 ? -1 : step - 1));
els.dlg.querySelector('[data-close]').addEventListener('click', () => els.dlg.close());

export function init(h) { hooks = h; }

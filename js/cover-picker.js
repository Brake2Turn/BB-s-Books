// A row of possible covers for a book: her edition first, then other editions, then her own photo.
import { coverOptions } from './lookup.js';
import { probe } from './covers.js';
import { icon } from './icons.js';

/**
 * Render a cover picker into `host`.
 *   book       the book (title, authors, isbn, coverCandidates, workKey)
 *   selected   () => the cover URL currently chosen ('' for none)
 *   photo      () => her photo of the cover, if she has taken one ('' otherwise)
 *   onPick     (url, { upgrade }) => called with the chosen cover's URL (her photo's data URL included).
 *              It's called at once with the small version, so the cover changes straight away, then
 *              again with { upgrade: true } once the large version has loaded.
 *   onTakePhoto () => called when she taps "Take a photo"
 * Returns { refresh } to redraw the selection after something outside changes it.
 */
export function coverPicker(host, book, { selected, photo, onPick, onTakePhoto }) {
  let options = null; // null while loading
  let token = {};
  host.dataset.state = 'loading';

  const tile = (thumb, url, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cover-option';
    b.setAttribute('aria-label', label);
    b.dataset.full = url;
    b.dataset.thumb = thumb;
    b.setAttribute('aria-pressed', String(url === selected()));
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.src = thumb;
    b.append(img);
    b.addEventListener('click', async () => {
      // Change the cover straight away with the small version (already on screen), then swap in
      // the large one if it loads. The row is only re-marked, never redrawn, so it doesn't scroll.
      const instant = url.startsWith('data:') ? url : thumb;
      onPick(instant, { upgrade: false });
      mark();
      if (instant === url) return;
      if (!(await probe(url, 6000))) return;
      if (selected() !== instant) return; // she has picked something else since
      onPick(url, { upgrade: true });
      mark();
    });
    return b;
  };

  /** Show which tile is chosen, in place. */
  function mark() {
    const current = selected();
    host.querySelectorAll('.cover-option[data-full]').forEach((t) => {
      t.setAttribute('aria-pressed', String(!!current && (t.dataset.full === current || t.dataset.thumb === current)));
    });
  }

  function draw() {
    const scrolled = host.querySelector('.cover-row')?.scrollLeft || 0;
    const row = document.createElement('div');
    row.className = 'cover-row';
    const current = selected();
    const items = [];
    if (options === null) {
      for (let i = 0; i < 4; i++) {
        const s = document.createElement('span');
        s.className = 'cover-option skeleton';
        s.setAttribute('aria-hidden', 'true');
        items.push(s);
      }
    } else {
      // Keep the current choice visible even if it isn't among the options found.
      const listed = options.some((o) => o.full === current || o.thumb === current);
      if (current && !listed && !current.startsWith('data:')) items.push(tile(current, current, 'Current cover'));
      options.forEach((o, i) => items.push(tile(o.thumb, o.full, i === 0 && book.isbn ? 'Cover of this edition' : `Cover option ${i + 1}`)));
    }
    const shot = photo();
    if (shot) items.push(tile(shot, shot, 'My photo of the cover'));
    const take = document.createElement('button');
    take.type = 'button';
    take.className = 'cover-option take-photo';
    take.innerHTML = `${icon('camera')}<span>${shot ? 'Retake' : 'Take a photo'}</span>`;
    take.addEventListener('click', onTakePhoto);
    items.push(take);
    row.append(...items);

    const note = document.createElement('p');
    note.className = 'caption cover-note';
    note.textContent = options === null ? 'Finding covers…'
      : options.length ? `${options.length} ${options.length === 1 ? 'cover' : 'covers'} found. Tap one to use it.`
        : 'No other covers found. A photo of your copy always works.';
    host.replaceChildren(row, note);
    row.scrollLeft = scrolled; // a redraw (covers found, a new photo) keeps her place in the row
    mark();
    host.dataset.state = options === null ? 'loading' : 'ready';
  }

  async function load() {
    const mine = (token = {});
    draw();
    try {
      const found = await coverOptions(book);
      if (mine !== token) return;
      options = found;
    } catch {
      if (mine !== token) return;
      options = [];
    }
    draw();
  }

  load();
  return {
    refresh: draw,
    stop: () => { token = {}; },
  };
}

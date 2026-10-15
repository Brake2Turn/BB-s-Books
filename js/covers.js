// Finding the cover for the exact edition scanned, and drawing cover tiles.

/** ISBN-10 for a 978- ISBN-13 (Amazon's image store is keyed on it). */
export function isbn13to10(isbn) {
  if (!/^978\d{10}$/.test(isbn)) return '';
  const core = isbn.slice(3, 12);
  const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

/**
 * Cover URLs to try, most edition-specific first. Every source here is keyed on the
 * ISBN printed on her copy, so the picture matches the edition she owns.
 */
export function editionCoverUrls(isbn) {
  if (!isbn) return [];
  const urls = [];
  const isbn10 = isbn13to10(isbn) || (isbn.length === 10 ? isbn : '');
  if (isbn10) urls.push(`https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`);
  urls.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);
  return urls;
}

/** Load an image and report its size; null if it fails or is a 1x1 "no cover" stand-in. */
export function probe(url, ms = 6000) {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; resolve(null); }, ms);
    img.onload = () => {
      clearTimeout(t);
      const ok = img.naturalWidth >= 40 && img.naturalHeight >= 40;
      resolve(ok ? { url, w: img.naturalWidth, h: img.naturalHeight } : null);
    };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}

/** Try every candidate at once, then take the best-ranked one that loaded. */
export async function firstWorking(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  const results = await Promise.all(unique.map((u) => probe(u)));
  return results.find(Boolean) || null;
}

// ---------- Elements ----------

// The style guide's six placeholder pairs (cover-sage … cover-lilac in styles.css).
const PLACEHOLDERS = ['sage', 'periwinkle', 'cream', 'mist', 'peach', 'lilac'];

function hash(s) {
  return [...(s || '')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

/** Same book, same placeholder, every time: keyed on its ID (or ISBN/title before it has one). */
export function placeholderFor(book) {
  return PLACEHOLDERS[hash(book.id || book.isbn || book.title) % PLACEHOLDERS.length];
}

function placeholder(book, wrap) {
  wrap.classList.remove('loading');
  wrap.classList.add('placeholder', `ph-${placeholderFor(book)}`);
  const t = document.createElement('span');
  t.className = 'ph-title';
  t.textContent = book.title;
  const a = document.createElement('span');
  a.className = 'ph-author';
  a.textContent = (book.authors || []).join(', ');
  wrap.replaceChildren(t, a);
}

/** A cover at 2:3, cropped (never stretched or letterboxed), or a placeholder tile when there's no picture. */
export function coverEl(book, className = 'cover') {
  const wrap = document.createElement('div');
  wrap.className = className;
  if (!book.cover) {
    placeholder(book, wrap);
    return wrap;
  }
  wrap.classList.add('loading');
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.onload = () => {
    if (img.naturalWidth < 10) { img.onerror(); return; } // Amazon's 1x1 "no image"
    wrap.classList.remove('loading');
    wrap.classList.add('loaded');
  };
  img.onerror = () => placeholder(book, wrap);
  img.src = book.cover;
  wrap.append(img);
  return wrap;
}

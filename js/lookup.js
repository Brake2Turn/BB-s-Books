// Book metadata lookups: Google Books first (best blurbs), Open Library as backup.
import { editionCoverUrls, firstWorking, probe, isbn13to10 } from './covers.js';
import { pickGenre } from './genres.js';

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OL = 'https://openlibrary.org';

/** Fetch JSON, giving up after `ms` so a stalled connection never leaves a lookup spinning. */
async function getJSON(url, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent.trim();
}

/** Google cover URLs, sharpest first (the fife size hint isn't honoured for every book). */
function googleCovers(links) {
  const url = links && (links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail);
  if (!url) return [];
  const clean = url.replace(/^http:/, 'https:').replace('&edge=curl', '');
  return [`${clean}&fife=w800`, clean];
}

const olCover = (id, size) => `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;

function fromGoogle(item) {
  const v = item.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn13 = ids.find((i) => i.type === 'ISBN_13');
  const isbn10 = ids.find((i) => i.type === 'ISBN_10');
  return {
    title: [v.title, v.subtitle].filter(Boolean).join(': '),
    authors: v.authors || [],
    blurb: stripHtml(v.description),
    cover: googleCovers(v.imageLinks)[1] || '',
    coverCandidates: googleCovers(v.imageLinks),
    isbn: (isbn13 || isbn10 || {}).identifier || '',
    publisher: v.publisher || '',
    published: v.publishedDate || '',
    pages: v.pageCount || null,
    subjects: v.categories || [],
  };
}

async function openLibraryBlurb(workKey) {
  if (!workKey) return '';
  try {
    const work = await getJSON(`${OL}${workKey}.json`);
    const d = work.description;
    return typeof d === 'string' ? d : (d && d.value) || '';
  } catch {
    return '';
  }
}

async function openLibraryByIsbn(isbn) {
  const data = await getJSON(`${OL}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  const b = data[`ISBN:${isbn}`];
  if (!b) return null;
  let workKey = '';
  try {
    const ed = await getJSON(`${OL}/isbn/${isbn}.json`);
    workKey = ed.works && ed.works[0] && ed.works[0].key;
  } catch { /* blurb is optional */ }
  return {
    title: [b.title, b.subtitle].filter(Boolean).join(': '),
    authors: (b.authors || []).map((a) => a.name),
    blurb: await openLibraryBlurb(workKey),
    cover: (b.cover && (b.cover.large || b.cover.medium)) || '',
    coverCandidates: b.cover ? [b.cover.large, b.cover.medium].filter(Boolean) : [],
    isbn,
    publisher: (b.publishers && b.publishers[0] && b.publishers[0].name) || '',
    published: b.publish_date || '',
    pages: b.number_of_pages || null,
    subjects: (b.subjects || []).map((x) => x.name).slice(0, 25),
  };
}

function merge(primary, backup) {
  if (!primary) return backup;
  if (!backup) return primary;
  const out = { ...primary };
  for (const k of Object.keys(backup)) {
    const empty = out[k] == null || out[k] === '' || (Array.isArray(out[k]) && !out[k].length);
    if (empty) out[k] = backup[k];
  }
  return out;
}

/** Look a book up by its ISBN (from a barcode). Returns null if nothing is found. */
export async function byIsbn(isbn) {
  const [g, o] = await Promise.allSettled([
    getJSON(`${GOOGLE}?q=isbn:${isbn}`).then((d) => (d.items && d.items[0] ? fromGoogle(d.items[0]) : null)),
    openLibraryByIsbn(isbn),
  ]);
  const google = g.status === 'fulfilled' ? g.value : null;
  const ol = o.status === 'fulfilled' ? o.value : null;
  if (!google && !ol) {
    if (g.status === 'rejected' && o.status === 'rejected') throw new Error('We couldn’t reach the book databases. Check your connection and try again.');
    return null;
  }
  const book = merge(google, ol);
  book.isbn = isbn;
  book.subjects = [...((google && google.subjects) || []), ...((ol && ol.subjects) || [])];
  book.genre = pickGenre(book.subjects);
  // Edition-specific sources first, then whatever the databases suggested.
  book.coverCandidates = [
    ...editionCoverUrls(isbn),
    ...((google && google.coverCandidates) || []),
    ...((ol && ol.coverCandidates) || []),
  ];
  return book;
}

async function googleSearch(q, limit) {
  const d = await getJSON(`${GOOGLE}?q=${encodeURIComponent(q)}&maxResults=${limit}&printType=books`);
  return (d.items || []).map(fromGoogle).filter((b) => b.title);
}

async function olSearch(q, limit) {
  const fields = 'key,title,author_name,cover_i,isbn,first_publish_year,publisher,subject';
  const d = await getJSON(`${OL}/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=${fields}`);
  return (d.docs || []).map((doc) => ({
    title: doc.title,
    authors: doc.author_name || [],
    blurb: '',
    cover: doc.cover_i ? olCover(doc.cover_i, 'M') : '',
    coverCandidates: doc.cover_i ? [olCover(doc.cover_i, 'L')] : [],
    isbn: (doc.isbn || []).find((i) => i.length === 13) || (doc.isbn || [])[0] || '',
    publisher: (doc.publisher || [])[0] || '',
    published: doc.first_publish_year ? String(doc.first_publish_year) : '',
    pages: null,
    subjects: (doc.subject || []).slice(0, 25),
    workKey: doc.key,
  }));
}

const withGenre = (b) => ({ ...b, genre: pickGenre(b.subjects) });

/** Free-text search (search by title). Returns up to `limit` candidates. */
export async function search(text, limit = 6) {
  try {
    const items = await googleSearch(text, limit);
    if (items.length) return items.map(withGenre);
  } catch { /* fall through to Open Library */ }
  return (await olSearch(text, limit)).map(withGenre);
}

// ---------- Cover scans: search several ways, then rank by fit ----------

const tokens = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter((t) => t.length > 1);

/** True if two words are the same allowing one wrong letter (OCR slips like "Circc" for "Circe"). */
function close(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false;
  let i = 0; let j = 0; let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const SMALL = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'on', 'for', 'at', 'by']);

/**
 * How well a candidate fits the cover, 0 (no fit) to about 3.4.
 * `prominent` is the big lettering (title and author); `seen` is every word read, small print
 * included. A title matching the big lettering counts far more than one matching small print,
 * so "Author of The Song of Achilles" on Circe's cover can't outrank Circe.
 */
function fit(book, prominent, seen) {
  const share = (words, pool) => (words.length ? words.filter((t) => pool.some((w) => close(t, w))).length / words.length : 0);
  const titleWords = tokens(book.title.split(':')[0]).filter((t) => !SMALL.has(t));
  const authorWords = tokens((book.authors || []).join(' '));
  // Penalise long titles that only share one word with the cover.
  const extra = Math.max(0, titleWords.length - seen.length) * 0.05;
  return share(titleWords, prominent) * 2 + share(titleWords, seen) * 0.4 + share(authorWords, seen) - extra + (book.cover ? 0.05 : 0);
}

/**
 * Find the book in a cover reading ({ query, title, words } from readCoverText).
 * Searches the likely title alone and the title with author, in both databases, merges the
 * results and puts the best fit first. Returns up to `limit` candidates.
 */
export async function searchCover(reading, limit = 6) {
  const seen = [...new Set(tokens(reading.words.join(' ')))];
  const prominent = tokens(reading.query);
  const queries = [...new Set([reading.query, reading.title].filter((q) => q && q.length > 2))];
  const runs = queries.flatMap((q) => [googleSearch(q, 8), olSearch(q, 6)]);
  const settled = await Promise.allSettled(runs);
  if (settled.every((r) => r.status === 'rejected')) throw new Error('We couldn’t reach the book databases. Check your connection.');

  const byKey = new Map();
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const b of r.value) {
      const key = `${tokens(b.title.split(':')[0]).join(' ')}|${tokens((b.authors || [])[0]).join(' ')}`;
      byKey.set(key, byKey.has(key) ? merge(byKey.get(key), b) : b);
    }
  }
  return [...byKey.values()]
    .map((b) => ({ book: withGenre(b), score: fit(b, prominent, seen) }))
    .filter((x) => x.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.book);
}

/** Genre for a book already in the library (used to fill in older books). */
export async function genreFor(book) {
  if (book.isbn) {
    const found = await byIsbn(book.isbn);
    if (found && found.genre) return found.genre;
  }
  // Only trust a search result that is clearly the same book, not just the first hit.
  const want = tokens(book.title.split(':')[0]).join(' ');
  const items = await search(`${book.title} ${(book.authors || [])[0] || ''}`, 5);
  const same = items.find((b) => b.genre && tokens(b.title.split(':')[0]).join(' ') === want);
  return (same && same.genre) || '';
}

/** Fill in a blurb for a search result that came without one. */
export async function fillBlurb(book) {
  if (book.blurb && book.genre) return book;
  if (book.workKey && !book.blurb) return { ...book, blurb: await openLibraryBlurb(book.workKey) };
  if (book.isbn) {
    try {
      const full = await byIsbn(book.isbn);
      const merged = merge(book, full);
      if (full && full.genre && !book.genre) merged.genre = full.genre;
      return merged;
    } catch { /* keep what we have */ }
  }
  return book;
}

/** Settle on the picture for a book: the first candidate that actually loads ('' if none). */
export async function resolveCover(book) {
  const hit = await firstWorking([...editionCoverUrls(book.isbn), ...(book.coverCandidates || []), book.cover]);
  return hit ? hit.url : '';
}

// ---------- Cover options (the cover picker) ----------

/**
 * Every cover this book might have: her exact edition first, then other editions.
 * Each option is { thumb, full }: the small image shown in the picker and the large one
 * saved when it's chosen. Only options whose thumbnail actually loads and is shaped like
 * a book cover are returned, best first, at most `limit`.
 */
export async function coverOptions(book, limit = 12) {
  const groups = []; // [{ thumb, full }], in priority order
  const add = (thumb, full) => { if (thumb && !groups.some((g) => g.thumb === thumb || g.full === full)) groups.push({ thumb, full: full || thumb }); };

  // 1. The exact edition, by ISBN.
  if (book.isbn) {
    const isbn10 = isbn13to10(book.isbn);
    if (isbn10) add(`https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.MZZZZZZZ.jpg`, `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`);
    add(`https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg?default=false`, `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg?default=false`);
  }
  const [fife, plain] = (book.coverCandidates || []).filter((u) => u.includes('books.google'));
  if (plain) add(plain, fife);

  // 2. Other editions: Open Library's edition list for the work, and other Google volumes.
  const title = (book.title || '').split(':')[0];
  const author = (book.authors || [])[0] || '';
  const [ol, google] = await Promise.allSettled([
    (async () => {
      let workKey = book.workKey;
      if (!workKey) {
        const found = await olSearch(`${title} ${author}`, 1);
        workKey = found[0] && found[0].workKey;
      }
      if (!workKey) return [];
      const d = await getJSON(`${OL}${workKey}/editions.json?limit=60`);
      return [...new Set((d.entries || []).flatMap((e) => (e.covers || []).filter((id) => id > 0)))].slice(0, 16);
    })(),
    getJSON(`${GOOGLE}?q=${encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)}&maxResults=20&printType=books`)
      .then((d) => (d.items || []).map((i) => googleCovers((i.volumeInfo || {}).imageLinks)).filter((c) => c.length)),
  ]);
  if (ol.status === 'fulfilled') ol.value.forEach((id) => add(olCover(id, 'M'), olCover(id, 'L')));
  if (google.status === 'fulfilled') google.value.slice(0, 12).forEach(([big, small]) => add(small, big));

  // Keep the ones that load and look like covers (portrait, not a sliver or a square logo).
  const checked = await Promise.all(groups.slice(0, 32).map(async (g) => {
    const hit = await probe(g.thumb, 8000);
    const ratio = hit && hit.w / hit.h;
    return hit && ratio > 0.45 && ratio < 0.9 ? g : null;
  }));
  return checked.filter(Boolean).slice(0, limit);
}

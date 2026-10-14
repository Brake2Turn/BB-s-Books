// Book metadata lookups: Google Books first (best blurbs), Open Library as backup.
const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OL = 'https://openlibrary.org';

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent.trim();
}

function googleCover(links) {
  const url = links && (links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail);
  if (!url) return '';
  // Ask Google for a bigger rendition than the default thumbnail.
  return url.replace(/^http:/, 'https:').replace('&edge=curl', '') + '&fife=w800';
}

function fromGoogle(item) {
  const v = item.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn13 = ids.find((i) => i.type === 'ISBN_13');
  const isbn10 = ids.find((i) => i.type === 'ISBN_10');
  return {
    title: [v.title, v.subtitle].filter(Boolean).join(': '),
    authors: v.authors || [],
    blurb: stripHtml(v.description),
    cover: googleCover(v.imageLinks),
    isbn: (isbn13 || isbn10 || {}).identifier || '',
    publisher: v.publisher || '',
    published: v.publishedDate || '',
    pages: v.pageCount || null,
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
    isbn,
    publisher: (b.publishers && b.publishers[0] && b.publishers[0].name) || '',
    published: b.publish_date || '',
    pages: b.number_of_pages || null,
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
    if (g.status === 'rejected' && o.status === 'rejected') throw new Error('Could not reach the book databases. Are you online?');
    return null;
  }
  // Open Library covers tend to be the real printed edition, Google blurbs are fuller.
  const book = merge(google, ol);
  if (ol && ol.cover) book.cover = ol.cover;
  book.isbn = isbn;
  return book;
}

/** Free-text search (used for cover scans). Returns up to `limit` candidates. */
export async function search(text, limit = 6) {
  const q = encodeURIComponent(text);
  try {
    const d = await getJSON(`${GOOGLE}?q=${q}&maxResults=${limit}&printType=books`);
    const items = (d.items || []).map(fromGoogle).filter((b) => b.title);
    if (items.length) return items;
  } catch { /* fall through to Open Library */ }

  const d = await getJSON(`${OL}/search.json?q=${q}&limit=${limit}&fields=key,title,author_name,cover_i,isbn,first_publish_year,publisher`);
  return (d.docs || []).map((doc) => ({
    title: doc.title,
    authors: doc.author_name || [],
    blurb: '',
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
    isbn: (doc.isbn || []).find((i) => i.length === 13) || (doc.isbn || [])[0] || '',
    publisher: (doc.publisher || [])[0] || '',
    published: doc.first_publish_year ? String(doc.first_publish_year) : '',
    pages: null,
    workKey: doc.key,
  }));
}

/** Fill in a blurb for a search result that came without one. */
export async function fillBlurb(book) {
  if (book.blurb) return book;
  if (book.workKey) return { ...book, blurb: await openLibraryBlurb(book.workKey) };
  if (book.isbn) {
    try {
      const full = await byIsbn(book.isbn);
      return merge(book, full);
    } catch { /* keep what we have */ }
  }
  return book;
}

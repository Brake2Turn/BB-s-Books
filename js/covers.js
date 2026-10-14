// Finding the cover for the exact edition scanned, and drawing covers and spines.

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

// ---------- Colour ----------

// Desaturated sage, ochre, dusty blue and terracotta, in two depths.
const TONES = ['#8E9A80', '#B89A68', '#7F909F', '#B07E66', '#6E7A62', '#9C7F4C', '#5F7080', '#94634C'];

function hash(s) {
  return [...(s || '')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

export function toneFor(title) {
  return TONES[hash(title) % TONES.length];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Ink or paper text, whichever reads better on the given colour. */
export function textOn(hex) {
  const l = luminance(hexToRgb(hex));
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return contrast(l, luminance(hexToRgb('#2E2620'))) >= contrast(l, luminance(hexToRgb('#F1E9DC'))) ? '#2E2620' : '#F1E9DC';
}

/**
 * The cover's dominant colour, muted so it sits in the palette. Needs the image host
 * to allow cross-origin reads; returns null if it doesn't.
 */
export function dominantColour(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 24; c.height = 36;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 24, 36);
        const px = ctx.getImageData(0, 0, 24, 36).data;
        let r = 0, g = 0, b = 0, weight = 0;
        for (let i = 0; i < px.length; i += 4) {
          const max = Math.max(px[i], px[i + 1], px[i + 2]);
          const min = Math.min(px[i], px[i + 1], px[i + 2]);
          const w = 0.15 + (max - min) / 255; // favour colourful pixels over paper-white margins
          r += px[i] * w; g += px[i + 1] * w; b += px[i + 2] * w; weight += w;
        }
        const avg = [r / weight, g / weight, b / weight];
        // Mute: pull 22% toward warm paper-sunk.
        const sunk = hexToRgb('#E6DCCB');
        resolve(rgbToHex(avg.map((v, i) => v * 0.78 + sunk[i] * 0.22)));
      } catch {
        resolve(null); // tainted canvas: host doesn't allow it
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ---------- Elements ----------

function placeholder(book, wrap) {
  wrap.classList.add('placeholder');
  const tone = toneFor(book.title);
  wrap.style.setProperty('--tone', tone);
  wrap.style.setProperty('--tone-ink', textOn(tone));
  const t = document.createElement('span');
  t.className = 'ph-title';
  t.textContent = book.title;
  const a = document.createElement('span');
  a.className = 'ph-author';
  a.textContent = (book.authors || []).join(', ');
  wrap.replaceChildren(t, a);
}

/** A cover at its true aspect ratio, or a typographic stand-in when there's no picture. */
export function coverEl(book, className = 'cover') {
  const wrap = document.createElement('div');
  wrap.className = className;
  const src = book.cover;
  if (book.coverRatio) wrap.style.aspectRatio = book.coverRatio;
  if (!src) {
    placeholder(book, wrap);
    return wrap;
  }
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.onload = () => {
    if (img.naturalWidth < 10) { img.onerror(); return; } // Amazon's 1x1 "no image"
    wrap.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    wrap.classList.add('loaded');
  };
  img.onerror = () => placeholder(book, wrap);
  img.src = src;
  wrap.append(img);
  return wrap;
}

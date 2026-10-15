// Camera, barcode reading and cover text recognition.
let stream = null;
let loopId = 0;
let nativeDetector = null;
let zxingReady = null;
let ocrWorker = null;

export async function startCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('This browser cannot use the camera. Try Safari or Chrome, opened from an https:// address.');
  }
  if (stream) stopCamera(video); // never leave an earlier camera running
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
  video.srcObject = stream;
  await video.play();
}

export const cameraLive = () => !!stream;

export function stopCamera(video) {
  stopBarcodeLoop();
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

// ---------- Barcodes ----------

async function getNativeDetector() {
  if (nativeDetector !== null) return nativeDetector;
  nativeDetector = false;
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('ean_13')) nativeDetector = new window.BarcodeDetector({ formats: ['ean_13'] });
    } catch { /* fall back to ZXing */ }
  }
  return nativeDetector;
}

function prepareZXing() {
  if (!zxingReady) {
    const wasmUrl = new URL('../vendor/zxing/zxing_reader.wasm', import.meta.url).href;
    zxingReady = window.ZXingWASM.prepareZXingModule({
      overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      fireImmediately: true,
    });
  }
  return zxingReady;
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

/** Grab the middle band of the video frame, where the barcode guide box is. */
function grabCentre(video) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const cw = Math.round(w * 0.8);
  const ch = Math.round(h * 0.45);
  canvas.width = cw;
  canvas.height = ch;
  ctx.drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
  return ctx.getImageData(0, 0, cw, ch);
}

export function isIsbn13(code) {
  if (!/^97[89]\d{10}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

async function detectOnce(video) {
  if (!video.videoWidth) return null;
  const native = await getNativeDetector();
  if (native) {
    const codes = await native.detect(video);
    return codes.map((c) => c.rawValue);
  }
  await prepareZXing();
  const results = await window.ZXingWASM.readBarcodes(grabCentre(video), {
    formats: ['EAN-13'],
    tryHarder: true,
    maxNumberOfSymbols: 1,
  });
  return results.filter((r) => r.isValid).map((r) => r.text);
}

/**
 * Keep scanning frames until an ISBN barcode is found.
 * onIsbn is called once with the ISBN; onOther is called for non-book barcodes.
 */
export function startBarcodeLoop(video, { onIsbn, onOther }) {
  const id = ++loopId;
  let lastOther = '';
  const tick = async () => {
    if (id !== loopId) return;
    try {
      const codes = (await detectOnce(video)) || [];
      const isbn = codes.find(isIsbn13);
      if (isbn && id === loopId) {
        loopId++;
        onIsbn(isbn);
        return;
      }
      if (codes[0] && codes[0] !== lastOther) {
        lastOther = codes[0];
        onOther(codes[0]);
      }
    } catch (err) {
      console.warn('Barcode scan failed', err);
    }
    setTimeout(tick, 120);
  };
  tick();
}

/** Find an ISBN barcode in a still photo (used by "use a photo instead"). */
export async function readBarcodeFromCanvas(canvasEl) {
  let codes;
  const native = await getNativeDetector();
  if (native) {
    codes = (await native.detect(canvasEl)).map((c) => c.rawValue);
  } else {
    await prepareZXing();
    const data = canvasEl.getContext('2d').getImageData(0, 0, canvasEl.width, canvasEl.height);
    const results = await window.ZXingWASM.readBarcodes(data, { formats: ['EAN-13'], tryHarder: true });
    codes = results.filter((r) => r.isValid).map((r) => r.text);
  }
  return codes.find(isIsbn13) || null;
}

/** Load a picked image file onto a canvas, shrunk to a sensible size. */
export async function fileToCanvas(file, max = 1600) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext('2d', { willReadFrequently: true }).drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

export function stopBarcodeLoop() {
  loopId++;
}

// ---------- Cover photos ----------

/**
 * Freeze the current frame, cropped to the on-screen guide box when given.
 * The crop doubles as the cover picture if no online cover exists.
 */
export function capturePhoto(video, guideEl) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (guideEl) {
    // The video uses object-fit: cover, so map screen pixels back to video pixels.
    const v = video.getBoundingClientRect();
    const g = guideEl.getBoundingClientRect();
    const scale = Math.max(v.width / vw, v.height / vh);
    const offX = (v.width - vw * scale) / 2;
    const offY = (v.height - vh * scale) / 2;
    sx = Math.max(0, (g.left - v.left - offX) / scale);
    sy = Math.max(0, (g.top - v.top - offY) / scale);
    sw = Math.min(vw - sx, g.width / scale);
    sh = Math.min(vh - sy, g.height / scale);
  }
  const c = document.createElement('canvas');
  const out = Math.min(1, 1000 / Math.max(sw, sh));
  c.width = Math.round(sw * out);
  c.height = Math.round(sh * out);
  c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

async function getOcrWorker(onProgress) {
  if (!ocrWorker) {
    const base = new URL('../vendor/tesseract/', import.meta.url).href;
    ocrWorker = window.Tesseract.createWorker('eng', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base + 'core/',
      langPath: base + 'lang/',
      logger: (m) => onProgress && onProgress(m),
    });
  }
  return ocrWorker;
}

// Words printed on covers that are never the title or author.
const COVER_NOISE = new Set(('a novel the bestseller bestselling best seller selling author of international sunday times new york ' +
  'york times number no winner of prize award shortlisted longlisted now major motion picture film tv series netflix ' +
  'edition anniversary special illustrated original unabridged million copies sold book club pick reese oprah ' +
  'introduction foreword by translated with an and from www com co uk women\'s womens fiction literature nobel booker ' +
  'costa pulitzer national bbc channel').split(' '));

/**
 * Prepare a photo for text recognition: greyscale, contrast stretched to the full range,
 * scaled so letters are large enough. Returns the normal canvas and an inverted copy,
 * because Tesseract reads dark-on-light far better than the light-on-dark many covers use.
 */
function prepare(source) {
  const scale = Math.min(2, 1600 / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const make = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const normal = make();
  const ctx = normal.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const grey = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    grey[j] = g;
    hist[grey[j]]++;
  }
  // Stretch between the 2nd and 98th percentiles so faded or glossy covers get full contrast.
  const total = w * h;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.02) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  const inverted = make();
  const inv = new ImageData(w, h);
  for (let j = 0, i = 0; j < grey.length; j++, i += 4) {
    const v = Math.max(0, Math.min(255, ((grey[j] - lo) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
    inv.data[i] = inv.data[i + 1] = inv.data[i + 2] = 255 - v;
    inv.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  inverted.getContext('2d').putImageData(inv, 0, 0);
  return { normal, inverted };
}

function wordsFrom(data) {
  const lines = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  return lines.flatMap((line, li) => line.words.map((w) => ({
    text: w.text.replace(/[^\p{L}\p{N}'&-]/gu, ''),
    raw: w.text,
    conf: w.confidence,
    size: w.bbox.y1 - w.bbox.y0,
    line: li,
    x: w.bbox.x0,
    y: w.bbox.y0,
  })))
    .filter((w) => w.conf > 50 && w.text.length > 1 && /\p{L}{2,}|\d{2,}/u.test(w.text)
      // mostly letters: drops "|||" and stray texture read as characters
      && (w.text.match(/\p{L}/gu) || []).length >= w.text.length * 0.6);
}

/** How much a reading is worth: confident, large words score highest. */
const scoreOf = (words) => words.reduce((t, w) => t + w.conf * Math.sqrt(w.size), 0);

/**
 * Read the words printed on a cover.
 * Returns { query, title, words } where title is the largest lettering (usually the title),
 * query is title plus the next most prominent words (usually the author), noise removed.
 */
export async function readCoverText(canvasEl, onProgress) {
  const worker = await getOcrWorker(onProgress);
  // Sparse-text mode: covers have scattered words, not paragraphs.
  await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });
  const { normal, inverted } = prepare(canvasEl);
  const read = async (c) => wordsFrom((await worker.recognize(c, {}, { text: true, blocks: true })).data);

  let words = await read(normal);
  // Light lettering on a dark cover reads badly; try it inverted and keep the better reading.
  const avgConf = words.length ? words.reduce((t, w) => t + w.conf, 0) / words.length : 0;
  if (words.length < 3 || avgConf < 80) {
    const alt = await read(inverted);
    if (scoreOf(alt) > scoreOf(words)) words = alt;
  }

  const useful = words;
  if (!useful.length) return { query: '', title: '', words: [] };

  // Title: the largest lettering (within 70% of the biggest), kept in reading order.
  const maxSize = Math.max(...useful.map((w) => w.size));
  // Reading order: top to bottom, then left to right within the same printed line.
  const inOrder = (a, b) => (Math.abs(a.y - b.y) > Math.min(a.size, b.size) * 0.6 ? a.y - b.y : a.x - b.x);
  const isNoise = (w) => COVER_NOISE.has(w.text.toLowerCase());
  const titleWords = useful.filter((w) => w.size >= maxSize * 0.7).sort(inOrder);
  const others = useful
    .filter((w) => w.size < maxSize * 0.7 && w.size >= maxSize * 0.25 && !isNoise(w))
    .sort((a, b) => b.size * b.conf - a.size * a.conf)
    .slice(0, 4)
    .sort(inOrder);

  const title = titleWords.map((w) => w.text).join(' ');
  const query = [...titleWords, ...others].map((w) => w.text).slice(0, 10).join(' ');
  return { query, title, words: useful.map((w) => w.text.toLowerCase()) };
}

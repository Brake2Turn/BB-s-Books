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

/** Read the words printed on a cover and turn them into a search query. */
export async function readCoverText(canvasEl, onProgress) {
  const worker = await getOcrWorker(onProgress);
  const { data } = await worker.recognize(canvasEl, {}, { text: true, blocks: true });
  const allWords = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
  // Prefer confident, larger words: titles and author names are printed big.
  const words = allWords
    .filter((w) => w.confidence > 55 && /[a-z0-9]{2,}/i.test(w.text))
    .map((w) => ({ text: w.text.replace(/[^\p{L}\p{N}'&-]/gu, ''), size: w.bbox.y1 - w.bbox.y0 }))
    .filter((w) => w.text.length > 1);
  if (!words.length) return (data.text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const sizes = words.map((w) => w.size).sort((a, b) => b - a);
  const cutoff = sizes[Math.min(sizes.length - 1, 7)] * 0.6;
  return words.filter((w) => w.size >= cutoff).slice(0, 10).map((w) => w.text).join(' ');
}

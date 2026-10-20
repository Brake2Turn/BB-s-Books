// The scan chime: a short, bright rising sparkle when a barcode or cover is read.
// Synthesised with Web Audio, so there's no sound file to download or cache.
// Phones only allow sound after a tap, so unlock() runs on the tap that opens the scanner.

let ctx = null;

/** Call from a tap. Creates (or wakes) the audio context so the chime can play later. */
export function unlock() {
  try {
    // Mix with her music or podcast rather than pausing it, and respect the silent switch (Safari 16.4+).
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { ctx = null; }
}

/** One bell-like note: a sine with a soft octave shimmer, quick attack, gentle ring-out. */
function bell(freq, at, { gain = 0.22, length = 0.5 } = {}) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, at + length);
  out.connect(ctx.destination);
  for (const [mult, level, type] of [[1, 1, 'sine'], [2, 0.28, 'sine'], [3.01, 0.08, 'triangle']]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, at);
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

/**
 * The "got it" chime: a quick rising major arpeggio (E6, G#6, B6) landing on a ringing
 * high E7, the shape games use for a reward. About half a second long.
 */
export function playScan() {
  if (!ctx || ctx.state === 'closed') return;
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime + 0.01;
    bell(1318.5, t, { gain: 0.16, length: 0.22 });
    bell(1661.2, t + 0.06, { gain: 0.16, length: 0.22 });
    bell(1975.5, t + 0.12, { gain: 0.17, length: 0.26 });
    bell(2637.0, t + 0.18, { gain: 0.2, length: 0.6 });
  } catch { /* sound is a nicety; never let it break a scan */ }
}

/** A soft, short tick for each slice that passes the wheel's pointer. */
export function tick() {
  if (!ctx || ctx.state === 'closed') return;
  try {
    const t = ctx.currentTime + 0.005;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.09, t + 0.003);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    out.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.04);
    osc.connect(out);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch { /* never let a sound break the game */ }
}

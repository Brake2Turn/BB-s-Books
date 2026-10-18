// The tap ripple: a soft white wave and three rings spreading from where she touched.
// Used by the start-up screen and the add-to-library celebration, so both feel the same.

/**
 * Play a ripple inside `host` (a full-screen, positioned element) centred on (x, y),
 * big enough to reach the farthest corner. Does nothing when Reduce Motion is on.
 */
export function ripple(host, x, y) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const reach = 2 * Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const ring = (cls, delay, duration) => {
    const el = document.createElement('span');
    el.className = `ripple ${cls}`;
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${reach}px`, height: `${reach}px` });
    host.append(el);
    // Bright while it spreads, fading only at the end.
    el.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(.55)', opacity: 0.95, offset: 0.55 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
    ], { duration, delay, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'both' }).finished.then(() => el.remove(), () => el.remove());
  };
  ring('wave', 0, 1000);
  ring('ring', 0, 1150);
  ring('ring', 160, 1150);
  ring('ring', 320, 1150);
}

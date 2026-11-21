export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const mercator = lat => Math.asinh(Math.tan(lat * Math.PI / 180)) * 180 / Math.PI;
export const latitude = y => Math.atan(Math.sinh(y * Math.PI / 180)) * 180 / Math.PI;
export const smooth = t => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

// A geographic landing starts and finishes at rest. Wheel packets can
// inherit the previous log-scale velocity when their destination moves.
export function cameraProgress(t, slope = 0) {
  const u = clamp(t, 0, 1);
  const rest = u * u * u * (10 + u * (-15 + u * 6));
  return rest + clamp(slope, 0, 2.4) * u * (1 - u) ** 3 * (1 + 3 * u);
}

export function project(view, w, h, [ lon, lat ]) {
  const k = w / view.span;
  return [ w / 2 + (lon - view.x) * k, h / 2 + (view.y - mercator(lat)) * k ];
}
export function under(view, w, h, x, y) {
  return [ view.x + (x - w / 2) * view.span / w, view.y - (y - h / 2) * view.span / w ];
}
export function blend(a, b, t) {
  const ratio = b.span / a.span, scale = ratio ** t;
  const pan = Math.abs(ratio - 1) < .00001 ? t : (scale - 1) / (ratio - 1);
  return {x : a.x + (b.x - a.x) * pan, y : a.y + (b.y - a.y) * pan, span : a.span * scale};
}
export function hash(x, y = 0) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), u = smooth(x - i), v = smooth(y - j);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) +
      (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v;
}

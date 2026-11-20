import {clamp, TAU, hash} from "./geometry.js";

const inks = [ "71,115,211", "208,93,163", "240,153,65" ];
const plates = new Map();
export const AFTERGLOW = 3600;
export const RIPPLE_LIMIT = 16;
const tone = (rgb, a) => "rgba(" + rgb + "," + a + ")";

export function releaseWave(waves, key, now) {
  for (const wave of waves)
    if (wave.key === key && wave.left == null)
      wave.left = now;
}
export function envelope(wave, now, reduced = false) {
  const gain = reduced ? 1 : Math.min(1, .13 + (now - wave.start) / 410);
  const tail = wave.left == null ? 1 : clamp(1 - (now - wave.left) / AFTERGLOW, 0, 1);
  return gain * tail * tail * (3 - 2 * tail);
}

function pool(ctx, x, y, rx, ry, tilt, rgb, strength, hollow = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(rx, ry);
  const ink = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  ink.addColorStop(0, tone(rgb, strength * (hollow ? .06 : .94)));
  ink.addColorStop(.42, tone(rgb, strength * (hollow ? .31 : .78)));
  ink.addColorStop(.67, tone(rgb, strength * (hollow ? .9 : .49)));
  ink.addColorStop(.83, tone(rgb, strength * .21));
  ink.addColorStop(1, tone(rgb, 0));
  ctx.fillStyle = ink;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// Print the stationary pigment once. Animation can then move many independent
// water fronts without rebuilding a sheet of gradients for each one per frame.
function pigment(seed) {
  if (plates.has(seed))
    return plates.get(seed);
  const sheet = document.createElement("canvas"), size = 448;
  sheet.width = sheet.height = size;
  const ink = sheet.getContext("2d");
  ink.setTransform(size / 2, 0, 0, size / 2, size / 2, size / 2);
  const drift = Math.sin(seed * 3.6) * .11;
  pool(ink, -.16, -.06, .76, .52, -.59, "143,121,211", .40, true);
  pool(ink, .16, .06, .68, .44, -.70, "233,118,167", .55, true);
  pool(ink, -.17, .03, .52, .31, -.93, "80,168,224", .58);
  pool(ink, -.27 + drift, .13, .25, .16, -.98, "63,94,202", .72);
  pool(ink, .19, -.12 + drift, .48, .29, -.86, "245,126,166", .66);
  pool(ink, .27, -.33 + drift, .29, .19, -.48, "255,173,75", .72);
  pool(ink, -.02, .27, .24, .19, .47, "247,130,161", .60);
  pool(ink, .06, .20, .16, .13, .17, "255,210,86", .95);
  const salt = Math.round(seed * 100);
  // Small pigment deposits remain registered to the ground as the fronts cross.
  for (let i = 0; i < 53; i++) {
    const t = hash(i, salt), cross = (hash(i, salt + 3) - .5) * (.15 + .21 * t);
    const x = -.49 + t * .97, y = .22 * Math.sin(t * 8.7 + .5) - .34 + t * .52 + cross;
    const r = .004 + hash(i, salt + 7) ** 2 * .022;
    ink.beginPath();
    ink.arc(x, y, r, 0, TAU);
    ink.fillStyle = i % 5 === 0 ? "#6dbdd6b8" : i % 3 === 0 ? "#f68b5abe" : "#ffc166d9";
    ink.fill();
  }
  if (plates.size >= 20)
    plates.delete(plates.keys().next().value);
  plates.set(seed, sheet);
  return sheet;
}

export function waterprint(ctx, x, y, r, phase, seed, intensity = 1) {
  if (r < 1 || intensity < .002)
    return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(seed * .63);
  ctx.globalAlpha = intensity;
  ctx.drawImage(pigment(seed), -r, -r, r * 2, r * 2);
  for (let layer = 0; layer < 3; layer++) {
    const angle = seed + layer * 2.18, dx = Math.cos(angle) * r * .18, dy = Math.sin(angle) * r * .14;
    const rad = r * (1 - .09 * layer), rgb = inks[layer];
    for (let band = 0; band < 8; band++) {
      const front = (phase * .20 + band / 8 + layer * .04) % 1;
      const a0 = angle - 1.7 + .17 * Math.sin(band + seed),
            sweep = 3.9 + .73 * Math.sin(band * .61 + seed);
      const spread = .24 + front * .74;
      ctx.beginPath();
      for (let j = 0; j <= 54; j++) {
        const a = a0 + sweep * j / 54,
              dist = rad *
            (spread + .055 * Math.sin(3 * a + phase * .48 + layer) + .025 * Math.sin(5 * a - seed));
        const px = dx + dist * Math.cos(a), py = dy + dist * Math.sin(a) * (.85 + .07 * Math.cos(layer));
        if (!j)
          ctx.moveTo(px, py);
        else
          ctx.lineTo(px, py);
      }
      ctx.lineWidth = .55 + 1.1 * (1 - front);
      ctx.strokeStyle = tone(rgb, (.16 + .28 * Math.sin(front * Math.PI)) * Math.sin(front * Math.PI));
      ctx.stroke();
    }
  }
  ctx.restore();
}

export class RippleField {
  constructor(canvas, project) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.project = project;
    this.waves = [];
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.motion.addEventListener("change", () => this.schedule());
    document.addEventListener("visibilitychange", () => this.schedule());
  }
  resize(w, h, dpr) {
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.schedule();
  }
  strike(key, center, depth, click = false) {
    const now = performance.now();
    if (!click && this.waves.some(w => w.key === key && w.left == null))
      return;
    if (click)
      releaseWave(this.waves, key, now);
    const seed = Array.from(key).reduce((a, c) => a + c.charCodeAt(0), 0) * .089;
    this.waves.push({key, center, start : now, left : click ? now + 380 : null, seed, depth, click});
    if (this.waves.length > RIPPLE_LIMIT)
      this.waves.shift();
    this.schedule();
  }
  leave(key) {
    releaseWave(this.waves, key, performance.now());
    this.schedule();
  }
  clear() {
    this.waves.length = 0;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.draw(performance.now());
  }
  schedule() {
    if (this.frame || !this.width || document.hidden)
      return;
    this.frame = requestAnimationFrame(t => {
      this.frame = 0;
      this.draw(t);
    });
  }
  draw(now) {
    if (!this.width)
      return;
    const {ctx, width : w, height : h, dpr} = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.waves = this.waves.filter(w => w.left == null || now - w.left < AFTERGLOW);
    const quiet = this.motion.matches;
    for (const wave of this.waves) {
      const [x, y] = this.project(wave.center);
      const age = quiet ? 1.4 : (now - wave.start) / 1000;
      const radius = Math.min(w * (w < 600 ? .30 : .16), h * .36, wave.depth === "country" ? 161 : 143) *
          (wave.click ? 1.28 : 1);
      const size =
          radius * (quiet ? .84 : .22 + .65 * (1 - Math.exp(-age * 2.5)) + .10 * Math.min(age / 3, 1));
      waterprint(ctx, x, y, size, quiet ? 0 : age * .77, wave.seed, envelope(wave, now, quiet));
    }
    this.canvas.dataset.waves = String(this.waves.length);
    if (this.waves.some(w => !quiet || w.left != null))
      this.schedule();
  }
}

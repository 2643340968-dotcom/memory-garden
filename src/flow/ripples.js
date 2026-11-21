import {clamp, hash, smooth, TAU} from "./geometry.js";

export const AFTERGLOW = 3600;
const RIPPLE_LIMIT = 12;
const rgba = (rgb, a) => "rgba(" + rgb + "," + a + ")";
const dyes = [ "65,142,206", "197,105,180", "247,146,80" ];
const rims = [ "68,118,188", "174,113,174", "224,152,110" ];

export function releaseWave(waves, key, now) {
  for (const wave of waves)
    if (wave.key === key && wave.left == null)
      wave.left = now;
}
export function envelope(wave, now, reduced = false) {
  const rise = wave.rise ?? wave.start, from = wave.from ?? 0;
  const gain = reduced ? 1 : from + (1 - from) * smooth(clamp((now - rise) / 490, 0, 1));
  const fade = wave.left == null ? 1 : 1 - smooth(clamp((now - wave.left) / AFTERGLOW, 0, 1));
  return gain * fade;
}
export function placePhase(id) {
  let n = 2166136261;
  for (const ch of id)
    n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296 * TAU;
}

function wash(ctx, x, y, rx, ry, angle, rgb, opacity) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(-.05, -.08, .03, 0, 0, 1);
  g.addColorStop(0, rgba(rgb, opacity));
  g.addColorStop(.37, rgba(rgb, .78 * opacity));
  g.addColorStop(.67, rgba(rgb, .36 * opacity));
  g.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// A strand is sampled along the current. Its two banks curl, widen and thin
// independently. The curled pools, filaments and suspended flecks travel on
// the same curve, so the colour continues to move after a visitor leaves.
function sampleStrand(t, layer, phase, seed) {
  const a = seed * .73 + layer * 2.11;
  const bend = phase * .57 + layer * .94;
  const x = (t - .47) * 1.56 + .16 * Math.sin(t * 5.7 + bend) + .13 * Math.cos(t * 8 + seed);
  const y = .29 * Math.sin(t * 5.1 + a + .45 * Math.sin(bend)) + .18 * Math.sin(t * 8.2 - bend * .72) +
      .08 * (layer - 1);
  const tx = 1.56 + .912 * Math.cos(t * 5.7 + bend) - 1.04 * Math.sin(t * 8 + seed);
  const ty =
      1.479 * Math.cos(t * 5.1 + a + .45 * Math.sin(bend)) + 1.476 * Math.cos(t * 8.2 - bend * .72);
  const inv = 1 / Math.max(.12, Math.hypot(tx, ty));
  const width = Math.sin(Math.PI * t) ** .79 *
      (.065 + .13 * (.5 + .5 * Math.sin(t * 6.6 + a - bend)) + .055 * Math.sin(t * 3.5 + bend) ** 2);
  return [ x, y, -ty * inv, tx * inv, width ];
}

export function waterprint(ctx, x, y, r, phase, seed, intensity = 1, ux = 0, uy = 0) {
  if (r < 2 || intensity < .004)
    return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r, r);
  ctx.rotate(
      seed * .83 + .23 * Math.sin(phase * .35 + seed) +
      .35 * (ux * Math.sin(seed) - uy * Math.cos(seed)));
  ctx.globalAlpha = intensity;
  const time = phase * .60;
  wash(ctx, -.04, -.01, .84, .61, -.6, "255,249,234", .41);
  wash(
      ctx, -.19 + .10 * Math.sin(time), .03 + .13 * Math.cos(time * .86), .70, .49, -.62, "101,177,223",
      .37);
  wash(
      ctx, .10 + .11 * Math.cos(time * .93), -.06 + .09 * Math.sin(time * 1.2), .71, .42, -.8,
      "231,125,174", .40);
  for (let layer = 0; layer < 3; layer++) {
    const samples = [];
    for (let j = 0; j <= 24; j++)
      samples.push(sampleStrand(j / 24, layer, phase, seed));
    const first = samples[0], last = samples.at(-1);
    const dye = ctx.createLinearGradient(first[0], first[1], last[0], last[1]);
    dye.addColorStop(0, rgba(dyes[layer], 0));
    dye.addColorStop(.20, rgba(dyes[layer], .56));
    dye.addColorStop(.54, rgba(dyes[layer], .98));
    dye.addColorStop(.86, rgba(dyes[layer], .44));
    dye.addColorStop(1, rgba(dyes[layer], 0));
    ctx.fillStyle = dye;
    for (const [spread, alpha] of [[ 1.72, .095 ], [ 1.28, .14 ], [ .92, .19 ], [ .49, .16 ]]) {
      ctx.beginPath();
      for (let j = 0; j < samples.length; j++) {
        const [a, b, nx, ny, width] = samples[j], d = width * spread;
        if (j)
          ctx.lineTo(a + nx * d, b + ny * d);
        else
          ctx.moveTo(a + nx * d, b + ny * d);
      }
      for (let j = samples.length - 1; j >= 0; j--) {
        const [a, b, nx, ny, width] = samples[j], d = width * spread;
        ctx.lineTo(a - nx * d, b - ny * d);
      }
      ctx.closePath();
      ctx.globalAlpha = intensity * alpha;
      ctx.fill();
    }
    ctx.globalAlpha = intensity;
    const t = .39 + .18 * Math.sin(time * .74 + layer * 2.1 + seed);
    const [cx, cy, nx, ny] = sampleStrand(t, layer, phase, seed);
    wash(ctx, cx, cy, .24, .14, Math.atan2(-nx, ny), dyes[layer], .58);
    if (layer === 0)
      wash(ctx, cx - .025, cy + .015, .20, .105, Math.atan2(-nx, ny), "60,87,192", .66);
    if (layer === 2)
      wash(ctx, cx + .027, cy - .01, .128, .093, 0, "255,211,103", .89);
    // Short advancing, translucent contours. Neither their centre nor their
    // radius is constant, and opacity reaches zero at both ends of a cycle.
    for (let band = 0; band < 6; band++) {
      const front = (phase * .105 + band / 6 + layer * .037) % 1;
      const spread = .23 + front * .75, angle = seed + layer * 1.93;
      const a0 = angle - 1.85 + .21 * Math.sin(phase * .51 + band);
      ctx.beginPath();
      for (let j = 0; j <= 34; j++) {
        const a = a0 + j / 34 * (3.9 + .38 * Math.cos(band + seed));
        const d = spread *
            (1 + .16 * Math.sin(3 * a + phase * .43 + layer) + .091 * Math.sin(4 * a - phase * .27));
        const px = .19 * cx + d * Math.cos(a),
              py = .20 * cy + .74 * d * Math.sin(a) + .08 * Math.sin(a * 2 + phase * .57);
        if (j)
          ctx.lineTo(px, py);
        else
          ctx.moveTo(px, py);
      }
      ctx.lineWidth = (.63 + 1.35 * (1 - front)) / r;
      ctx.strokeStyle = rgba(rims[layer], .42 * Math.sin(front * Math.PI) ** 1.2);
      ctx.stroke();
    }
    if (layer === 2) {
      for (let j = 0; j < 34; j++) {
        const t = (hash(j, 71) + time * .042) % 1,
              [ a, b, nx, ny, width ] = sampleStrand(t, layer, phase, seed);
        const spread = (hash(j, 42) - .5) * width * 2.8;
        ctx.fillStyle = rgba(j % 4 ? "253,167,73" : "103,191,216", .78 * Math.sin(t * Math.PI));
        ctx.beginPath();
        ctx.arc(a + nx * spread, b + ny * spread, .004 + .012 * hash(j, 81) ** 2, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// Leave the paper visible through each wave, including where several places overlap.
function mapRipple(ctx, x, y, radius, phase, mark, strength) {
  if (strength < .004)
    return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(.14 * Math.sin(mark.seed) + .12 * mark.uy);
  ctx.strokeStyle = "#899d9e";
  ctx.lineWidth = 1;
  for (let band = 0; band < 3; band++) {
    const front = (phase * .16 + band / 3) % 1;
    const reach = radius * (.18 + .79 * front), drift = reach * .045;
    ctx.globalAlpha = strength * .46 * Math.sin(Math.PI * front);
    ctx.beginPath();
    for (let segment = 0; segment < 48; segment++) {
      const angle = segment * TAU / 48;
      const edge = reach *
          (1 + .045 * Math.sin(3 * angle + phase * .38 + mark.seed) +
           .025 * Math.cos(2 * angle - phase * .31));
      const px = Math.cos(angle) * edge + mark.ux * drift,
            py = Math.sin(angle) * edge * .84 + mark.uy * drift;
      if (segment)
        ctx.lineTo(px, py);
      else
        ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
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
  steer(x, y) {
    const prev = this.pointer;
    this.pointer = {x, y};
    if (!prev)
      return;
    const dx = x - prev.x, dy = y - prev.y, d = Math.hypot(dx, dy);
    if (d < .6)
      return;
    this.direction = [ dx / d, dy / d ];
    const held = this.waves.findLast(w => w.left == null);
    if (held) {
      held.tx = dx / d;
      held.ty = dy / d;
    }
  }
  strike(key, center, depth, click = false) {
    const now = performance.now(), seed = placePhase(key);
    const [tx, ty] = this.direction ?? [ Math.cos(seed), Math.sin(seed) ];
    let w = this.waves.find(v => v.key === key && now - (v.left ?? now) < AFTERGLOW);
    if (w) {
      if (!click && w.left == null)
        return;
      w.from = envelope(w, now, this.motion.matches);
      w.rise = now;
      w.tx = tx;
      w.ty = ty;
      w.left = click ? now + 440 : null;
    } else {
      w = {
        key,
        center,
        depth,
        start : now,
        seed,
        left : click ? now + 440 : null,
        ux : tx,
        uy : ty,
        tx,
        ty
      };
      this.waves.push(w);
      if (this.waves.length > RIPPLE_LIMIT)
        this.waves.shift();
    }
    if (click)
      w.impulse = now;
    this.schedule();
  }
  leave(key) {
    releaseWave(this.waves, key, performance.now());
    this.schedule();
  }
  clear(holdLastFrame = false) {
    this.waves.length = 0;
    this.pointer = null;
    this.direction = null;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!holdLastFrame && this.ctx && this.width)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.dataset.waves = "0";
  }
  schedule() {
    if (this.frame || !this.width || document.hidden)
      return;
    this.frame = requestAnimationFrame(now => {
      this.frame = 0;
      this.draw(now);
    });
  }
  present(now, cameraMoving) {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.draw(now, cameraMoving);
  }
  draw(now, cameraMoving = false) {
    const {ctx, width : w, height : h, dpr} = this, quiet = this.motion.matches;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const dt = clamp((now - (this.lastTime ?? now)) / 1000, 0, .10);
    this.lastTime = now;
    const relax = 1 - Math.exp(-dt * 4.4);
    this.waves = this.waves.filter(v => v.left == null || now - v.left < AFTERGLOW);
    for (const mark of this.waves) {
      const [x, y] = this.project(mark.center);
      mark.ux += (mark.tx - mark.ux) * relax;
      mark.uy += (mark.ty - mark.uy) * relax;
      const age = Math.max(0, (now - mark.start) / 1000),
            tail = mark.left == null ? 0 : clamp((now - mark.left) / AFTERGLOW, 0, 1);
      const push = mark.impulse == null ? 0 : Math.max(0, (now - mark.impulse) / 1000);
      const swell = mark.impulse == null ? 0 : .35 * (1 - Math.exp(-push * 7)) * Math.exp(-push * 1.25);
      const extent = Math.min(w * (w < 600 ? .35 : .19), h * .40, mark.depth === "country" ? 191 : 166);
      const r =
          extent * (quiet ? .85 : .14 + .78 * (1 - Math.exp(-age * 2.05)) + .30 * smooth(tail) + swell);
      if (x + r < 0 || y + r < 0 || x - r > w || y - r > h)
        continue;
      const phase = quiet ? 1.15 : age + mark.seed * .31;
      mapRipple(ctx, x, y, r, phase, mark, envelope(mark, now, quiet));
    }
    this.canvas.dataset.waves = String(this.waves.length);
    if (!cameraMoving && this.waves.some(v => !quiet || v.left != null))
      this.schedule();
  }
}

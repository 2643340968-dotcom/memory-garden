import plates from "./field-studies.json";
import { mixInk } from "./identities.js";

const studies = new Map();
function pointsFor(motif) {
  if (!studies.has(motif)) {
    const points = Uint8Array.from(atob(plates[motif]), c => c.charCodeAt(0));
    const xs = [], ys = [];
    for (let i = 0; i < points.length; i += 3) { xs.push(points[i]); ys.push(points[i + 1]); }
    xs.sort((a,b)=>a-b); ys.sort((a,b)=>a-b);
    const edge = Math.floor(xs.length * .003);
    studies.set(motif, { points, left:xs[edge], right:xs.at(-edge-1), top:ys[edge], bottom:ys.at(-edge-1) });
  }
  return studies.get(motif);
}

const revealTime = 780;
const tau = Math.PI * 2;
function noise(slot) {
  let hash = Math.imul(slot + 1, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export class FieldStudy {
  constructor(canvas, { onDark = false } = {}) {
    this.canvas = canvas;
    this.onDark = onDark;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    const length = pointsFor("zijincao").points.length;
    this.current = new Float32Array(length);
    this.from = new Float32Array(length);
    this.seeds = Float32Array.from({ length }, (_, i) => noise(i));
    this.movers = [];
    for (let i = 0; i < length; i += 3) if (this.seeds[i+2] > .8) this.movers.push(i);
    this.frame = 0;
    this.visible = false;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.motion.addEventListener("change", () => this.refresh());
    document.addEventListener("visibilitychange", () => this.refresh());
  }

  show(id, motif, ink) {
    const morph = this.place && this.visible && this.motif !== motif;
    this.composition = pointsFor(motif);
    this.print = null;
    this.target = this.composition.points;
    this.place = id;
    this.motif = motif;
    this.inks = this.onDark
      ? [mixInk(ink, "#d2c7b5", .46), mixInk(ink, "#efdfcb", .67), mixInk(ink, "#fff1dc", .87), "#fff2cb"]
      : [mixInk(ink, "#f4ebd6", .15), mixInk(ink, "#22221f", .22), mixInk(ink, "#181b19", .64), mixInk(ink, "#c78c42", .57)];
    if (morph) {
      this.from.set(this.current);
    } else {
      // The grains lift from a loose impression near the pin, then settle
      // from the base of the stem towards the uppermost petals.
      for (let i = 0; i < this.target.length; i += 3) {
        this.from[i] = 127 + (this.target[i] - 127) * 0.53 + (this.seeds[i] - 0.5) * 152;
        this.from[i + 1] = 213 + (this.target[i + 1] - 128) * 0.18 + (this.seeds[i + 1] - 0.5) * 59;
        this.from[i + 2] = this.target[i + 2] * 0.74;
      }
    }
    this.started = this.visible ? performance.now() : null;
    this.refresh();
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    if (visible && this.started == null) this.started = performance.now();
    this.refresh();
  }

  setTraveling(value) {
    if (this.traveling === value) return;
    this.traveling = value;
    this.refresh();
  }

  hide() {
    this.place = null;
    this.setVisible(false);
  }

  resize() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.ratio = Math.min(devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(width * this.ratio);
    this.canvas.height = Math.round(height * this.ratio);
    this.width = width;
    this.height = height;
    this.print = null;
    this.refresh();
  }

  refresh() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!this.place || !this.visible || document.hidden) return;
    if (!this.width) { this.resize(); return; }
    this.paint(performance.now());
    if (!this.motion.matches && !this.traveling) this.frame = requestAnimationFrame(this.tick);
  }

  tick = (now) => {
    if (now - this.lastPaint >= 32) this.paint(now);
    this.frame = requestAnimationFrame(this.tick);
  };

  paint(now) {
    this.lastPaint = now;
    const { ctx, target, from, current, seeds, width, height } = this;
    const quiet = this.motion.matches;
    const age = Math.max(0, now - this.started);
    const progress = quiet ? 1 : Math.min(1, age / revealTime);
    const sweep = quiet ? -100 : ((age / 3900 + 0.14) % 1) * 389 - 62;
    const { left, right, top, bottom } = this.composition;
    const scale = Math.min(width * .87 / ((right-left)*380/255), height * .87 / ((bottom-top)*220/255));
    const sx = scale * 380 / 255, sy = scale * 220 / 255;
    const ox = (width - (left+right)*sx) / 2, oy = (height - (top+bottom)*sy) / 2;
    const minGrain = Math.min(.92, Math.max(.60, width * .009));
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (progress === 1) {
      if (!this.print) {
        this.print = document.createElement("canvas");
        this.print.width = this.canvas.width; this.print.height = this.canvas.height;
        const base = this.print.getContext("2d", { willReadFrequently: true });
        base.scale(this.ratio, this.ratio);
        current.set(target);
        for (let i = 0; i < target.length; i+=3) {
          if (seeds[i+2] > .8) continue;
          const tone = target[i+2] < 116 ? 0 : target[i+2] < 175 ? 1 : 2;
          const size = Math.max(minGrain, (tone === 2 ? 1.95 : 1.53) * scale);
          base.fillStyle = this.inks[tone];
          base.fillRect(ox + target[i]*sx, oy + target[i+1]*sy, size, size);
        }
      }
      ctx.drawImage(this.print, 0, 0, width, height);
    }
    const tones = this.inks.map(() => new Path2D());
    const glints = new Path2D(), filaments = new Path2D();
    const count = progress === 1 ? this.movers.length : target.length / 3;
    for (let slot = 0; slot < count; slot++) {
      const i = progress === 1 ? this.movers[slot] : slot * 3;
      const tx = target[i], ty = target[i + 1], grain = seeds[i + 2];
      let x = tx, y = ty, shade = target[i + 2], bend = 0;
      if (progress < 1) {
        const delay = (1 - ty / 255) * 0.30 + grain * 0.17;
        const u = Math.min(1, Math.max(0, (progress - delay) / (1 - delay)));
        const ease = u * u * (3 - 2 * u);
        bend = Math.sin(Math.PI * u);
        x = from[i] + (tx - from[i]) * ease + (seeds[i] - 0.35) * 63 * bend;
        y = from[i + 1] + (ty - from[i + 1]) * ease - (9 + seeds[i + 1] * 25) * bend;
        shade = from[i + 2] + (shade - from[i + 2]) * ease;
      }
      // A band of raking light picks out a few grains at a time. The majority
      // hold their printed outline, so the motif remains legible on the map.
      const light = Math.max(0, 1 - Math.abs(tx * 0.79 + (255 - ty) * 0.21 - sweep) / 32);
      if (grain > 0.80 && light > 0) {
        const lift = light * light * (grain - 0.8) * 5;
        x += (seeds[i] - 0.5) * 19 * lift;
        y -= (4 + seeds[i + 1] * 11) * lift;
      }
      if (!quiet && grain > 0.967) {
        const phase = age / (2450 + seeds[i] * 1300) + seeds[i + 1];
        const drift = (0.5 - 0.5 * Math.cos(tau * phase)) * progress;
        x += (seeds[i] - 0.5) * 15 * drift;
        y -= (3 + seeds[i + 1] * 8) * drift;
      }
      current[i] = x; current[i + 1] = y; current[i + 2] = shade;
      const px = ox + x * sx, py = oy + y * sy;
      const tone = light > 0.36 && grain > 0.62 ? 3 : shade < 116 ? 0 : shade < 175 ? 1 : 2;
      const size = Math.max(minGrain, (tone === 2 ? 1.95 : tone === 3 ? 2.05 : 1.53) * scale);
      tones[tone].rect(px, py, size, size);
      if (grain > 0.968 && bend > 0.25) {
        filaments.moveTo(px, py);
        filaments.lineTo(px - (tx - from[i]) * 0.065 * sx * bend, py - (ty - from[i + 1]) * 0.065 * sy * bend);
      }
      if (grain > 0.973 && light > 0.60) {
        const r = (1.1 + seeds[i] * 1.6) * light * Math.min(1.2, scale + 0.3);
        glints.moveTo(px + r, py);
        glints.arc(px, py, r, 0, tau);
      }
    }
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = this.inks[1]; ctx.lineWidth = 0.7; ctx.stroke(filaments);
    ctx.globalAlpha = 0.42 + 0.58 * progress;
    this.inks.forEach((ink, i) => { ctx.fillStyle = ink; ctx.fill(tones[i]); });
    ctx.globalAlpha = 0.92;
    ctx.shadowColor = "#ffdc94"; ctx.shadowBlur = 4;
    ctx.fillStyle = "#fffbdd"; ctx.fill(glints);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
}

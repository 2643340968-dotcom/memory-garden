import plates from "./field-studies.json";
import { mixInk } from "./identities.js";

const studies = new Map();
function pointsFor(motif) {
  if (!studies.has(motif)) {
    studies.set(motif, Uint8Array.from(atob(plates[motif]), c => c.charCodeAt(0)));
  }
  return studies.get(motif);
}

const revealTime = 1150;
const tau = Math.PI * 2;
function noise(slot) {
  let hash = Math.imul(slot + 1, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export class FieldStudy {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    const length = pointsFor("nanjing").length;
    this.current = new Float32Array(length);
    this.from = new Float32Array(length);
    this.seeds = Float32Array.from({ length }, (_, i) => noise(i));
    this.frame = 0;
    this.visible = false;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.motion.addEventListener("change", () => this.refresh());
    document.addEventListener("visibilitychange", () => this.refresh());
  }

  show(id, motif, ink) {
    const morph = this.place && this.visible && this.motif !== motif;
    this.target = pointsFor(motif);
    this.place = id;
    this.motif = motif;
    this.inks = [mixInk(ink, "#f4ebd6", 0.32), ink, mixInk(ink, "#16231f", 0.60),
      mixInk(ink, "#d7ad62", 0.69)];
    if (morph) {
      this.from.set(this.current);
    } else {
      // The grains lift from a loose impression near the pin, then settle
      // from the base of the flower or building towards its upper outline.
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

  hide() {
    this.place = null;
    this.setVisible(false);
  }

  resize() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.ratio);
    this.canvas.height = Math.round(height * this.ratio);
    this.width = width;
    this.height = height;
    this.refresh();
  }

  refresh() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!this.place || !this.visible || document.hidden) return;
    if (!this.width) { this.resize(); return; }
    this.paint(performance.now());
    if (!this.motion.matches) this.frame = requestAnimationFrame(this.tick);
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
    const scale = Math.min(width / 380, height / 220);
    const sx = scale * 380 / 255, sy = scale * 220 / 255;
    const ox = (width - 380 * scale) / 2, oy = (height - 220 * scale) / 2;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const tones = this.inks.map(() => new Path2D());
    const glints = new Path2D(), filaments = new Path2D();
    for (let i = 0; i < target.length; i += 3) {
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
      const tone = light > 0.36 && grain > 0.52 ? 3 : shade < 132 ? 0 : shade < 191 ? 1 : 2;
      const size = Math.max(0.76, (tone === 2 ? 1.53 : tone === 3 ? 1.75 : 1.13) * scale);
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

import {clamp, smooth, TAU} from "./geometry.js";
import {flowers, makePlates} from "./coverPigments.js";
import {WetPaper} from "./wetPaper.js";

// Positions in the two drifts, with room above the inner crowns for the
// title and a clear passage between them below for the scroll cue.
const beds = [
  // x, y, relative radius, specimen, rotation (degrees), time of opening
  [-.022,.38,.144,4, 11,.55], [.077,.24,.108,5, 24,0], [.154,.19,.050,3,-19,.68],
  [.187,.35,.092,1, 16,.33], [.116,.48,.071,2, 35,.87], [.038,.68,.141,5,-12,.25],
  [.167,.73,.087,4, 26,1.04], [.234,.57,.114,6,-20,.56], [.309,.51,.057,3, 6,1.20],
  [.372,.555,.102,0, 26,.18], [.443,.598,.069,4,-5,.81], [.071,.90,.053,1,-8,1.27],
  [1.023,.36,.132,1,-13,.39], [.927,.22,.112,4, 15,.10], [.842,.21,.059,2,-3,.94],
  [.810,.36,.103,5,-18,.67], [.897,.52,.081,3, 9,.42], [.970,.72,.142,4, 24,.15],
  [.831,.76,.082,6,-16,.98], [.754,.58,.117,1, 16,.34], [.681,.51,.057,2, 12,1.14],
  [.620,.575,.107,5,-19,.51], [.557,.587,.072,0, 17,.23], [.925,.90,.046,3, 30,1.30],
];

const ease = n => smooth(clamp(n, 0, 1));
const frontLife = 7.8;
const interval = 2.72;
const stillTime = 10.4;

async function loadPlates() {
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    const images = await new Promise(resolve => {
      let worker;
      try {
        worker = new Worker(new URL("./cover.worker.js", import.meta.url), {type:"module"});
        worker.onmessage = event => { worker.terminate(); resolve(event.data); };
        worker.onmessageerror = () => { worker.terminate(); resolve(null); };
        worker.onerror = event => { event.preventDefault(); worker.terminate(); resolve(null); };
      } catch { resolve(null); }
    });
    if (images) return images;
  }
  const surface = size => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  const plates = [];
  for (const [index, specimen] of flowers.entries()) {
    await new Promise(resolve => setTimeout(resolve, 0));
    plates.push(makePlates(specimen, index, surface));
  }
  return plates;
}

export function openingFlowers(w, h) {
  const bedHeight = h * .69;
  const scale = Math.min(w, bedHeight * 2.55) * (w < 600 ? 1.19 : 1);
  const depth = Math.min(bedHeight, w * .81);
  const top = h - bedHeight + (bedHeight - depth) * .49;
  return beds.map(([x, y, r, type, angle, delay], i) => {
    const fromEdge = Math.max(0, Math.min(x, 1 - x) * 2);
    return {
      x:x * w, y:top + y * depth, radius:r * scale, type, angle:angle * Math.PI / 180,
      delay:(x > .5 ? 1.75 : 0) + delay * .87 + fromEdge * .55,
      pace:1 + .09 * Math.sin(i * 2.6),
    };
  });
}

export function flowerFront(age) {
  if (age <= 0 || age >= frontLife) return null;
  const t = age / frontLife;
  const emergence = ease(t / .082);
  return {
    progress:t,
    radius: .025 + 2.12 * t * (1.31 - .31 * t),
    opacity: .86 * emergence * (1 - ease((t - .08) / .92)),
    wetness: emergence * (1 - ease((t - .33) / .67)),
  };
}

export function frontsAt(bloom, time) {
  const elapsed = time - bloom.delay - .40;
  if (elapsed <= 0) return [];
  // A bounded change in speed lets adjacent flowers breathe differently
  // without the two sides drifting back into synchrony after several cycles.
  const phase = bloom.angle * 2;
  const clock = elapsed + .17 * (Math.sin(elapsed * .70 + phase) - Math.sin(phase));
  const last = Math.floor(clock / interval);
  const first = Math.max(0, Math.floor((clock - frontLife) / interval) + 1);
  const fronts = [];
  for (let i = first; i <= last; i++) {
    const wave = flowerFront(clock - i * interval);
    if (wave) fronts.push(wave);
  }
  return fronts;
}

function stamp(ctx, plate, radius) {
  ctx.drawImage(plate, -radius, -radius, radius * 2, radius * 2);
}

function corolla(ctx, plate, bloom, age) {
  const petals = flowers[bloom.type].petals;
  if (age >= 1.75) {
    const swell = 1 + .028 * (1 - Math.cos((age - 1.75) * TAU / frontLife));
    ctx.globalAlpha = .88;
    stamp(ctx, plate.body, bloom.radius * swell);
    return;
  }
  // Separate washes open at their own angles, then join the continuous crown.
  const joined = ease((age - .88) / .87);
  const step = TAU / petals;
  for (let i = 0; i < petals; i++) {
    const t = ease((age - .27 * (.5 + .5 * Math.sin(i * 2.41 + bloom.angle))) / 1.45);
    if (t <= 0) continue;
    ctx.save();
    ctx.rotate(i * step + (1 - t) * .12 * Math.sin(i + bloom.angle));
    ctx.globalAlpha = (1 - joined) * ease(t * 2);
    stamp(ctx, plate.petal, bloom.radius * (.09 + .91 * t));
    ctx.restore();
  }
  if (joined > 0) {
    ctx.globalAlpha = .88 * joined;
    stamp(ctx, plate.body, bloom.radius * (.88 + .12 * joined));
  }
}

export class CoverFlowers {
  constructor(canvas, motion) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.motion = motion;
    this.time = 0;
    this.observer = new ResizeObserver(() => {
      if (this.active) { this.size(); this.wake(); }
    });
    this.observer.observe(canvas);
    motion.addEventListener("change", () => {
      if (this.active && !motion.matches) this.time = stillTime;
      this.wake();
    });
    document.addEventListener("visibilitychange", () => this.wake());
  }
  size() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1900000 / (w * h)));
    const width = Math.round(w * dpr), height = Math.round(h * dpr);
    if (this.canvas.width === width && this.canvas.height === height && this.w === w && this.h === h) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.setTransform(width / w, 0, 0, height / h, 0, 0);
    this.w = w; this.h = h;
    this.blooms = openingFlowers(w, h);
    this.paper = new WetPaper(w, h, this.blooms);
    this.washCanvas ??= document.createElement("canvas");
    this.washCanvas.width = this.paper.width;
    this.washCanvas.height = this.paper.height;
    this.washCtx = this.washCanvas.getContext("2d");
    this.washImage = new ImageData(this.paper.pixels, this.paper.width, this.paper.height);
    this.washTime = null;
  }
  open() {
    this.active = true;
    this.onPaper = true;
    this.time = 0;
    this.size();
    this.paper?.clear();
    this.washTime = null;
    this.loading ??= loadPlates().then(plates => {
      this.plates = plates;
      this.wake();
    });
    this.wake();
  }
  close() {
    this.active = false;
    this.wake();
  }
  revealMap(progress) {
    const visible = progress < .72;
    if (this.onPaper === visible) return;
    this.onPaper = visible;
    this.wake();
  }
  wake() {
    cancelAnimationFrame(this.frame);
    this.previous = null;
    if (!this.active || !this.onPaper || document.hidden || !this.blooms || !this.plates) return;
    this.frame = requestAnimationFrame(now => this.tick(now));
  }
  tick(now) {
    if (this.previous == null || now - this.previous >= 1000 / 60 - 1) {
      this.time += this.previous == null ? 0 : Math.min(.12, (now - this.previous) / 1000);
      this.previous = now;
      this.draw(this.motion.matches ? stillTime : this.time);
    }
    if (!this.motion.matches) this.frame = requestAnimationFrame(next => this.tick(next));
  }
  updateWash(time, fronts) {
    if (this.motion.matches || (this.washTime == null && time > 1.8)) {
      if (this.washTime === time) return;
      // Recover earlier crossings in a resized field or a reduced-motion still.
      this.paper.clear();
      const step = .25;
      for (let i = 11; i >= 0; i--)
        this.paper.step(this.blooms.map(bloom => frontsAt(bloom, time - i * step)), step);
    } else {
      const dt = this.washTime == null ? 0 : time - this.washTime;
      if (this.washTime != null && dt < 1 / 22) return;
      this.paper.step(fronts, dt);
    }
    this.washCtx.putImageData(this.washImage, 0, 0);
    this.washTime = time;
  }
  draw(time) {
    const ctx = this.ctx;
    const fronts = this.blooms.map(bloom => frontsAt(bloom, time));
    this.updateWash(time, fronts);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "source-over";
    for (const bloom of this.blooms) {
      const age = (time - bloom.delay) * bloom.pace;
      if (age <= 0) continue;
      ctx.save();
      ctx.translate(bloom.x, bloom.y);
      ctx.rotate(bloom.angle);
      corolla(ctx, this.plates[bloom.type], bloom, age);
      ctx.restore();
    }
    // The inner front travels over the petals from the heart. Its dye
    // diffuses into the paper where the outer shoulders of two fronts meet.
    this.blooms.forEach((bloom, i) => {
      if (!fronts[i].length) return;
      ctx.save();
      ctx.translate(bloom.x, bloom.y);
      ctx.rotate(bloom.angle);
      for (const wave of fronts[i]) {
        ctx.globalAlpha = wave.opacity;
        stamp(ctx, this.plates[bloom.type].ring, bloom.radius * wave.radius);
      }
      ctx.restore();
    });
    const {spacing, top, width, height} = this.paper;
    ctx.drawImage(this.washCanvas, -spacing, top - spacing, width * spacing, height * spacing);
  }
}

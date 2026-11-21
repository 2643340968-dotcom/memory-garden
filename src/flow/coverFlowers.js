import {clamp, smooth, TAU} from "./geometry.js";
import {loadPlates} from "./coverPlates.js";
import {WetPaper} from "./wetPaper.js";

// Positions in the two drifts, with room above the inner crowns for the
// title and a clear passage between them below for the scroll cue.
const beds = [
  // x, y, relative radius, city, rotation in degrees, opening delay
  [.054,.33,.142,"harbin", 12,.22], [.151,.19,.069,"hohhot",-16,.02],
  [.192,.41,.123,"beijing", 21,.45], [.063,.61,.142,"dunhuang",-12,.36],
  [.102,.85,.073,"urumqi", 15,1.24], [.229,.70,.116,"guangzhou",-19,.67],
  [.313,.49,.070,"kashgar", 16,1.17], [.377,.575,.123,"nanjing", 22,.09],
  [.448,.63,.069,"lhasa", -8,.91],
  [.946,.30,.144,"chengdu",-12,.38], [.844,.23,.075,"xining", 12,.04],
  [.815,.414,.112,"qingdao", 23,.70], [.941,.58,.142,"haikou", -8,.46],
  [.919,.84,.065,"wuhan", 28,1.29], [.797,.70,.121,"quanzhou",-17,.17],
  [.698,.48,.063,"xian",  8,1.15], [.624,.59,.128,"kunming",-16,.47],
  [.554,.64,.073,"shenyang", 11,.29],
];

const ease = n => smooth(clamp(n, 0, 1));
const frontLife = 7.8;
const interval = 2.72;
const stillTime = 10.4;

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

// Reveal the actual specimen outward from its heart, including asymmetric
// racemes. A feathered opening travels over the drawing as it unfolds.
function corolla(ctx, scratch, plate, bloom, age) {
  if (age >= 1.85) {
    stamp(ctx, plate.body, bloom.radius);
    return;
  }
  const t = ease(age / 1.85), canvas = scratch.canvas, half = canvas.width / 2;
  const radius = half * (.045 + 1.36 * t);
  scratch.clearRect(0, 0, canvas.width, canvas.height);
  scratch.drawImage(plate.body, 0, 0, canvas.width, canvas.height);
  scratch.globalCompositeOperation = "destination-in";
  const aperture = scratch.createRadialGradient(half, half, 0, half, half, radius);
  aperture.addColorStop(0, "white");
  aperture.addColorStop(.59, "white");
  aperture.addColorStop(1, "rgba(255,255,255,0)");
  scratch.fillStyle = aperture;
  scratch.fillRect(0, 0, canvas.width, canvas.height);
  scratch.globalCompositeOperation = "source-over";
  ctx.globalAlpha = ease(t * 3.5);
  stamp(ctx, canvas, bloom.radius * (.72 + .28 * t));
}

function newCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export class CoverFlowers {
  constructor(canvas, motion) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.scratch = newCanvas(208, 208).getContext("2d");
    this.motion = motion;
    this.time = 0;
    this.observer = new ResizeObserver(() => {
      if (this.active) {
        this.size();
        this.wake();
      }
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
    if (!w || !h || !this.plates) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1900000 / (w * h)));
    const width = Math.round(w * dpr), height = Math.round(h * dpr);
    if (this.canvas.width === width && this.canvas.height === height && this.w === w && this.h === h)
      return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.setTransform(width / w, 0, 0, height / h, 0, 0);
    this.w = w;
    this.h = h;
    this.blooms = openingFlowers(w, h);
    this.paper = new WetPaper(w, h, this.blooms, this.plates);
    this.crowns = newCanvas(width, height).getContext("2d");
    this.crowns.setTransform(width / w, 0, 0, height / h, 0, 0);
    this.washCanvas ??= document.createElement("canvas");
    this.washCanvas.width = this.paper.width;
    this.washCanvas.height = this.paper.height;
    this.washCtx = this.washCanvas.getContext("2d");
    this.washImage = new ImageData(this.paper.pixels, this.paper.width, this.paper.height);
    this.rimCtx = newCanvas(this.paper.width, this.paper.height).getContext("2d");
    this.rimImage = new ImageData(this.paper.erosion, this.paper.width, this.paper.height);
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
      this.size();
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
    if (!this.active || !this.onPaper || this.obscured || document.hidden || !this.blooms || !this.plates)
      return;
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
    this.rimCtx.putImageData(this.rimImage, 0, 0);
    this.washTime = time;
  }
  draw(time) {
    const ctx = this.ctx;
    const fronts = this.blooms.map(bloom => frontsAt(bloom, time));
    this.updateWash(time, fronts);
    ctx.clearRect(0, 0, this.w, this.h);
    const crowns = this.crowns;
    crowns.clearRect(0, 0, this.w, this.h);
    this.blooms.forEach((bloom, i) => {
      const age = (time - bloom.delay) * bloom.pace;
      if (age <= 0) return;
      const plate = this.plates[bloom.type];
      ctx.save();
      ctx.translate(bloom.x, bloom.y);
      ctx.rotate(bloom.angle);
      for (const wave of fronts[i]) {
        if (wave.radius < .78) continue;
        ctx.globalAlpha = .45 * wave.opacity * ease((wave.radius - .78) / .24);
        stamp(ctx, plate.ring, bloom.radius * wave.radius);
      }
      ctx.restore();
      crowns.save();
      crowns.translate(bloom.x, bloom.y);
      crowns.rotate(bloom.angle);
      corolla(crowns, this.scratch, plate, bloom, age);
      // The wave inside a flower is reflected light. Only its outer lip can
      // carry pigment into a neighbour. It cannot deposit colour on a face.
      for (const wave of fronts[i]) {
        if (wave.radius > 1.03) continue;
        crowns.globalAlpha = .20 * wave.opacity * (1 - ease((wave.radius - .72) / .31));
        stamp(crowns, plate.light, bloom.radius * wave.radius);
      }
      crowns.restore();
    });
    const {spacing, top, width, height} = this.paper;
    const left = -spacing, y = top - spacing, w = width * spacing, h = height * spacing;
    ctx.drawImage(this.washCanvas, left, y, w, h);
    crowns.globalCompositeOperation = "destination-out";
    crowns.drawImage(this.rimCtx.canvas, left, y, w, h);
    crowns.globalCompositeOperation = "source-over";
    ctx.drawImage(crowns.canvas, 0, 0, this.w, this.h);
  }
}

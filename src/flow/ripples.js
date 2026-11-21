import {clamp, smooth} from "./geometry.js";
import {allForms, forms} from "./flowerForms.js";
import {drawCorolla} from "./drawCorolla.js";
import {loadPlates} from "./coverPlates.js";
import {drawInnerFronts, drawOuterFronts, focusedBody, frontsAt, stamp} from "./coverFlowers.js";
import {PetalCurrent} from "./petalCurrent.js";

export const AFTERGLOW = 3600;
const RIPPLE_LIMIT = 12;

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
// A stationary mark is painted once. Only the attended flower and the still-wet
// rims need new frames, independently of the map tiles or the camera.
const restingFaces = new Map();
export function restFlower(pin) {
  const canvas = pin.querySelector("canvas");
  const ctx = canvas.getContext("2d"), n = canvas.width;
  ctx.clearRect(0, 0, n, n);
  const species = pin.dataset.species, key = species + ":" + n;
  let face = restingFaces.get(key);
  if (!face) {
    face = document.createElement("canvas");
    face.width = face.height = n;
    drawCorolla(face.getContext("2d"), n, allForms[species], 0, 0, 48);
    restingFaces.set(key, face);
  }
  ctx.drawImage(face, 0, 0);
}

export class RippleField {
  constructor(canvas, project) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.project = project;
    this.waves = [];
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.motion.addEventListener("change", () => this.clear());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.clear(); });
  }
  resize(w, h, dpr) {
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    for (const wave of this.waves) wave.bloom.radius = this.openRadius();
    this.schedule();
  }
  openRadius() {
    return this.width <= 560 ? 33 : 47;
  }
  strike(pin, click = false) {
    if (this.motion.matches) return;
    const now = performance.now(), key = pin.dataset.id, type = pin.dataset.species;
    let wave = this.waves.find(w => w.pin === pin && w.bloom.type === type);
    const held = wave && wave.left == null;
    if (wave) {
      if (!click && wave.left == null) return;
      wave.from = envelope(wave, now);
      wave.rise = now;
    } else {
      const bloom = {type, x:0, y:0, radius:this.openRadius(), angle:0, delay:-2.75};
      wave = {key, pin, bloom, center:pin.mark.center, start:now, current:new PetalCurrent([bloom])};
      this.waves.push(wave);
      if (this.waves.length > RIPPLE_LIMIT) this.retire(this.waves.shift());
      loadPlates(!forms[type]).then(plates => {
        wave.plate = plates[type];
        if (this.waves.includes(wave)) this.schedule();
      });
    }
    wave.left = click && !held ? now + 350 : null;
    this.schedule();
  }
  relative(wave, x, y) {
    const [cx, cy] = this.project(wave.center);
    return {x:x - cx, y:y - cy};
  }
  steer(x, y) {
    const wave = this.waves.findLast(w => w.left == null);
    if (wave) wave.current.hover(this.relative(wave, x, y), (performance.now() - wave.start) / 1000);
  }
  pull(pin, from, to, dt) {
    const wave = this.waves.find(w => w.pin === pin && w.left == null);
    if (!wave) return;
    wave.current.pull(this.relative(wave, ...from), this.relative(wave, ...to), dt,
                      (performance.now() - wave.start) / 1000);
  }
  release(key) {
    this.waves.find(w => w.key === key)?.current.release();
  }
  leave(key) {
    this.release(key);
    releaseWave(this.waves, key, performance.now());
    this.schedule();
  }
  retire(wave) {
    if (wave.pin.isConnected && wave.pin.dataset.species === wave.bloom.type) restFlower(wave.pin);
  }
  clear(holdLastFrame = false) {
    for (const wave of this.waves) this.retire(wave);
    this.waves.length = 0;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!holdLastFrame) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.dataset.waves = "0";
  }
  schedule() {
    if (this.frame || !this.width || document.hidden || !this.waves.length) return;
    this.frame = requestAnimationFrame(now => {
      this.frame = 0;
      this.draw(now);
    });
  }
  present(now, cameraMoving) {
    if (!this.waves.length) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.draw(now, cameraMoving);
  }
  draw(now, cameraMoving = false) {
    const {ctx, dpr} = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    for (const wave of [...this.waves]) {
      const {bloom, pin, plate, current} = wave;
      if (wave.left != null && now - wave.left >= AFTERGLOW) {
        this.retire(wave);
        this.waves.splice(this.waves.indexOf(wave), 1);
        continue;
      }
      const age = (now - wave.start) / 1000, gain = envelope(wave, now);
      current.advance(clamp((now - (wave.last ?? now)) / 1000, 0, .12), age);
      wave.last = now;
      if (!plate) continue;
      const [x, y] = this.project(wave.center), radius = bloom.radius;
      if (x < -radius*3 || x > this.width+radius*3 || y < -radius*3 || y > this.height+radius*3) continue;
      const fronts = frontsAt(bloom, age).concat(current.fronts(0, age));
      ctx.save();
      ctx.translate(x, y);
      drawOuterFronts(ctx, plate, radius * 1.32, fronts, gain * 2.35);
      ctx.restore();
      if (!pin.isConnected || pin.hidden || pin.dataset.species !== bloom.type) continue;
      const canvas = pin.querySelector("canvas"), ink = canvas.getContext("2d"), half = canvas.width / 2;
      const body = focusedBody(bloom, current.states[0], plate, dpr, age);
      ink.clearRect(0, 0, canvas.width, canvas.height);
      ink.save();
      ink.translate(half, half);
      stamp(ink, body, half);
      drawInnerFronts(ink, plate, half, fronts, gain);
      ink.restore();
    }
    this.canvas.dataset.waves = String(this.waves.length);
    if (!cameraMoving) this.schedule();
  }
}

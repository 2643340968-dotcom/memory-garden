import {clamp, smooth, TAU} from "./geometry.js";
import {flowers, pigmentOutline} from "./coverPigments.js";

const radialBins = 192;
const radialRange = 2.5;
const binsPerRadius = (radialBins - 1) / radialRange;

function footprint(bloom, paper) {
  const {spacing, width, height, top} = paper;
  const outline = pigmentOutline(bloom.type);
  const extent = Math.max(...outline) * radialRange * bloom.radius;
  const x0 = Math.max(1, Math.floor((bloom.x - extent) / spacing) + 1);
  const x1 = Math.min(width - 2, Math.ceil((bloom.x + extent) / spacing) + 1);
  const y0 = Math.max(1, Math.floor((bloom.y - extent - top) / spacing) + 1);
  const y1 = Math.min(height - 2, Math.ceil((bloom.y + extent - top) / spacing) + 1);
  const cells = [], bins = [];
  for (let y = y0; y <= y1; y++) {
    const dy = (y - .5) * spacing + top - bloom.y;
    for (let x = x0; x <= x1; x++) {
      const dx = (x - .5) * spacing - bloom.x;
      const turns = (Math.atan2(dy, dx) - bloom.angle) / TAU;
      const index = (turns - Math.floor(turns)) * outline.length;
      const i = Math.floor(index) % outline.length, fraction = index - Math.floor(index);
      const reach = outline[i] * (1 - fraction) + outline[(i + 1) % outline.length] * fraction;
      const bin = Math.round(binsPerRadius * Math.hypot(dx, dy) / (bloom.radius * reach));
      if (bin >= radialBins) continue;
      cells.push(y * width + x);
      bins.push(bin);
    }
  }
  const {mid, root} = flowers[bloom.type];
  return {cells:Uint32Array.from(cells), bins:Uint8Array.from(bins), profile:new Float32Array(radialBins),
          color:mid.map((value, i) => value * .57 + root[i] * .43)};
}

// All rings from one crown share one wet footprint. A second, independently
// coloured crown must reach the same part of the paper to produce a mixed wash.
function deposit(source, fronts, pigment, strongest) {
  if (!fronts.length) return;
  const {profile, cells, bins, color} = source;
  profile.fill(0);
  for (const wave of fronts) {
    const trail = .19 + .36 * wave.progress, fringe = .085 + .15 * wave.progress;
    const start = Math.max(0, Math.floor((wave.radius - trail) * binsPerRadius));
    const end = Math.min(radialBins - 1, Math.ceil((wave.radius + fringe) * binsPerRadius));
    for (let i = start; i <= end; i++) {
      const distance = i / binsPerRadius;
      const gap = distance - wave.radius;
      const edge = Math.min(1, Math.abs(gap) / (gap < 0 ? trail : fringe));
      const petal = smooth(clamp((distance - .18) / .54, 0, 1));
      profile[i] = Math.max(profile[i], wave.wetness * petal * (1 - smooth(edge)));
    }
  }
  for (let i = 0; i < cells.length; i++) {
    const amount = profile[bins[i]];
    if (amount === 0) continue;
    const cell = cells[i], j = cell * 4;
    strongest[cell] = Math.max(strongest[cell], amount);
    pigment[j] += amount * color[0];
    pigment[j + 1] += amount * color[1];
    pigment[j + 2] += amount * color[2];
    pigment[j + 3] += amount;
  }
}

export class WetPaper {
  constructor(w, h, blooms) {
    this.spacing = Math.max(3.5, w / 184, h / 138);
    this.top = Math.max(0, Math.min(...blooms.map(b => b.y - b.radius * radialRange)) - this.spacing);
    this.width = Math.ceil(w / this.spacing) + 2;
    this.height = Math.ceil((h - this.top) / this.spacing) + 2;
    this.diffusion = (Math.min(w, h) * .012 / this.spacing) ** 2;
    this.sources = blooms.map(b => footprint(b, this));
    const cells = this.width * this.height;
    this.strongest = new Float32Array(cells);
    this.pigment = new Float32Array(cells * 4);
    this.wet = new Float32Array(cells * 4);
    this.next = new Float32Array(cells * 4);
    this.pixels = new Uint8ClampedArray(cells * 4);
  }
  clear() {
    this.wet.fill(0);
    this.next.fill(0);
    this.pixels.fill(0);
  }
  step(fronts, dt) {
    const {width, height, wet, next, pigment, pixels, strongest} = this;
    pigment.fill(0);
    strongest.fill(0);
    this.sources.forEach((source, i) => deposit(source, fronts[i], pigment, strongest));
    const absorb = 1 - Math.exp(-dt / .72), dry = 1 - Math.exp(-dt / 2.35);
    const spread = Math.min(.72, 1 - Math.exp(-4 * this.diffusion * dt));
    const stride = width * 4;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const cell = y * width + x, j = cell * 4;
      const total = pigment[j + 3], second = total - strongest[cell];
      const contact = .67 * smooth(clamp(second / .64, 0, 1)) * smooth(clamp(total / .92, 0, 1));
      const gain = contact > wet[j + 3] ? absorb : dry;
      const weight = total > 0 ? contact / total : 0;
      // Diffuse premultiplied colour and water together, so the receding
      // edge carries the same hue as the pool, even after both fronts leave.
      for (let ch = 0; ch < 4; ch++) {
        const k = j + ch;
        const neighbors = (wet[k - 4] + wet[k + 4] + wet[k - stride] + wet[k + stride]) * .25;
        const dispersed = wet[k] + spread * (neighbors - wet[k]);
        const target = ch === 3 ? contact : pigment[k] * weight;
        next[k] = dispersed + gain * (target - dispersed);
      }
      const alpha = next[j + 3];
      pixels[j + 3] = alpha * 255;
      if (pixels[j + 3]) {
        pixels[j] = next[j] / alpha;
        pixels[j + 1] = next[j + 1] / alpha;
        pixels[j + 2] = next[j + 2] / alpha;
      }
    }
    this.wet = next;
    this.next = wet;
  }
}

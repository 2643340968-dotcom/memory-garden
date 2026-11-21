import {clamp, smooth, TAU} from "./geometry.js";
import {forms} from "./flowerForms.js";

const radialBins = 144;
const radialRange = 1.82;
const binsPerRadius = (radialBins - 1) / radialRange;
const ease = value => smooth(clamp(value, 0, 1));
const toLinear = channel => ((channel / 255 + .055) / 1.055) ** 2.4;
const toDisplay = channel => 255 * (1.055 * Math.max(0, channel) ** (1 / 2.4) - .055);
const display = Uint8ClampedArray.from({length: 1025}, (_, i) => toDisplay(i / 1024));

function footprint(bloom, paper, plate) {
  const {spacing, width, height, top} = paper, {outline, reserve} = plate;
  const maskSize = Math.sqrt(reserve.length), cos = Math.cos(bloom.angle), sin = Math.sin(bloom.angle);
  const extent = Math.max(...outline) * radialRange * bloom.radius;
  const x0 = Math.max(1, Math.floor((bloom.x - extent) / spacing) + 1),
        x1 = Math.min(width - 2, Math.ceil((bloom.x + extent) / spacing) + 1);
  const y0 = Math.max(1, Math.floor((bloom.y - extent - top) / spacing) + 1),
        y1 = Math.min(height - 2, Math.ceil((bloom.y + extent - top) / spacing) + 1);
  const cells = [], bins = [];
  for (let y = y0; y <= y1; y++) {
    const dy = (y - .5) * spacing + top - bloom.y;
    for (let x = x0; x <= x1; x++) {
      const dx = (x - .5) * spacing - bloom.x;
      const u = (dx * cos + dy * sin) / bloom.radius, v = (dy * cos - dx * sin) / bloom.radius;
      const turns = Math.atan2(v, u) / TAU, index = (turns - Math.floor(turns)) * outline.length;
      const i = Math.floor(index), fraction = index - i;
      const reach = outline[i] * (1 - fraction) + outline[(i + 1) % outline.length] * fraction;
      const rho = Math.hypot(u, v) / reach, bin = Math.round(binsPerRadius * rho);
      if (bin >= radialBins) continue;
      const cell = y * width + x;
      // All blooms reserve their own painted faces, even when another front
      // crosses them. The bitmap also protects individual florets in a spray.
      const col = Math.floor((u + 1) * .5 * maskSize), row = Math.floor((v + 1) * .5 * maskSize);
      if (col >= 0 && col < maskSize && row >= 0 && row < maskSize)
        paper.free[cell] = Math.min(paper.free[cell], 1 - reserve[row * maskSize + col] / 255);
      paper.rim[cell] = Math.max(paper.rim[cell], 1 - ease(Math.abs(rho - 1) / .24));
      if (rho < .77) continue;
      cells.push(cell);
      bins.push(bin);
    }
  }
  const hex = (bloom.ink ?? forms[bloom.type].tip).slice(1);
  const color = [0, 2, 4].map(i => toLinear(parseInt(hex.slice(i, i + 2), 16)));
  return {
    cells: Uint32Array.from(cells),
    bins: Uint8Array.from(bins),
    profile: new Float32Array(radialBins),
    color
  };
}

function deposit(source, fronts, pigment, strongest) {
  if (!fronts.length) return;
  const {profile, cells, bins, color} = source;
  profile.fill(0);
  for (const wave of fronts) {
    const trail = .17 + .32 * wave.progress, fringe = .10 + .14 * wave.progress;
    const start = Math.max(0, Math.floor((wave.radius - trail) * binsPerRadius));
    const end = Math.min(radialBins - 1, Math.ceil((wave.radius + fringe) * binsPerRadius));
    for (let i = start; i <= end; i++) {
      const distance = i / binsPerRadius, gap = distance - wave.radius;
      const wetEdge = ease((distance - .77) / .20) * (1 - ease((distance - 1.39) / .40));
      const amount = wave.wetness * wetEdge * (1 - ease(Math.abs(gap) / (gap < 0 ? trail : fringe)));
      profile[i] = Math.max(profile[i], amount);
    }
  }
  for (let i = 0; i < cells.length; i++) {
    const amount = profile[bins[i]];
    if (!amount) continue;
    const cell = cells[i], j = cell * 4;
    strongest[cell] = Math.max(strongest[cell], amount);
    for (let ch = 0; ch < 3; ch++) pigment[j + ch] += amount * color[ch];
    pigment[j + 3] += amount;
  }
}

export class WetPaper {
  constructor(w, h, blooms, plates) {
    this.spacing = Math.max(3, w / 184, h / 138);
    this.top = Math.max(0, Math.min(...blooms.map(b => b.y - b.radius * radialRange)) - this.spacing);
    this.width = Math.ceil(w / this.spacing) + 2;
    this.height = Math.ceil((h - this.top) / this.spacing) + 2;
    this.diffusion = (Math.min(w, h) * .012 / this.spacing) ** 2;
    const cells = this.width * this.height;
    this.free = new Float32Array(cells).fill(1);
    this.rim = new Float32Array(cells);
    this.sources = blooms.map(b => footprint(b, this, plates[b.type]));
    this.strongest = new Float32Array(cells);
    this.pigment = new Float32Array(cells * 4);
    this.wet = new Float32Array(cells * 4);
    this.next = new Float32Array(cells * 4);
    this.pixels = new Uint8ClampedArray(cells * 4);
    this.erosion = new Uint8ClampedArray(cells * 4);
    this.fibre = Float32Array.from({length: cells}, (_, i) => {
      const x = i % this.width, y = Math.floor(i / this.width);
      return .60 + .24 * Math.sin(.81 * x + .42 * y) + .16 * Math.cos(.38 * x - .76 * y);
    });
  }
  clear() {
    this.wet.fill(0);
    this.next.fill(0);
    this.pixels.fill(0);
    this.erosion.fill(0);
  }
  step(fronts, dt) {
    const {width, height, wet, next, pigment, pixels, strongest, free, rim, erosion, fibre} = this;
    pigment.fill(0);
    strongest.fill(0);
    this.sources.forEach((source, i) => deposit(source, fronts[i], pigment, strongest));
    const absorb = 1 - Math.exp(-dt / .59), dry = 1 - Math.exp(-dt / 2.05);
    const spread = Math.min(.72, 1 - Math.exp(-4 * this.diffusion * dt)), stride = width * 4;
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const cell = y * width + x, j = cell * 4;
        if (!free[cell]) continue;
        const total = pigment[j + 3], second = total - strongest[cell];
        const contact = .78 * ease(second / .43) * ease(total / .78);
        const gain = contact > wet[j + 3] ? absorb : dry;
        const weight = total > 0 ? contact / total : 0;
        for (let ch = 0; ch < 4; ch++) {
          const k = j + ch;
          const neighbors = (wet[k - 4] + wet[k + 4] + wet[k - stride] + wet[k + stride]) * .25;
          const dispersed = wet[k] + spread * (neighbors - wet[k]);
          const target = ch === 3 ? contact : pigment[k] * weight;
          next[k] = dispersed + gain * (target - dispersed);
        }
        const alpha = next[j + 3], exposed = alpha * free[cell];
        pixels[j + 3] = 255 * exposed;
        // Lift irregular bites from a wet silhouette. The same edge recovers as
        // the two-colour pool dries. An isolated flower can never erode itself.
        erosion[j + 3] = 248 * ease((exposed - .025) / .31) * rim[cell] * fibre[cell];
        if (pixels[j + 3])
          for (let ch = 0; ch < 3; ch++)
            pixels[j + ch] = display[clamp(Math.round(1024 * next[j + ch] / alpha), 0, 1024)];
      }
    this.wet = next;
    this.next = wet;
  }
}

import {clamp, smooth, TAU} from "./geometry.js";
import {drawCorolla} from "./drawCorolla.js";

const ease = value => smooth(clamp(value, 0, 1));
const specimenSize = 352;
const waveSize = specimenSize / 2;

// Two chamfer passes measure distance to the actual petal boundary, including
// the cut-ins between florets. The nearest painted pixel supplies edge colour.
function distanceToRim(data, size) {
  const length = size * size, distance = new Float32Array(length).fill(size),
        nearest = new Int32Array(length);
  for (let p = 0; p < length; p++) {
    nearest[p] = p;
    if (data[4 * p + 3] < 128) continue;
    if (data[4 * (p - 1) + 3] < 128 || data[4 * (p + 1) + 3] < 128 || data[4 * (p - size) + 3] < 128 ||
        data[4 * (p + size) + 3] < 128)
      distance[p] = 0;
  }
  function relax(p, neighbor, step) {
    const trial = distance[neighbor] + step;
    if (trial < distance[p]) {
      distance[p] = trial;
      nearest[p] = nearest[neighbor];
    }
  }
  for (const direction of [1, -1]) {
    for (let y = direction === 1 ? 1 : size - 2; y > 0 && y < size - 1; y += direction) {
      for (let x = direction === 1 ? 1 : size - 2; x > 0 && x < size - 1; x += direction) {
        const p = y * size + x, row = p - direction * size;
        relax(p, p - direction, 1);
        relax(p, row, 1);
        relax(p, row - 1, Math.SQRT2);
        relax(p, row + 1, Math.SQRT2);
      }
    }
  }
  return {distance, nearest};
}

export function makePlates(form, surface) {
  const size = specimenSize, half = size / 2;
  const body = surface(size), ring = surface(waveSize), light = surface(waveSize);
  const paint = body.getContext("2d", {willReadFrequently: true});
  drawCorolla(paint, size, form);
  const original = paint.getImageData(0, 0, size, size).data;
  const {distance, nearest} = distanceToRim(original, size);
  const dye = paint.createImageData(size, size);
  const tip = [1, 3, 5].map(start => parseInt(form.tip.slice(start, start + 2), 16));
  // Keep the drawn lip legible inside a wider, faint wash. Use specimen
  // radii for both bands so the contact reserve follows the same geometry.
  for (let p = 0; p < distance.length; p++) {
    const j = p * 4, inside = original[j + 3] >= 128;
    const d = (inside ? -distance[p] : distance[p]) / half;
    if (d > .14) continue;
    const k = inside ? j : nearest[p] * 4;
    const alpha = .68 * (1 - ease((d + .031) / .066)) + .32 * (1 - ease((d + .065) / .185));
    const feather = .30 * ease((d + .008) / .038);
    for (let ch = 0; ch < 3; ch++)
      dye.data[j + ch] = original[k + ch] + (tip[ch] - original[k + ch]) * feather;
    dye.data[j + 3] = 255 * alpha;
  }
  paint.putImageData(dye, 0, 0);

  // The fronts have broad, soft profiles. Half-resolution fronts keep the
  // decoded set smaller than three full-resolution surfaces per specimen.
  const ink = ring.getContext("2d"), shine = light.getContext("2d");
  const edge = ink.createImageData(waveSize, waveSize), glint = shine.createImageData(waveSize, waveSize);
  for (let y = 0; y < waveSize; y++)
    for (let x = 0; x < waveSize; x++) {
      const p = (2 * y + 1) * size + 2 * x + 1;
      const j = 4 * p, k = 4 * (y * waveSize + x);
      const d = distance[p] / half;
      if (d > .14) continue;
      const front = .72 * Math.exp(-((d / .040) ** 2)) + .25 * Math.exp(-((d / .083) ** 2));
      const seam = original[j + 3] >= 128 ? 1 - .13 * Math.exp(-((d / .022) ** 2)) : 1;
      for (let ch = 0; ch < 3; ch++) edge.data[k + ch] = dye.data[j + ch] * seam;
      glint.data[k] = 255;
      glint.data[k + 1] = 252;
      glint.data[k + 2] = 239;
      edge.data[k + 3] = glint.data[k + 3] = 255 * front;
    }
  ink.putImageData(edge, 0, 0);
  shine.putImageData(glint, 0, 0);

  const maskSize = 64, reserve = new Uint8Array(maskSize * maskSize), outline = new Float32Array(128);
  for (let y = 0; y < maskSize; y++)
    for (let x = 0; x < maskSize; x++) {
      const p = Math.floor((y + .5) * size / maskSize) * size + Math.floor((x + .5) * size / maskSize);
      reserve[y * maskSize + x] =
          original[4 * p + 3] < 128 ? 0 : 255 * ease((distance[p] / half - .007) / .081);
    }
  for (let i = 0; i < outline.length; i++) {
    const a = TAU * i / outline.length, dx = Math.cos(a), dy = Math.sin(a);
    let reach = .18;
    for (let r = 3; r < half - 1; r += 1.5) {
      const p = Math.floor(half + dy * r) * size + Math.floor(half + dx * r);
      if (original[4 * p + 3] >= 128) reach = r / half;
    }
    outline[i] = reach;
  }
  return {body, ring, light, outline, reserve};
}

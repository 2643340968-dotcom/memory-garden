import {clamp, mercator, noise, smooth} from "./geometry.js";

// Four screens share a geographic origin. Every coarser screen is a subset of
// its successor, including its angle, so a dot survives a subdivision in place.
export const INKS = [ "#54b4db", "#a7d976", "#9488c5", "#f87c42" ];
export const BIN_SIZE = 112;
const NATIONAL_WELLS = [
  [ [ 83, 32, 9, 6 ], [ 98, 39, 9, 4 ], [ 109, 26, 9, 5 ], [ 128, 48, 7, 5 ] ],
  [ [ 87, 43, 10, 5 ], [ 101, 30, 8, 5 ], [ 115, 38, 8, 6 ], [ 124, 45, 5, 6 ] ],
  [ [ 84, 37, 5, 2.5 ], [ 106, 32, 5, 3 ], [ 118, 45, 7, 3 ] ],
  [ [ 93, 39, 4, 3 ], [ 103, 27, 4, 3 ], [ 114, 34, 5, 3 ], [ 122, 45, 3, 3 ] ]
].map(group => group.map(([ x, y, rx, ry ]) => [x, mercator(y), rx, ry * 1.23]));
const screens = [ -.27, .22, -.04, .43 ].map(angle => [Math.cos(angle), Math.sin(angle)]);
const gate = v => smooth(clamp(v, 0, 1));

export function printScale(k) {
  const scale = Math.log2(360 * k / 5.6);
  const octave = Math.floor(scale);
  return {step : 360 / 2 ** octave, split : gate(scale - octave)};
}

function countryInk(lon, my, layer) {
  const offset = [ 4, 73, 122, 207 ][layer];
  const n = noise(lon * .19 + offset, my * .19);
  const ox = 2.8 * Math.sin(my * .29 + offset) + 2.1 * (n - .5);
  const oy = 2.8 * Math.sin(lon * .26 - my * .12 + offset);
  let well = 0;
  for (const [x, y, rx, ry] of NATIONAL_WELLS[layer]) {
    const dx = (lon - x + ox) / rx, dy = (my - y + oy) / ry;
    well = Math.max(well, 1 - .39 * (dx * dx + dy * dy));
  }
  const eddy = .5 + .5 * Math.cos(lon * .33 + my * .24 + 4.6 * n + offset);
  const gap = Math.max(0, .53 - noise(lon * .27 + 6, my * .29 - 8));
  return clamp(
      (.66 * well + .43 * n + .16 * noise(lon * .51, my * .51 + offset) + .16 * eddy -
       (layer < 2 ? .50 : .70) - gap * .74) *
          (layer < 2 ? 1.7 : 2.15),
      0, 1);
}

// Neighbourhoods inherit the larger current, with finer eddies resolved as
// the scale increases. The arguments are always ground coordinates.
function localInk(lon, my, frequency, layer) {
  const u = (lon - 105) * frequency, v = (my - 38) * frequency;
  const seed = layer * 17.63;
  const bend = noise(u * .78 + 11.2, v * .83 - 4.3) - .5;
  const shear = noise(u * .89 - 16, v * .71 + 3.4) - .5;
  const x = u + 1.18 * bend, y = v + .95 * shear;
  const island = noise(x * 1.46 + seed, y * 1.56 - seed);
  const stream = .5 + .5 * Math.sin(3.9 * x + 2.4 * y + 6.4 * bend + seed * .8);
  const speck = noise(x * 3.1 - seed, y * 2.9 + 2.7);
  const threshold = [ .22, .26, .45, .54 ][layer];
  return gate((.50 * island + .34 * stream + .16 * speck - threshold) / (layer < 2 ? .54 : .38));
}

function makeInkGrid(camera, w, h, k) {
  const cell = 18;
  const aligned = v => ((v % cell) + cell) % cell - cell;
  const left = aligned(w / 2 + (105 - camera.x) * k), top = aligned(h / 2 + (camera.y - 38) * k);
  const columns = Math.ceil((w - left) / cell) + 1, rows = Math.ceil((h - top) / cell) + 1;
  const values = new Float32Array(columns * rows * 4);
  const detail = gate(Math.log2(k / 19) / 3);
  const octave = Math.log2(Math.max(1, k * 16 / clamp(Math.min(w, h) * .32, 145, 295)));
  const low = Math.floor(octave), freq = 2 ** low / 16, mix = gate(octave - low);
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const lon = camera.x + (left + column * cell - w / 2) / k,
            my = camera.y - (top + row * cell - h / 2) / k;
      const index = (row * columns + column) * 4;
      const opening = f =>
          gate((.59 - noise((lon - 105) * f * 1.22 + 6.75, (my - 38) * f * 1.12 - 2.3)) / .30);
      const paper = detail > 0 ? .77 * ((1 - mix) * opening(freq) + mix * opening(freq * 2)) : 0;
      for (let layer = 0; layer < 4; layer++) {
        let value = detail < 1 ? countryInk(lon, my, layer) : 0;
        if (detail > 0) {
          const a = localInk(lon, my, freq, layer), b = localInk(lon, my, freq * 2, layer);
          value += detail * ((a + (b - a) * mix) * (1 - paper) - value);
        }
        values[index + layer] = value;
      }
    }
  return {values, columns, cell, left, top};
}

// The small feature mask is sampled from actual vector paths. R/G/B encode
// pigment affinity, not display colour. The result is a list of editable
// positions, ink indices and radii; the mask is never displayed.
export function buildImpression(camera, w, h, mask) {
  const k = w / camera.span, {step, split} = printScale(k);
  const half = step / 2, pitch = step * k, radiusFactor = pitch * (1 - .5 * split);
  const grid = makeInkGrid(camera, w, h, k), {columns, values, cell} = grid;
  const maskX = mask.width / w, maskY = mask.height / h, pixels = mask.data;
  const binsAcross = Math.ceil(w / BIN_SIZE);
  const bins = Array.from({length : binsAcross * Math.ceil(h / BIN_SIZE)}, () => []);
  let count = 0;
  const east = w / (2 * k), north = h / (2 * k);
  for (let ink = 0; ink < 4; ink++) {
    const [cs, sn] = screens[ink];
    const midU = ((camera.x - 105) * cs + (camera.y - 38) * sn) / half;
    const midV = (-(camera.x - 105) * sn + (camera.y - 38) * cs) / half;
    const du = (east * Math.abs(cs) + north * Math.abs(sn)) / half;
    const dv = (east * Math.abs(sn) + north * Math.abs(cs)) / half;
    const firstU = Math.floor(midU - du), lastU = Math.ceil(midU + du);
    const firstV = Math.floor(midV - dv), lastV = Math.ceil(midV + dv);
    for (let j = firstV; j <= lastV; j++) {
      for (let i = firstU; i <= lastU; i++) {
        const emerging = (i & 1) || (j & 1);
        if (emerging && split < .035)
          continue;
        const x = w / 2 + ((i - midU) * cs - (j - midV) * sn) * half * k;
        const y = h / 2 - ((i - midU) * sn + (j - midV) * cs) * half * k;
        if (x < 0 || y < 0 || x >= w || y >= h)
          continue;
        const pixel = 4 * (Math.floor(y * maskY) * mask.width + Math.floor(x * maskX));
        const r = pixels[pixel] / 255, g = pixels[pixel + 1] / 255, b = pixels[pixel + 2] / 255;
        const material = ink === 0 ? r : ink === 1 ? g : ink === 2 ? .83 * b + .17 * r : b;
        if (material < .09)
          continue;
        const gx = (x - grid.left) / cell, gy = (y - grid.top) / cell, ix = Math.floor(gx),
              iy = Math.floor(gy);
        const u = gx - ix, v = gy - iy, corner = 4 * (iy * columns + ix) + ink,
              lower = corner + columns * 4;
        const a = values[corner] + (values[corner + 4] - values[corner]) * u;
        const c = values[lower] + (values[lower + 4] - values[lower]) * u;
        const field = a + (c - a) * v;
        const affinity = ink === 0 ? Math.max(0, r - g) :
            ink === 1              ? Math.max(0, g - r) :
                                     Math.max(0, b - g) * .53;
        const mass = clamp(material * (.045 + 1.15 * field) + affinity * .54 - .052, 0, 1);
        const radius = radiusFactor * (.57 * mass) * (emerging ? split : 1);
        if (radius > .26) {
          bins[Math.floor(y / BIN_SIZE) * binsAcross + Math.floor(x / BIN_SIZE)].push(x, y, radius, ink);
          count++;
        }
      }
    }
  }
  const dots = new Float32Array(count * 4), offsets = new Uint32Array(bins.length + 1);
  let at = 0;
  bins.forEach((bin, i) => {
    offsets[i] = at / 4;
    dots.set(bin, at);
    at += bin.length;
  });
  offsets[bins.length] = count;
  return {dots, offsets};
}

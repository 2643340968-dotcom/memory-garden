import {clamp, smooth, TAU} from "./geometry.js";

// The distance is measured against a petal, so each front carries the
// outline of its own corolla as it travels through the other flowers.
export const flowers = [
  {petals:4, reach:.50, width:.29, root:[77,74,179], mid:[111,143,216], tip:[112,205,210], heart:[73,64,170], dye:true},
  {petals:5, reach:.46, width:.33, root:[182,93,152], mid:[235,151,183], tip:[228,183,212], heart:[255,213,134]},
  {petals:9, reach:.49, width:.145, root:[224,131,71], mid:[247,177,96], tip:[250,219,151], heart:[255,224,126], dye:true},
  {petals:5, reach:.44, width:.33, root:[113,143,181], mid:[162,207,181], tip:[194,225,172], heart:[255,249,224]},
  {petals:6, reach:.47, width:.225, root:[109,93,177], mid:[171,150,209], tip:[216,175,213], heart:[166,125,197], dye:true},
  {petals:4, reach:.45, width:.34, root:[71,117,177], mid:[124,187,210], tip:[180,217,218], heart:[243,207,212]},
  {petals:7, reach:.47, width:.17, root:[197,100,122], mid:[242,159,149], tip:[252,200,157], heart:[252,227,168]},
];

const ease = n => smooth(clamp(n, 0, 1));
const mix = (a, b, t) => a + (b - a) * t;
const bell = n => Math.exp(-n * n);

function petalDistance(radius, angle, flower, seed) {
  const step = TAU / flower.petals, index = Math.round(angle / step);
  const local = angle - index * step;
  const direction = index * step;
  const reach = flower.reach * (1 + .045 * Math.cos(2 * direction + seed));
  const axis = radius * Math.cos(local), side = radius * Math.sin(local);
  const width = flower.width * (.83 + .22 * ease(axis));
  return (Math.hypot((axis - .40) / reach, side / width) - 1) * reach;
}

function edgeAt(radius, angle, specimen, seed) {
  return petalDistance(radius, angle, specimen, seed) +
      .012 * Math.sin(angle * 3 + seed + radius * 8) * ease(radius * 3);
}

// Use the painted contour to locate a travelling front in the wet-paper grid.
// Values are distances from the flower centre in units of the stamp radius.
const outlines = new Map();
export function pigmentOutline(type) {
  if (!outlines.has(type)) {
    const radii = new Float32Array(128);
    for (let i = 0; i < radii.length; i++) {
      const angle = i * TAU / radii.length;
      let inside = 0, outside = 1.1;
      for (let j = 0; j < 11; j++) {
        const radius = (inside + outside) * .5;
        if (edgeAt(radius, angle, flowers[type], type) > 0) outside = radius;
        else inside = radius;
      }
      radii[i] = .90 * (inside + outside) * .5;
    }
    outlines.set(type, radii);
  }
  return outlines.get(type);
}

// Bake only the pigment and the soft edge of each specimen. Independent
// petals open at runtime; the fronts have their own ages, positions and dye.
export function makePlates(specimen, seed, surface) {
  const size = 224;
  const body = surface(size), ring = surface(size), petal = surface(size);
  const paint = body.getContext("2d"), ink = ring.getContext("2d");
  const image = paint.createImageData(size, size), front = ink.createImageData(size, size);
  const {root, mid, tip, heart} = specimen;
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const x = (col + .5 - size / 2) / (size * .45);
    const y = (row + .5 - size / 2) / (size * .45);
    const r = Math.hypot(x, y);
    if (r > 1.10) continue;
    const a = Math.atan2(y, x), edge = edgeAt(r, a, specimen, seed);
    const petal = 1 - ease((edge + .092) / .225);
    const mist = bell(Math.max(0, edge) / .18) * (1 - ease((r - .85) / .24));
    const petalLight = ease((r - .13) / .76 + .10 * Math.sin(2 * a + seed));
    const rootColor = ease(r / .53);
    const scale = .19 + .025 * Math.sin(seed);
    const centreEdge = petalDistance(r / scale, a + .45, specimen, seed);
    const centre = specimen.dye ? bell(r / .24) * .9 : (1 - ease((centreEdge + .12) / .48)) * .85;
    const glint = bell(r / .105) * .22;
    const ridge = .43 * bell(edge / .078) + .40 * bell((edge + .065) / .15) + .17 * bell((edge + .16) / .26);
    const crest = .46 * bell((edge - .027) / .080);
    const offset = 4 * (row * size + col);
    for (let ch = 0; ch < 3; ch++) {
      const pigment = mix(mix(root[ch], mid[ch], rootColor), tip[ch], petalLight);
      image.data[offset + ch] = mix(mix(pigment, heart[ch], centre), 255, glint);
      const dye = mix(root[ch], mid[ch], .60 + .14 * Math.sin(a + seed));
      front.data[offset + ch] = mix(dye, mix(tip[ch], 252, .43), crest);
    }
    image.data[offset + 3] = 255 * clamp(.79 * petal + .105 * mist + .11 * centre, 0, 1);
    front.data[offset + 3] = 255 * ridge * (1 - ease((r - .96) / .14));
  }
  paint.putImageData(image, 0, 0);
  ink.putImageData(front, 0, 0);
  const brush = petal.getContext("2d");
  brush.setTransform(size * .45, 0, 0, size * .45, size / 2, size / 2);
  brush.translate(.40, 0);
  brush.scale(specimen.reach, specimen.width * .94);
  const pigment = brush.createRadialGradient(-.24, .04, .06, 0, 0, 1.24);
  for (const [at, rgb, opacity] of [[0, root, .88], [.43, mid, .82], [.69, tip, .66],
                                    [.84, tip, .40], [1, tip, 0]])
    pigment.addColorStop(at, "rgba(" + rgb.join(",") + "," + opacity + ")");
  brush.fillStyle = pigment;
  brush.fillRect(-1.4, -1.4, 2.8, 2.8);
  return {body, ring, petal};
}

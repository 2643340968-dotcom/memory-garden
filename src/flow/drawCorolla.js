import {frostPetals} from "./petalPaper.js";
import {TAU} from "./geometry.js";

// Each blade points along +x. Rounded shoulders, paired lobes and pointed
// bracts give the same small vocabulary very different silhouettes.
export const blades = {
  floret: "M-.03 0Q.19 -.36 .44 -.69C.68 -.98 .90 -.73 1 0C.88 .78 .65 .96 .43 .67Q.17 .33 -.03 0Z",
  spoon: "M-.03 0C.20 -.03 .34 -.28 .47 -.62C.61 -1.05 .86 -1.04 .98 -.43Q1.06 0 .98 .43C.85 1.04 .61 1.05 .47 .62C.32 .26 .18 .04 -.03 0Z",
  oval: "M-.05 0C.12 -.34 .44 -.93 .69 -.95C.94 -.99 1.04 -.42 .99 -.03C1.03 .42 .89 .94 .67 .92C.39 .89 .12 .31 -.05 0Z",
  round: "M-.04 0C.12 -.39 .30 -.91 .60 -.97C.86 -1.02 1.04 -.52 .99 -.16Q.97 0 .99 .16C1.03 .53 .87 1.00 .60 .97C.30 .93 .13 .39 -.04 0Z",
  point: "M-.05 0C.12 -.49 .36 -.94 .59 -.88Q.80 -.81 1.03 0Q.80 .81 .59 .88C.36 .94 .12 .49 -.05 0Z",
  lance: "M-.05 0C.17 -.64 .52 -.98 .72 -.80Q.92 -.61 1.02 0Q.91 .62 .71 .82C.49 1 .15 .61 -.05 0Z",
  cup: "M-.06 0C.12 -.48 .30 -.96 .60 -.99C.80 -1 .94 -.75 .96 -.46Q1.05 -.19 .97 0Q1.05 .20 .96 .49C.89 .86 .80 .99 .58 .98C.33 .95 .12 .46 -.06 0Z",
  fan: "M-.03 0C.12 -.50 .35 -.96 .62 -1C.80 -1.02 .91 -.79 .91 -.55Q1.08 -.42 1 -.15Q1.05 .13 .89 .34C.85 .71 .66 .92 .49 .80Q.19 .64 -.03 0Z",
  notch: "M-.04 0Q.22 -.54 .54 -.84Q.84 -1.01 .95 -.87Q1.05 -.68 .94 -.43Q1.06 -.26 .95 -.04Q1.07 .20 .96 .40Q1.05 .63 .96 .83Q.85 1.03 .55 .85Q.22 .54 -.04 0Z",
  ruffle: "M-.04 0C.13 -.53 .34 -.98 .60 -.99C.88 -1.01 1.06 -.55 .96 -.19Q.88 0 .96 .19C1.06 .55 .88 1.01 .60 .99C.34 .98 .13 .53 -.04 0Z",
  fold: "M-.10 .03C.03 -.56 .34 -1.08 .65 -.98C.94 -1.01 1.05 -.61 .98 -.31C.91 .32 .57 .68 .18 .87Q.31 .55 .29 .31Q.20 .07 -.10 .03Z",
  curl: "M-.06 .01C.18 -.57 .42 -.95 .65 -.93C.94 -.99 1.05 -.49 .95 -.18Q.82 .27 .64 .47Q.34 .88 .16 .66Q.09 .48 -.06 .01Z",
  bract: "M-.04 0C.11 -.51 .33 -.89 .54 -.93Q.77 -.90 1.04 -.03Q1.07 0 1.04 .03Q.77 .90 .54 .93C.33 .89 .11 .51 -.04 0Z",
  calyx: "M-.04 0Q.20 -.45 .49 -.81Q.57 -.89 .64 -.67L1.04 0L.64 .67Q.57 .89 .49 .81Q.20 .45 -.04 0Z",
  keel: "M-.03 0Q.22 -.10 .50 -.52Q.83 -1.05 1.05 -.87Q1.05 -.28 .78 .11Q.50 .70 .26 .68Q.08 .57 -.03 0Z",
};

const layerCache = new WeakMap();
function makeLayer(layer) {
  const cached = layerCache.get(layer);
  if (cached) return cached;
  const all = new Path2D(), petals = [], step = TAU / layer.petals;
  const angle = layer.rotation * Math.PI / 180, length = layer.length;
  if (layer.shape === "mouth") {
    const at = (a, r) => [length * r * Math.cos(a), length * r * Math.sin(a)];
    all.moveTo(...at(angle - step / 2, .73));
    for (let i = 0; i < layer.petals; i++) {
      const a = angle + i * step;
      all.bezierCurveTo(...at(a - .33 * step, 1.18), ...at(a + .33 * step, 1.18), ...at(a + step / 2, .73));
    }
    all.closePath();
  } else {
    const blade = new Path2D(blades[layer.shape]);
    for (let i = 0; i < layer.petals; i++) {
      const a = angle + i * step, c = Math.cos(a), s = Math.sin(a);
      const shape = new Path2D();
      shape.addPath(blade, new DOMMatrix([length * c, length * s, -layer.width * s, layer.width * c, 0, 0]));
      all.addPath(shape);
      petals.push({shape, c, s});
    }
  }
  const geometry = {all, petals};
  layerCache.set(layer, geometry);
  return geometry;
}

// The outside circle is fixed on the plate. Only the small circle of the
// two-circle radial gradient moves, carrying the light through the pigment.
function petalInk(ctx, form, length, cx, cy, fx, fy) {
  const ink = ctx.createRadialGradient(fx, fy, .07 * length, cx, cy, 1.02 * length);
  ink.addColorStop(0, form.root);
  ink.addColorStop(.15, form.root);
  ink.addColorStop(.48, form.mid);
  ink.addColorStop(.88, form.tip);
  ink.addColorStop(1, form.tip);
  return ink;
}

function paintWhorl(ctx, form, layer, focusX, focusY) {
  const {all, petals} = makeLayer(layer), l = layer.length;
  const dx = focusX * .53, dy = focusY * .53;
  if (!petals.length) {
    ctx.fillStyle = petalInk(ctx, form, l, 0, 0, (-.16 + dx) * l, (.13 + dy) * l);
    ctx.fill(all);
  } else {
    const fillPetal = ({shape, c, s}) => {
      const cx = (.24 * c - .065 * s) * l, cy = (.24 * s + .065 * c) * l;
      const fx = (.38 * c - .12 * s + dx - .065) * l;
      const fy = (.38 * s + .12 * c + dy - .055) * l;
      ctx.fillStyle = petalInk(ctx, form, l, cx, cy, fx, fy);
      ctx.fill(shape);
    };
    petals.forEach(fillPetal);
    if (petals.length > 2) {
      ctx.save();
      ctx.clip(petals.at(-1).shape);
      fillPetal(petals[0]);
      ctx.restore();
    }
  }
  // Daylight is shared by the whole whorl. The upper lips catch apricot
  // light while the lower scallops hold a cooler, more saturated ink.
  const hem = ctx.createLinearGradient(-.10 * l, -l, .16 * l, l);
  hem.addColorStop(0, "#fff2da28");
  hem.addColorStop(.36, "#fff2da00");
  hem.addColorStop(.54, form.hem + "00");
  hem.addColorStop(1, form.hem + "3d");
  ctx.fillStyle = hem;
  ctx.fill(all);
}

const cream = "#fff5d4";
const eye = "M0 -.98Q.11 -.31 .99 0Q.19 .26 0 .98Q-.23 .29 -.99 0Q-.23 -.35 0 -.98Z";
const seed = "M0 -1C.52 -.71 .69 -.19 .54 .24Q.35 .73 0 1Q-.39 .67 -.52 .22C-.66 -.22 -.44 -.76 0 -1Z";
const sepal = "M-.99 0Q-.22 -.47 .15 -.43Q.69 -.33 1 0Q.54 .42 .09 .43Q-.40 .36 -.99 0Z";
const bud = "M0 -1C.46 -.87 .96 -.49 .96 -.02C.96 .48 .45 .79 0 1C-.51 .79 -.96 .48 -.96 -.02C-.96 -.49 -.46 -.87 0 -1Z";
const symbols = new Map();
function glyph(ctx, d, x, y, w, h, angle, ink) {
  if (!symbols.has(d)) symbols.set(d, new Path2D(d));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(w, h);
  ctx.fillStyle = ink;
  ctx.fill(symbols.get(d));
  ctx.restore();
}
function dot(ctx, x, y, r, ink) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
}
function seedRing(ctx, count, radius, size, ink, angle = 0) {
  for (let i = 0; i < count; i++) {
    const a = angle + TAU * i / count;
    glyph(ctx, seed, radius * Math.cos(a), radius * Math.sin(a), size * .65, size, a + Math.PI / 2, ink);
  }
}

function paintCentre(ctx, form) {
  const ink = form.heart;
  switch (form.centre) {
    case "pod":
      glyph(ctx, bud, 0, 0, .144, .144, .23, ink);
      seedRing(ctx, 6, .067, .020, cream);
      dot(ctx, 0, 0, .019, cream);
      break;
    case "disc":
      dot(ctx, 0, 0, .155, ink);
      seedRing(ctx, 9, .093, .024, "#ffe7a6");
      glyph(ctx, eye, 0, 0, .052, .052, .2, "#fff0bb");
      break;
    case "coil":
      glyph(ctx, bud, -.012, .008, .114, .072, -.59, ink);
      glyph(ctx, sepal, .01, -.003, .084, .049, -.62, form.mid);
      break;
    case "throat":
      glyph(ctx, bud, -.026, .011, .19, .112, -.63, form.hem + "c2");
      glyph(ctx, seed, .012, .04, .048, .104, .96, cream);
      break;
    case "column":
      glyph(ctx, seed, .018, -.09, .047, .18, .23, "#fff0bd");
      glyph(ctx, eye, .054, -.215, .079, .072, .23, ink);
      break;
    case "base":
      glyph(ctx, sepal, 0, 0, .135, .12, -.6, "#9ccbb4");
      break;
    case "bracts":
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 - Math.PI / 2, x = .11 * Math.cos(a), y = .11 * Math.sin(a);
        ctx.save();
        ctx.translate(x, y);
        seedRing(ctx, 5, .041, .059, cream, a);
        glyph(ctx, eye, 0, 0, .041, .044, a, ink);
        ctx.restore();
      }
      break;
    case "eye":
      glyph(ctx, eye, 0, 0, .17, .17, 0, cream);
      glyph(ctx, bud, 0, 0, .058, .058, 0, ink);
      break;
    case "cross":
      glyph(ctx, eye, 0, 0, .16, .16, 0, cream);
      seedRing(ctx, 4, .071, .035, ink, Math.PI / 4);
      break;
    case "six":
      seedRing(ctx, 6, .142, .061, ink, Math.PI / 6);
      glyph(ctx, bud, 0, 0, .068, .068, 0, cream);
      break;
    case "brush":
      seedRing(ctx, 12, .155, .047, ink, .12);
      seedRing(ctx, 6, .073, .033, "#e8ba72");
      glyph(ctx, eye, 0, 0, .042, .042, 0, cream);
      break;
    case "bundles":
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(i * TAU / 5);
        glyph(ctx, seed, .145, -.032, .029, .083, 1.04, ink);
        glyph(ctx, seed, .164, .029, .029, .067, 1.82, ink);
        ctx.restore();
      }
      glyph(ctx, eye, 0, 0, .068, .068, 0, cream);
      break;
    case "threads":
      seedRing(ctx, 10, .144, .033, ink);
      glyph(ctx, eye, 0, 0, .071, .071, Math.PI / 4, ink);
      break;
    default:
      glyph(ctx, bud, 0, 0, .134, .134, Math.PI / 4, cream);
      glyph(ctx, eye, 0, 0, .108, .108, form.centre === "button" ? .78 : 0, ink);
  }
}

export function drawCorolla(ctx, size, form, focusX = 0, focusY = 0) {
  const unit = size * .416;
  ctx.save();
  ctx.setTransform(unit, 0, 0, unit, size / 2, size / 2);
  if (form.centre === "base") {
    ctx.beginPath();
    ctx.moveTo(-.31, .78);
    ctx.quadraticCurveTo(.06, .06, .20, -.59);
    ctx.lineWidth = .033;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#9dcfb8";
    ctx.stroke();
  }
  for (const [x, y, scale, angle] of form.florets ?? [[0, 0, 1, 0]]) {
    const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = (focusX * c + focusY * s) / Math.sqrt(scale);
    const dy = (focusY * c - focusX * s) / Math.sqrt(scale);
    const gain = 1 / Math.max(1, Math.hypot(dx, dy));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(scale, form.centre === "throat" ? scale * .87 : scale);
    for (const layer of form.whorls) paintWhorl(ctx, form, layer, dx * gain, dy * gain);
    paintCentre(ctx, form);
    ctx.restore();
  }
  ctx.restore();
  frostPetals(ctx, size);
}

import {clamp, smooth, TAU} from "./geometry.js";

// All petal paths are drawn from the attachment at (0,0) to the tip at
// (1,0). Width, colour, whorl angle and the floret arrangement belong to
// the species. A bract, a forked ray and a rolled rose petal stay distinct.
const shapes = {
  spoon:
      "M0 0C.22 -.15 .38 -.52 .58 -.84C.87 -1.32 1.08 -.72 .99 .05C1.01 .83 .81 1.15 .61 .86C.39 .59 .23 .14 0 0Z",
  oval: "M0 0C.21 -.48 .53 -1.18 .79 -.92C1.12 -.70 1.08 .62 .79 .92C.51 1.15 .18 .56 0 0Z",
  round: "M0 0C.14 -.73 .54 -1.16 .79 -.94C1.12 -.72 1.10 .60 .84 .87C.58 1.22 .23 .89 0 0Z",
  point:
      "M0 0C.18 -.47 .42 -1.09 .62 -.82C.82 -.58 .94 -.19 1.05 0C.87 .17 .79 .68 .57 .88C.32 1.04 .14 .44 0 0Z",
  cup:
      "M0 0C.17 -.71 .58 -1.15 .90 -.72C1.02 -.46 1.01 -.19 1 .04C1.02 .37 .92 .76 .78 .88C.45 1.05 .14 .56 0 0Z",
  fan:
      "M0 0C.16 -.60 .54 -1.10 .81 -.94C.94 -.86 1.00 -.57 .95 -.44C1.04 -.28 1.02 -.08 .98 .02C1.07 .30 .95 .61 .78 .76C.51 1.09 .23 .59 0 0Z",
  notch:
      "M0 0C.19 -.26 .47 -.79 .77 -.96Q.94 -1.01 .99 -.76Q.92 -.52 .93 -.40Q1.01 -.26 1.03 -.13Q.93 .01 .92 .13Q1.01 .32 1 .43Q.92 .49 .92 .64Q1 .85 .87 .94C.55 1.0 .20 .38 0 0Z",
  ruffle:
      "M0 0C.23 -.69 .40 -1.07 .67 -.93Q.75 -1.17 .86 -.87Q1.02 -.90 .95 -.54Q1.08 -.36 .98 -.12Q1.05 .11 .99 .24Q1.05 .57 .89 .69Q.90 1.02 .72 .88Q.55 1.11 .44 .84C.22 .75 .11 .32 0 0Z",
  fold:
      "M0 0C.12 -.85 .54 -1.29 .88 -.84C1.09 -.52 1.03 -.06 .88 .22C.74 .56 .48 .95 .20 1.01C.38 .56 .36 .19 0 0Z",
  curl:
      "M0 0C.14 -.55 .44 -.93 .73 -.91C1.03 -1.05 1.09 -.54 .97 -.27C.83 .02 .80 .64 .55 .84C.32 1.00 .10 .48 0 0Z",
  bract:
      "M0 0C.09 -.81 .49 -1.11 .75 -.68C.87 -.43 .94 -.13 1.08 -.09C.90 .19 .85 .68 .63 .88C.38 1.11 .10 .78 0 0Z",
  keel: "M0 0C.26 -.10 .73 -1.13 1.07 -.99C.96 -.22 .71 .81 .39 .74C.15 .70 .03 .30 0 0Z",
  mouth:
      "M0 0C.08 -.69 .54 -1.18 .83 -.94C1.08 -.75 1.07 -.17 .91 .11C1.11 .53 .86 .95 .56 .95C.32 .96 .09 .53 0 0Z",
};
const paths = new Map();
const ease = value => smooth(clamp(value, 0, 1));
const radians = degrees => degrees * Math.PI / 180;

function petal(ctx, form, layer, i, seed) {
  let path = paths.get(layer.shape);
  if (!path) {
    path = new Path2D(shapes[layer.shape]);
    paths.set(layer.shape, path);
  }
  const phase = Math.sin(seed + i * 2.39);
  ctx.save();
  ctx.rotate(radians(layer.rotation) + TAU * i / layer.petals + .035 * phase);
  ctx.scale(layer.length * (1 + .035 * phase), layer.width * (1 - .06 * phase));
  const wash = ctx.createLinearGradient(.01, -.22, 1, .22);
  wash.addColorStop(0, form.root);
  wash.addColorStop(.42, form.mid);
  wash.addColorStop(1, form.tip);
  ctx.fillStyle = wash;
  ctx.fill(path);
  // A light fold gives overlapping faces depth without grey shadows.
  ctx.clip(path);
  const fold = ctx.createRadialGradient(.64, -.60, .04, .64, -.60, .95);
  fold.addColorStop(0, "rgba(255,250,240,.39)");
  fold.addColorStop(1, "rgba(255,250,240,0)");
  ctx.fillStyle = fold;
  ctx.fillRect(0, -1.35, 1.14, 2.7);
  if (layer.shape === "bract" || layer.shape === "point" || layer.shape === "notch") {
    ctx.strokeStyle = "rgba(255,251,235,.37)";
    ctx.lineWidth = .017;
    ctx.beginPath();
    ctx.moveTo(.12, 0);
    ctx.quadraticCurveTo(.54, -.09, .86, -.02);
    ctx.stroke();
  }
  ctx.restore();
}

function dot(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function centre(ctx, form, seed) {
  const style = form.centre;
  if (style === "coil" || style === "base") return;
  if (style === "bracts") {
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(i * TAU / 3);
      ctx.translate(.10, 0);
      for (let j = 0; j < 5; j++)
        dot(ctx, .036 * Math.cos(j * TAU / 5), .036 * Math.sin(j * TAU / 5), .035, "#fff9dd");
      dot(ctx, 0, 0, .021, form.heart);
      ctx.restore();
    }
    return;
  }
  if (style === "eye" || style === "throat") {
    const r = style === "throat" ? .26 : .11;
    ctx.save();
    if (style === "throat") {
      ctx.rotate(-.58);
      ctx.translate(-.045, 0);
      ctx.scale(1.25, .68);
    }
    const hollow = ctx.createRadialGradient(-.026, .014, 0, 0, 0, r);
    hollow.addColorStop(0, style === "throat" ? form.root : form.heart);
    hollow.addColorStop(.47, style === "throat" ? form.root : form.heart);
    hollow.addColorStop(1, "rgba(255,246,215,0)");
    dot(ctx, 0, 0, r, hollow);
    if (style === "throat") dot(ctx, .07, -.075, .035, form.heart);
    ctx.restore();
    return;
  }
  const brush = style === "brush", threads = style === "threads";
  const count =
      {cross: 6, six: 6, column: 22, pod: 23, disc: 32, threads: 17, brush: 46, pollen: 26}[style];
  const radius = brush ? .26 : threads ? .21 : style === "disc" ? .17 : style === "cross" ? .083 : .15;
  if (style === "disc" || style === "pod") dot(ctx, 0, 0, radius * .88, form.heart);
  for (let i = 0; i < count; i++) {
    const spread = Math.sqrt((i + .6) / count);
    const angle = i * 2.39996 + seed,
          reach = radius * (threads || style === "six" ? .72 + .28 * spread : spread);
    const x = reach * Math.cos(angle), y = reach * Math.sin(angle);
    if (threads || brush || style === "column") {
      ctx.beginPath();
      ctx.moveTo(x * .28, y * .28);
      ctx.lineTo(x, y);
      ctx.lineWidth = .008;
      ctx.strokeStyle = "rgba(255,239,179,.8)";
      ctx.stroke();
    }
    dot(ctx, x, y, style === "cross" ? .026 : .019 + .008 * Math.cos(i), i % 4 ? form.heart : "#fff1bc");
  }
  if (style === "pod") {
    dot(ctx, 0, 0, .108, "#c0c992");
    for (let i = 0; i < 6; i++)
      dot(ctx, .063 * Math.cos(i * TAU / 6), .063 * Math.sin(i * TAU / 6), .012, "#eef0bb");
  }
}

function paintCrown(ctx, form, seed) {
  if (form.centre === "base") {
    ctx.beginPath();
    ctx.moveTo(-.31, .62);
    ctx.quadraticCurveTo(.16, .03, .23, -.57);
    ctx.lineWidth = .024;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#c8a78d";
    ctx.stroke();
  }
  for (const [x, y, scale, angle] of form.florets ?? [[0, 0, 1, 0]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(radians(angle));
    for (const [index, layer] of form.whorls.entries())
      for (let i = 0; i < layer.petals; i++) petal(ctx, form, layer, i, seed + index * 2.17 + x * 3);
    centre(ctx, form, seed);
    ctx.restore();
  }
}

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

export function makePlates(form, seed, surface) {
  const size = 272, half = size / 2, unit = size * .416;
  const body = surface(size), ring = surface(size), light = surface(size);
  const paint = body.getContext("2d", {willReadFrequently: true});
  paint.setTransform(unit, 0, 0, unit, half, half);
  paintCrown(paint, form, seed);
  const original = paint.getImageData(0, 0, size, size).data;
  const {distance, nearest} = distanceToRim(original, size);
  const dye = paint.createImageData(size, size), edge = paint.createImageData(size, size),
        glint = paint.createImageData(size, size);
  const maskSize = 64, reserve = new Uint8Array(maskSize * maskSize), outline = new Float32Array(128);
  const tip = [1, 3, 5].map(start => parseInt(form.tip.slice(start, start + 2), 16));
  for (let p = 0; p < size * size; p++) {
    const j = p * 4, inside = original[j + 3] >= 128;
    const d = inside ? -distance[p] : distance[p];
    if (d > 18) continue;
    const k = inside ? j : nearest[p] * 4;
    const alpha = 1 - ease((d + 9) / 22);
    const front = Math.exp(-((d / 5.8) ** 2)) * .73 + Math.exp(-((d / 11.5) ** 2)) * .24;
    const seam = inside ? 1 - .17 * Math.exp(-((d / 2.8) ** 2)) : 1;
    const feather = .80 * ease((d + 6) / 12);
    for (let ch = 0; ch < 3; ch++) {
      const color = original[k + ch] + (tip[ch] - original[k + ch]) * feather;
      dye.data[j + ch] = color;
      edge.data[j + ch] = color * seam;
    }
    glint.data[j] = 255;
    glint.data[j + 1] = 252;
    glint.data[j + 2] = 239;
    dye.data[j + 3] = 255 * alpha;
    edge.data[j + 3] = glint.data[j + 3] = 255 * front;
  }
  for (let y = 0; y < maskSize; y++)
    for (let x = 0; x < maskSize; x++) {
      const p = Math.floor((y + .5) * size / maskSize) * size + Math.floor((x + .5) * size / maskSize);
      reserve[y * maskSize + x] = original[4 * p + 3] < 128 ? 0 : 255 * ease((distance[p] - 1) / 11);
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
  paint.putImageData(dye, 0, 0);
  ring.getContext("2d").putImageData(edge, 0, 0);
  light.getContext("2d").putImageData(glint, 0, 0);
  return {body, ring, light, outline, reserve};
}

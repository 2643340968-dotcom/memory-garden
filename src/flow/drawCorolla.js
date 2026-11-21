import {TAU} from "./geometry.js";

// A blade grows along x from 0 to 1. Its two sides are measured in petal
// half-widths. Shoulders, notches and tips use the same geometry at every size.
const blades = {
  floret: [
    "M0 0Q.18 -.44 .49 -.77Q.71 -.98 .88 -.55L.98 -.12Q1.03 0 .98 .12L.88 .55Q.71 .98 .49 .77Q.18 .44 0 0Z",
    "silk"
  ],
  spoon: [
    "M0 0Q.25 -.06 .38 -.38C.49 -.71 .59 -.96 .74 -.96C.90 -.96 1 -.56 1 0C1 .56 .90 .96 .74 .96C.59 .96 .49 .71 .38 .38Q.25 .06 0 0Z",
    "silk"
  ],
  oval: [
    "M0 0Q.20 -.34 .39 -.72C.62 -1.16 .89 -.91 .98 -.35Q1.03 0 .98 .35C.89 .91 .62 1.16 .39 .72Q.20 .34 0 0Z",
    "silk"
  ],
  round: [
    "M0 0Q.17 -.07 .25 -.46C.35 -.98 .66 -1.12 .86 -.76C1.05 -.43 1.05 .43 .86 .76C.66 1.12 .35 .98 .25 .46Q.17 .07 0 0Z",
    "silk"
  ],
  point: ["M0 0Q.23 -.66 .53 -.90Q.59 -.93 .66 -.78L1.04 0L.66 .78Q.59 .93 .53 .90Q.23 .66 0 0Z", "keel"],
  lance: ["M0 0Q.30 -.57 .59 -.84Q.70 -.91 .78 -.64L1.02 0L.78 .64Q.70 .91 .59 .84Q.30 .57 0 0Z", "keel"],
  cup: [
    "M0 0Q.27 -.75 .59 -.92Q.76 -1 .88 -.65L.97 -.33Q1.04 0 .97 .33L.88 .65Q.76 1 .59 .92Q.27 .75 0 0Z",
    "silk"
  ],
  fan: [
    "M0 0Q.25 -.60 .56 -.92Q.73 -1.08 .87 -.78Q1.03 -.57 1.00 -.24Q1.05 .08 .92 .32Q.86 .68 .65 .80Q.35 .91 0 0Z",
    "fan"
  ],
  notch: [
    "M0 0L.73 -.89Q.89 -1.03 .98 -.90L.92 -.51L1.02 -.27L.95 0L1.02 .27L.92 .51L.98 .90Q.89 1.03 .73 .89Z",
    "fan"
  ],
  ruffle: [
    "M0 0Q.26 -.57 .57 -.90Q.76 -1.08 .85 -.70Q1.00 -.74 .98 -.32Q1.09 0 .98 .32Q1 .74 .85 .70Q.76 1.08 .57 .90Q.26 .57 0 0Z",
    "flute"
  ],
  fold: [
    "M0 0C.16 -.66 .44 -1.08 .77 -.92Q1.05 -.77 .99 -.35C.93 .11 .62 .57 .18 .88Q.36 .43 .33 .20Q.20 .01 0 0Z",
    "roll"
  ],
  curl: [
    "M0 0Q.30 -.62 .61 -.91Q.86 -1.03 .99 -.58Q1.05 -.32 .91 -.09L.69 .48Q.51 .91 .35 .76Q.13 .53 0 0Z",
    "roll"
  ],
  bract: [
    "M0 0Q.19 -.58 .46 -.87Q.57 -1 .66 -.83L1.06 -.04Q1.10 0 1.05 .04L.64 .83Q.53 1.03 .39 .78Q.12 .44 0 0Z",
    "keel"
  ],
  calyx: ["M0 0L.47 -.82Q.53 -.93 .59 -.78L1.04 0L.59 .78Q.53 .93 .47 .82Z", "keel"],
  keel: [
    "M0 0Q.28 -.13 .55 -.55Q.83 -1.00 1.04 -1.00Q.98 -.45 .76 -.01Q.51 .62 .26 .64Q.12 .55 0 0Z", "roll"
  ],
};

// Each fold occupies a bounded part of the face. The main wash shows
// through the rest, including when travelling light crosses the specimen.
const folds = {
  silk: "M.13 0Q.47 -.08 .86 -.37Q.67 -.19 .54 -.07Q.34 .035 .13 0Z",
  keel: "M.07 0Q.56 -.06 1.06 0L.70 -.83L.40 -.78Z",
  fan: "M.08 0Q.47 -.17 .99 -.54L.79 -.94Q.38 -.45 .08 0Z",
  flute: "M.08 0Q.50 -.23 .99 -.38Q.80 -.33 .69 -.62Q.46 -.38 .08 0Z",
  roll: "M.15 .81Q.70 .55 .98 -.41Q.94 .11 .72 .40Q.47 .73 .15 .81Z",
};
const ridge = "M.12 0Q.53 -.075 .94 -.02Q.54 -.025 .12 0Z";
const fluting = "M.12 0Q.50 .19 .88 .54Q.57 .30 .12 0Z";
const paths = new Map();
function path(d) {
  if (!paths.has(d)) paths.set(d, new Path2D(d));
  return paths.get(d);
}

function placePetal(ctx, layer, index) {
  ctx.rotate(layer.rotation * Math.PI / 180 + TAU * index / layer.petals);
  ctx.scale(layer.length, layer.width);
}

function paintPetal(ctx, form, layer, index, blade, fold) {
  ctx.save();
  placePetal(ctx, layer, index);
  ctx.clip(blade);
  const pigment = ctx.createLinearGradient(.04, -.16, 1.03, .20);
  pigment.addColorStop(0, form.root);
  pigment.addColorStop(.54, form.mid);
  pigment.addColorStop(1, form.tip);
  ctx.fillStyle = pigment;
  ctx.fillRect(-.08, -1.18, 1.25, 2.36);

  const reflected = ctx.createRadialGradient(.58, -.30, .08, .53, -.12, 1.20);
  reflected.addColorStop(0, "rgba(255,250,242,.32)");
  reflected.addColorStop(.62, "rgba(255,250,242,.21)");
  reflected.addColorStop(1, "rgba(255,250,242,.11)");
  ctx.fillStyle = reflected;
  ctx.fillRect(-.08, -1.18, 1.25, 2.36);
  const light = ctx.createLinearGradient(.30, -.90, .74, .48);
  light.addColorStop(0, form.tip + "89");
  light.addColorStop(.62, "#fff8ec32");
  light.addColorStop(1, form.tip + "02");
  ctx.fillStyle = light;
  ctx.fill(path(folds[fold]));
  if (fold === "keel" || fold === "fan") {
    ctx.fillStyle = "#fff8e665";
    ctx.fill(path(fold === "keel" ? ridge : fluting));
  }
  ctx.restore();
}

function paintWhorl(ctx, form, layer) {
  if (layer.shape === "mouth") {
    paintTrumpet(ctx, form, layer);
    return;
  }
  const [outline, fold] = blades[layer.shape], blade = path(outline);
  for (let i = 0; i < layer.petals; i++) paintPetal(ctx, form, layer, i, blade, fold);
  // Close the weave: the first petal overlaps the last by the same amount
  // as every other neighbour. Repaint just their common area.
  if (layer.petals > 2) {
    ctx.save();
    const base = ctx.getTransform();
    placePetal(ctx, layer, layer.petals - 1);
    ctx.clip(blade);
    ctx.setTransform(base);
    paintPetal(ctx, form, layer, 0, blade, fold);
    ctx.restore();
  }
}

// Jacaranda has a fused mouth. Join the five arcs before painting so that
// the throat sits inside one tube and the folds end at the lip.
function paintTrumpet(ctx, form, layer) {
  const rim = new Path2D(), step = TAU / layer.petals;
  const polar = (angle, radius) => [Math.cos(angle) * radius, Math.sin(angle) * radius];
  rim.moveTo(...polar(-step / 2, .72));
  for (let i = 0; i < layer.petals; i++) {
    const axis = i * step;
    rim.bezierCurveTo(
        ...polar(axis - .34 * step, 1.16), ...polar(axis + .34 * step, 1.16),
        ...polar(axis + step / 2, .72));
  }
  rim.closePath();
  ctx.save();
  ctx.rotate(layer.rotation * Math.PI / 180);
  ctx.scale(layer.length, layer.length);
  ctx.clip(rim);
  const tube = ctx.createRadialGradient(-.15, .08, .03, 0, 0, 1);
  tube.addColorStop(0, form.root);
  tube.addColorStop(.42, form.mid);
  tube.addColorStop(1, form.tip);
  ctx.fillStyle = tube;
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
  const reflected = ctx.createLinearGradient(-.55, -.78, .64, .70);
  reflected.addColorStop(0, "#fff9f547");
  reflected.addColorStop(1, "#f6f0ff18");
  ctx.fillStyle = reflected;
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
  ctx.fillStyle = "#fffaed48";
  for (let i = 0; i < layer.petals; i++) {
    ctx.fill(path("M.55 -.29Q.93 -.24 .94 .05Q.93 .23 .72 .33Q.88 .22 .87 .04Q.86 -.16 .55 -.29Z"));
    ctx.rotate(step);
  }
  ctx.restore();
}

function ellipse(ctx, x, y, a, b, color, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, a, b, angle, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function beads(ctx, count, reach, size, color, angle = 0) {
  for (let i = 0; i < count; i++) {
    const a = angle + i * TAU / count;
    ellipse(ctx, reach * Math.cos(a), reach * Math.sin(a), size, size, color);
  }
}

function stamens(ctx, form, count, reach, angle, size) {
  ctx.save();
  ctx.rotate(angle);
  ctx.lineWidth = .009;
  ctx.strokeStyle = form.heart + "d6";
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.moveTo(.024, 0);
    ctx.quadraticCurveTo(reach * .58, -.022, reach, 0);
    ctx.stroke();
    ellipse(ctx, reach, 0, size * 1.30, size * .70, form.heart, .36);
    ctx.rotate(TAU / count);
  }
  ctx.restore();
}

function paintCentre(ctx, form) {
  const cream = "#fff3c5";
  switch (form.centre) {
    case "coil":
      ctx.fillStyle = form.tip;
      ctx.fill(path(
          "M-.11 .045Q-.14 -.061 -.040 -.094Q.070 -.125 .105 -.026Q.033 -.089 -.043 -.051Q-.088 -.029 -.062 .019Q-.014 .049 .044 .008Q-.014 .091 -.11 .045Z"));
      break;
    case "base":
      ellipse(ctx, 0, 0, .095, .061, form.root, -.45);
      break;
    case "bracts":
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(-Math.PI / 2 + i * TAU / 3);
        ctx.translate(.105, 0);
        beads(ctx, 5, .035, .027, "#fff8df");
        ellipse(ctx, 0, 0, .023, .023, form.heart);
        ctx.restore();
      }
      break;
    case "eye":
      ellipse(ctx, 0, 0, .084, .084, form.root);
      beads(ctx, 4, .030, .024, form.heart, Math.PI / 4);
      break;
    case "throat": {
      ctx.save();
      ctx.translate(-.06, .015);
      ctx.rotate(-.55);
      ctx.scale(1.25, .72);
      const throat = ctx.createRadialGradient(-.09, 0, .02, 0, 0, .33);
      throat.addColorStop(0, form.root);
      throat.addColorStop(.45, form.root + "c4");
      throat.addColorStop(1, form.root + "00");
      ellipse(ctx, 0, 0, .33, .33, throat);
      ctx.fillStyle = form.heart;
      ctx.fill(path("M-.13 .07Q.02 .025 .19 .085Q.10 .11 -.02 .11Q-.10 .11 -.13 .07Z"));
      ctx.restore();
      break;
    }
    case "column":
      ctx.beginPath();
      ctx.moveTo(0, .06);
      ctx.quadraticCurveTo(-.02, -.01, .048, -.14);
      ctx.strokeStyle = "#ffe9ba";
      ctx.lineWidth = .041;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.save();
      ctx.translate(.048, -.14);
      beads(ctx, 5, .053, .030, form.heart, -Math.PI / 2);
      ctx.restore();
      break;
    case "bundles":
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(i * TAU / 5);
        ctx.lineWidth = .014;
        ctx.strokeStyle = "#ffdfae";
        for (const [x, y] of [[.16, -.062], [.213, -.021], [.190, .036], [.136, .066]]) {
          ctx.beginPath();
          ctx.moveTo(.04, 0);
          ctx.quadraticCurveTo(.10, y * .27, x, y);
          ctx.stroke();
          ellipse(ctx, x, y, .028, .015, form.heart, .26 + y * 4);
        }
        ctx.restore();
      }
      ellipse(ctx, 0, 0, .030, .030, cream);
      break;
    case "disc":
      ellipse(ctx, 0, 0, .154, .154, form.heart);
      beads(ctx, 15, .116, .018, "#ffe39b");
      beads(ctx, 8, .067, .017, "#ffe9a4", Math.PI / 8);
      ellipse(ctx, 0, 0, .036, .036, "#ffda70");
      break;
    case "pod":
      stamens(ctx, form, 18, .194, 0, .018);
      ellipse(ctx, 0, 0, .140, .140, "#acbe87");
      ellipse(ctx, -.008, -.008, .123, .123, "#ccda9d");
      beads(ctx, 6, .072, .018, "#9eaf70", Math.PI / 6);
      ellipse(ctx, 0, 0, .016, .016, "#a2b578");
      break;
    case "cross":
      stamens(ctx, form, 4, .113, Math.PI / 4, .026);
      stamens(ctx, form, 2, .071, 0, .021);
      ellipse(ctx, 0, 0, .032, .032, "#f2edaf");
      break;
    case "six":
      stamens(ctx, form, 6, .173, Math.PI / 6, .030);
      beads(ctx, 3, .032, .024, cream, -Math.PI / 2);
      break;
    case "threads":
      stamens(ctx, form, 12, .21, Math.PI / 12, .019);
      stamens(ctx, form, 6, .126, 0, .019);
      ellipse(ctx, 0, 0, .029, .029, cream);
      break;
    case "brush":
      stamens(ctx, form, 19, .245, 0, .022);
      stamens(ctx, form, 13, .167, Math.PI / 13, .023);
      beads(ctx, 7, .083, .022, cream);
      break;
    case "pollen":
    case "button": {
      const reach = form.centre === "button" ? .118 : .172;
      stamens(ctx, form, 12, reach, Math.PI / 12, .022);
      beads(ctx, 6, reach * .52, .022, cream);
      break;
    }
  }
}

export function drawCorolla(ctx, form) {
  if (form.centre === "base") {
    ctx.beginPath();
    ctx.moveTo(-.30, .73);
    ctx.quadraticCurveTo(.06, .06, .20, -.56);
    ctx.lineWidth = .025;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#b7a68b";
    ctx.stroke();
  }
  for (const [x, y, scale, angle] of form.florets ?? [[0, 0, 1, 0]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.scale(scale, form.centre === "throat" ? scale * .87 : scale);
    for (const layer of form.whorls) paintWhorl(ctx, form, layer);
    paintCentre(ctx, form);
    ctx.restore();
  }
}

import {VectorBasemap, paintChart} from "../atlas/VectorBasemap.js";
import index from "../atlas/maps/vector-index.json" with {type : "json"};
import {clamp, mercator, noise, TAU} from "./geometry.js";

const top = mercator(index.bounds[3]);
const paper = "#fbfaf5";
const screens = [
  {
    ink : "#55b5dd",
    angle : -.27,
    offset : 4,
    centres : [ [ 83, 32, 9, 6 ], [ 98, 39, 9, 4 ], [ 109, 26, 9, 5 ], [ 128, 48, 7, 5 ] ]
  },
  {
    ink : "#a4d964",
    angle : .22,
    offset : 73,
    centres : [ [ 87, 43, 10, 5 ], [ 101, 30, 8, 5 ], [ 115, 38, 8, 6 ], [ 124, 45, 5, 6 ] ]
  },
  {
    ink : "#9188c8",
    angle : -.04,
    offset : 122,
    centres : [ [ 84, 37, 5, 2.5 ], [ 106, 32, 5, 3 ], [ 118, 45, 7, 3 ] ]
  },
  {
    ink : "#f87539",
    angle : .43,
    offset : 207,
    centres : [ [ 93, 39, 4, 3 ], [ 103, 27, 4, 3 ], [ 114, 34, 5, 3 ], [ 122, 45, 3, 3 ] ]
  },
];
for (const screen of screens)
  screen.wells = screen.centres.map(([ x, lat, rx, ry ]) => [x, mercator(lat), rx, ry * 1.23]);
function fill(ctx, path, ink) {
  if (path) {
    ctx.fillStyle = ink;
    ctx.fill(path);
  }
}
function line(ctx, path, ink, width) {
  if (path) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
}

function inkStrength(lon, my, screen, layer) {
  const {offset, wells} = screen;
  const broad = noise(lon * .19 + offset, my * .19);
  const fine = noise(lon * .51, my * .51 + offset);
  const driftX = 2.8 * Math.sin(my * .29 + offset) + 2.1 * (broad - .5);
  const driftY = 2.8 * Math.sin(lon * .26 - my * .12 + offset);
  let well = 0;
  for (const [x, y, rx, ry] of wells) {
    const dx = (lon - x + driftX) / rx, dy = (my - y + driftY) / ry;
    well = Math.max(well, 1 - (dx * dx + dy * dy) * .39);
  }
  const current = .5 + .5 * Math.cos(lon * .33 + my * .24 + 4.6 * broad + offset);
  const value = .66 * well + .43 * broad + .16 * fine + .16 * current;
  const openings = Math.max(0, .53 - noise(lon * .27 + 6, my * .29 - 8));
  return clamp((value - (layer < 2 ? .55 : .72) - openings * .74) * (layer < 2 ? 1.67 : 2.1), 0, 1);
}

// Each ink has a different screen angle. Sample in projected geography and
// clip to the real national outline so the print stays registered when panned.
function screenprint(ctx, camera, w, h, k) {
  const step = Math.max(.065, .27 * 2 ** Math.round(Math.log2(5.6 / (k * .27))));
  const lowX = Math.max(72, camera.x - w / (2 * k) - step),
        highX = Math.min(136, camera.x + w / (2 * k) + step);
  const lowY = Math.max(18, camera.y - h / (2 * k) - step),
        highY = Math.min(66, camera.y + h / (2 * k) + step);
  if (lowX >= highX || lowY >= highY)
    return;
  for (const [layer, screen] of screens.entries()) {
    const cs = Math.cos(screen.angle), sn = Math.sin(screen.angle);
    const corners = [ [ lowX, lowY ], [ lowX, highY ], [ highX, lowY ], [ highX, highY ] ];
    const us = corners.map(([ x, y ]) => (x * cs + y * sn) / step),
          vs = corners.map(([ x, y ]) => (-x * sn + y * cs) / step);
    const left = Math.floor(Math.min(...us)), right = Math.ceil(Math.max(...us));
    const first = Math.floor(Math.min(...vs)), last = Math.ceil(Math.max(...vs));
    const dots = new Path2D();
    for (let j = first; j <= last; j++)
      for (let i = left; i <= right; i++) {
        const lon = (i * cs - j * sn) * step, my = (i * sn + j * cs) * step;
        if (lon < lowX || lon > highX || my < lowY || my > highY)
          continue;
        const value = inkStrength(lon, my, screen, layer);
        if (value < .075)
          continue;
        const x = w / 2 + (lon - camera.x) * k, y = h / 2 + (camera.y - my) * k,
              radius = (.06 + .52 * value) * step * k;
        dots.moveTo(x + radius, y);
        dots.arc(x, y, radius, 0, TAU);
      }
    ctx.fillStyle = screen.ink;
    ctx.fill(dots);
  }
}

export class FlowBasemap extends VectorBasemap {
  constructor(redraw, root) {
    super(redraw, root);
    this.plates = new Map();
  }

  drawNational(ctx, camera, w, h, k, detailed) {
    const item = this.resource(index.national, detailed);
    const {paths : p} = item && detailed ? this.paths(item, "national") : this.overview;
    ctx.fillStyle = "#f4f4f3";
    ctx.fillRect(0, 0, w, h);
    const origin = ctx.getTransform(), unit = k / index.units;
    ctx.save();
    ctx.translate(w / 2 + (index.bounds[0] - camera.x) * k, h / 2 + (camera.y - top) * k);
    ctx.scale(unit, unit);
    fill(ctx, p.land, paper);
    line(ctx, p.land, "#b9c0ca", .62 / unit);
    fill(ctx, p.focus, "#f8f6ed");
    if (k < 120) {
      ctx.save();
      ctx.clip(p.focus);
      ctx.setTransform(origin);
      ctx.globalCompositeOperation = "multiply";
      screenprint(ctx, camera, w, h, k);
      ctx.restore();
    }
    line(ctx, p.ridgeLight, "#65999647", .65 / unit);
    line(ctx, p.ridge, "#6694a54f", .65 / unit);
    line(ctx, p.ridgeDark, "#586aa160", .83 / unit);
    line(ctx, p.province, "#fffdf6d6", 2 / unit);
    line(ctx, p.province, "#6a748e94", .66 / unit);
    line(ctx, p.tributary, "#3d8fa79c", .65 / unit);
    line(ctx, p.river, "#fafff5df", 2.2 / unit);
    line(ctx, p.river, "#3b91b0", 1 / unit);
    line(ctx, p.focus, "#5b648dcc", 1.15 / unit);
    ctx.restore();
  }

  dotScreen(ctx, ink, pitch, unit) {
    const key = ink + pitch;
    if (!this.plates.has(key)) {
      const tile = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(20, 20) :
                                                           document.createElement("canvas");
      tile.width = tile.height = 20;
      const pen = tile.getContext("2d");
      pen.fillStyle = ink;
      for (const [x, y] of [[ 5, 5 ], [ 15, 15 ]]) {
        pen.beginPath();
        pen.arc(x, y, 3.6, 0, TAU);
        pen.fill();
      }
      this.plates.set(key, ctx.createPattern(tile, "repeat"));
    }
    const pattern = this.plates.get(key);
    pattern.setTransform(new DOMMatrix().scale(pitch / (10 * unit)));
    return pattern;
  }

  drawTile(ctx, p, unit, size, level) {
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, 4096, 4096);
    const px = 1 / unit;
    ctx.lineJoin = ctx.lineCap = "round";
    fill(ctx, p.built, "#eeecf4");
    fill(ctx, p.sand, "#f4dfca");
    fill(ctx, p.farm, "#e6efce");
    fill(ctx, p.park, "#e1edd5");
    fill(ctx, p.wood, "#d4e7c4");
    fill(ctx, p.wood, this.dotScreen(ctx, "#7eac78", 4.8, unit));
    fill(ctx, p.park, this.dotScreen(ctx, "#8fb489", 4.1, unit));
    fill(ctx, p.water, "#c4e4ec");
    fill(ctx, p.water, this.dotScreen(ctx, "#65adc3", 4.4, unit));
    line(ctx, p.water, "#63a2b9", .85 * px);
    line(ctx, p.stream, "#75b7c9", Math.min(10, Math.max(1, unit * 5)) * px);
    fill(ctx, p.building, "#d9d9e9");
    line(ctx, p.building, "#a3a5be", .6 * px);
    const road = clamp(size / 190, 1.2, 9), lane = Math.max(.8, road * .48);
    line(ctx, p.path, "#b6b2c3", .7 * px);
    line(ctx, p.lane, "#c1bece", (lane + 1) * px);
    line(ctx, p.road, "#a7a9be", (road + 1.35) * px);
    line(ctx, p.artery, "#c38c83", (road * 1.5 + 1.55) * px);
    line(ctx, p.lane, "#fffdf7", lane * px);
    line(ctx, p.road, "#fffdf9", road * px);
    line(ctx, p.artery, "#ffe2c4", road * 1.5 * px);
    line(ctx, p.rail, "#8b83a3", .85 * px);
    if (level === 14 && p.building && size > 980)
      fill(ctx, p.building, this.dotScreen(ctx, "#9b95b8", 3.5, unit));
  }
}
export {paintChart};

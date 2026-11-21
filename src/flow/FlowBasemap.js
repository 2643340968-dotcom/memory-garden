import {VectorBasemap, paintChart} from "../atlas/VectorBasemap.js";
import index from "../atlas/maps/vector-index.json" with {type : "json"};
import {clamp, mercator} from "./geometry.js";
import {buildImpression} from "./print.js";

const north = mercator(index.bounds[3]);
// First column is a material sample for the live print. Second column is the
// very light wash beneath the individual grains. Both come from the same path.
const material = {
  sea : [ "#050807", "#f3f5f2" ],
  outside : [ "#10150a", "#faf9f3" ],
  land : [ "#e5dfd8", "#faf8f0" ],
  built : [ "#c2aac5", "#f8f5ef" ],
  sand : [ "#a18be2", "#fbf3e7" ],
  farm : [ "#95df85", "#f7f7e7" ],
  park : [ "#82f85c", "#f1f5e6" ],
  wood : [ "#6af33c", "#ecf3e1" ],
  water : [ "#f35135", "#e2f0ef" ],
  building : [ "#c68ff0", "#f2eef2" ],
  bank : [ "#ff8a66", "#7eaeae" ],
  lane : [ "#786e73", "#fbf9f1" ],
  road : [ "#3b3639", "#fcfaf3" ],
  artery : [ "#29212c", "#fcfaf2" ],
};
function area(ctx, path, ink) {
  if (path) {
    ctx.fillStyle = ink;
    ctx.fill(path);
  }
}
function stroke(ctx, path, ink, width) {
  if (path) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
}
function surface(w, h) {
  if (typeof OffscreenCanvas === "function")
    return new OffscreenCanvas(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export class FlowBasemap extends VectorBasemap {
  constructor(redraw, root) {
    super(redraw, root);
    this.mask = surface(1, 1);
    this.pen = this.mask.getContext("2d", {alpha : false, willReadFrequently : true});
  }
  draw(ctx, camera, w, h, options) {
    const sw = Math.max(1, Math.ceil(w * .51)), sh = Math.max(1, Math.ceil(h * .51));
    if (this.mask.width !== sw)
      this.mask.width = sw;
    if (this.mask.height !== sh)
      this.mask.height = sh;
    this.pen.setTransform(sw / w, 0, 0, sh / h, 0, 0);
    this.pass = 0;
    this.tilePaper = material.land[0];
    super.draw(this.pen, camera, w, h, options);
    const grains = buildImpression(camera, w, h, this.pen.getImageData(0, 0, sw, sh));
    this.pass = 1;
    this.tilePaper = material.land[1];
    return {...super.draw(ctx, camera, w, h, options), ...grains};
  }
  drawNational(ctx, camera, w, h, k, detailed) {
    const item = this.resource(index.national, detailed);
    const {paths : p} = item && detailed ? this.paths(item, "national") : this.overview;
    const pass = this.pass, unit = k / index.units;
    ctx.fillStyle = material.sea[pass];
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + (index.bounds[0] - camera.x) * k, h / 2 + (camera.y - north) * k);
    ctx.scale(unit, unit);
    area(ctx, p.land, material.outside[pass]);
    area(ctx, p.focus, material.land[pass]);
    if (pass) {
      stroke(ctx, p.land, "#abb4bb8a", .6 / unit);
      stroke(ctx, p.ridgeLight, "#899eab39", .7 / unit);
      stroke(ctx, p.ridge, "#789c9d40", .65 / unit);
      stroke(ctx, p.ridgeDark, "#9997ba65", .76 / unit);
      stroke(ctx, p.focus, "#617e909c", .9 / unit);
      stroke(ctx, p.province, "#787c9b80", .7 / unit);
      stroke(ctx, p.tributary, "#82b0bb94", .65 / unit);
      stroke(ctx, p.river, "#6fabb7", 1.15 / unit);
    } else {
      stroke(ctx, p.province, "#838383", 1.35 / unit);
      stroke(ctx, p.river, material.water[0], 2.8 / unit);
    }
    ctx.restore();
  }
  drawTile(ctx, p, unit, size, level) {
    const pass = this.pass, px = 1 / unit;
    ctx.fillStyle = material.land[pass];
    ctx.fillRect(0, 0, 4096, 4096);
    ctx.lineJoin = ctx.lineCap = "round";
    for (const key of ["built", "sand", "farm", "park", "wood", "water", "building"]) {
      area(ctx, p[key], material[key][pass]);
    }
    stroke(ctx, p.water, material.bank[pass], (pass ? .7 : 2.1) * px);
    stroke(ctx, p.stream, material.water[pass], clamp(4 * unit, 1.7, 11) * px);
    const width = clamp(size / 220, 1.5, 8);
    // The network opens channels in the ink. Thin registration marks retain
    // street and block geometry where a lane is smaller than one screen dot.
    stroke(ctx, p.path, material.lane[pass], .9 * px);
    stroke(ctx, p.lane, material.lane[pass], Math.max(1.3, width * .74) * px);
    stroke(ctx, p.road, material.road[pass], (width + 1.25) * px);
    stroke(ctx, p.artery, material.artery[pass], (width * 1.45 + 2) * px);
    if (pass) {
      stroke(ctx, p.artery, "#bb806854", .8 * px);
      stroke(ctx, p.road, "#89869238", .65 * px);
      if (level >= 13)
        stroke(ctx, p.building, "#a798b35c", .58 * px);
      stroke(ctx, p.rail, "#968aa46b", .65 * px);
    }
  }
}
export {paintChart};

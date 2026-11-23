import {VectorBasemap, indexedTile, paintChart} from "../atlas/VectorBasemap.js";
import index from "../atlas/maps/vector-index.json" with {type : "json"};
import {clamp, coversView, framePlacement, mercator} from "./geometry.js";

import {pixelRatio, releaseCanvas} from "./renderBudget.js";
import streetPacks from "./place-packs.json" with {type:"json"};

const north = mercator(index.bounds[3]);
export const paper = {
  sea : "#f3f5f2",
  outside : "#faf9f3",
  land : "#faf8f0",
  built : "#f8f5ef",
  sand : "#fbf3e7",
  farm : "#f7f7e7",
  park : "#f1f5e6",
  wood : "#ecf3e1",
  water : "#e2f0ef",
  building : "#f2eef2",
  bank : "#7eaeae",
  lane : "#fbf9f1",
  road : "#fcfaf3",
  artery : "#fcfaf2",
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
export class FlowBasemap extends VectorBasemap {
  constructor(redraw, root, generalizeNational = false) {
    super(redraw, root);
    this.generalizeNational = generalizeNational;
    this.cacheLimit = generalizeNational ? 12 : 28;
    this.tilePaper = paper.land;
  }
  tileAt(z, x, y) {
    if (this.generalizeNational && z > 11) return null;
    return super.tileAt(z, x, y) ?? indexedTile(z, x, y, streetPacks);
  }
  drawNational(ctx, camera, w, h, k, detailed) {
    detailed = detailed && !this.generalizeNational;
    const item = this.resource(index.national, detailed);
    const {paths : p} = item && detailed ? this.paths(item, "national") : this.overview;
    const unit = k / index.units;
    ctx.fillStyle = paper.sea;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + (index.bounds[0] - camera.x) * k, h / 2 + (camera.y - north) * k);
    ctx.scale(unit, unit);
    area(ctx, p.land, paper.outside);
    area(ctx, p.focus, paper.land);
    stroke(ctx, p.land, "#abb4bb8a", .6 / unit);
    stroke(ctx, p.ridgeLight, "#899eab39", .7 / unit);
    stroke(ctx, p.ridge, "#789c9d40", .65 / unit);
    stroke(ctx, p.ridgeDark, "#9997ba65", .76 / unit);
    stroke(ctx, p.focus, "#617e909c", .9 / unit);
    stroke(ctx, p.province, "#787c9b80", .7 / unit);
    stroke(ctx, p.tributary, "#82b0bb94", .65 / unit);
    stroke(ctx, p.river, "#85a9b0", 1.15 / unit);
    ctx.restore();
  }
  drawTile(ctx, p, unit, size, level) {
    const px = 1 / unit;
    ctx.fillStyle = paper.land;
    ctx.fillRect(0, 0, 4096, 4096);
    ctx.lineJoin = ctx.lineCap = "round";
    for (const key of ["built", "sand", "farm", "park", "wood", "water", "building"]) {
      area(ctx, p[key], paper[key]);
    }
    stroke(ctx, p.water, paper.bank, .7 * px);
    stroke(ctx, p.stream, paper.water, clamp(4 * unit, 1.7, 11) * px);
    const width = clamp(size / 220, 1.5, 8);
    stroke(ctx, p.path, paper.lane, .9 * px);
    stroke(ctx, p.lane, paper.lane, Math.max(1.3, width * .74) * px);
    stroke(ctx, p.road, paper.road, (width + 1.25) * px);
    stroke(ctx, p.artery, paper.artery, (width * 1.45 + 2) * px);
    stroke(ctx, p.artery, "#9d91855c", .8 * px);
    stroke(ctx, p.road, "#89869238", .65 * px);
    if (level >= 13)
      stroke(ctx, p.building, "#a798b35c", .58 * px);
    stroke(ctx, p.rail, "#968aa46b", .65 * px);
  }
}

// Keep the entire viewport covered with the same paper map while a fast
// gesture is waiting for the more detailed vector chart.
export class NavigationChart {
  constructor(canvas, assetRoot, redraw) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {alpha : false, willReadFrequently : true});
    this.assetRoot = assetRoot;
    this.redraw = redraw;
  }
  release() {
    this.map?.dispose();
    this.map = this.frame = null;
    this.needed = this.dirty = false;
    releaseCanvas(this.canvas);
  }
  select(detail, view, w, h, language, dpr = 1) {
    this.map ??= new FlowBasemap(() => {
      this.dirty = true;
      if (this.needed)
        this.redraw();
    }, this.assetRoot, true);
    const extent = detail && {s : detail.scale, x : detail.x, y : detail.y};
    const valid = detail && coversView(detail.frame, extent, w, h) &&
        detail.scale > (this.needed ? .71 : .55) && detail.scale < (this.needed ? 1.43 : 1.72);
    const wasNeeded = this.needed;
    this.needed = !valid;
    let pose = this.frame && framePlacement(this.frame, view, w, h);
    const density = Math.min(.88, 495 / w, 320 / h);
    if (this.needed &&
        (!pose || this.dirty || this.frame.language !== language || this.frame.dpr !== dpr ||
         !coversView(this.frame, pose, w, h) || Math.abs(Math.log(pose.s * density)) > .31)) {
      const width = Math.ceil(w * density * 1.48), height = Math.ceil(h * density * 1.48);
      const k = w / view.span * density, camera = {x : view.x, y : view.y, span : width / k};
      // Use coarser vector features for navigation, but rasterize their edges
      // at the display scale. The overscan remains in geographic coordinates.
      const ratio = pixelRatio(width, height, dpr / density, 1500000);
      const pixelsWide = Math.round(width * ratio), pixelsHigh = Math.round(height * ratio);
      if (this.canvas.width !== pixelsWide)
        this.canvas.width = pixelsWide;
      if (this.canvas.height !== pixelsHigh)
        this.canvas.height = pixelsHigh;
      this.canvas.style.width = width + "px";
      this.canvas.style.height = height + "px";
      this.ctx.setTransform(pixelsWide / width, 0, 0, pixelsHigh / height, 0, 0);
      const data = this.map.draw(this.ctx, camera, width, height, {language});
      this.frame = {camera, width, height, k, language, dpr, ...data};
      this.dirty = false;
      pose = framePlacement(this.frame, view, w, h);
    }
    if (pose && (this.needed || wasNeeded))
      this.canvas.style.transform = `matrix(${pose.s},0,0,${pose.s},${pose.x},${pose.y})`;
    return this.needed ? {frame : this.frame, scale : pose.s, x : pose.x, y : pose.y} : detail;
  }
}
export {paintChart};

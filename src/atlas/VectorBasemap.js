import index from "./maps/vector-index.json" with { type: "json" };

const EXTENT = 4096;
const MIN_LEVEL = 6;
const MAX_LEVEL = 14;
const nationalTop = Math.asinh(Math.tan(index.bounds[3] * Math.PI / 180)) * 180 / Math.PI;
const fills = {
  built: "#e8e3d2", sand: "#ebdcb7", farm: "#e0e2c3", park: "#ccd9b8",
  wood: "#b6cba9", water: "#b5d4cf", building: "#d7ccbb",
};

export function indexedTile(z, x, y, packs = index.packs) {
  const slot = x % 4 + 4 * (y % 4);
  const pack = packs[[z, x >> 2, y >> 2].join("-")];
  return pack && (pack[0] & (1 << slot)) ? { z, x, y, file: pack[1], slot } : null;
}

function chartPaths(chart) {
  const paths = {};
  for (const [key, data] of Object.entries(chart)) {
    if (key !== "labels" && data) paths[key] = new Path2D(data);
  }
  return { paths, labels: chart.labels ?? [] };
}

async function loadChart(url, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error("Map resource " + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Static hosts may either serve the gzip file as-is or decode it via Content-Encoding.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).json();
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function paint(ctx, path, color) {
  if (!path) return;
  ctx.fillStyle = color;
  ctx.fill(path);
}
function stroke(ctx, path, color, width) {
  if (!path) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(path);
}

function buildingHatch(spacing) {
  const path = new Path2D();
  for (let offset = -EXTENT; offset < EXTENT; offset += spacing) {
    path.moveTo(offset, EXTENT);
    path.lineTo(offset + EXTENT, 0);
  }
  return path;
}

export class VectorBasemap {
  constructor(redraw, assetRoot) {
    this.redraw = redraw;
    this.assetRoot = assetRoot;
    this.overview = chartPaths(index.overview);
    this.hatch = [buildingHatch(32), buildingHatch(16)];
    this.resources = new Map();
    this.requests = new AbortController();
    this.cacheLimit = 36;
  }

  dispose() {
    this.requests.abort();
    this.resources.clear();
  }

  resource(file, request = true) {
    let item = this.resources.get(file);
    if (item?.data) {
      item.used = performance.now();
      return item;
    }
    if (!request || item?.pending || item?.retryAt > performance.now()) return null;
    item ??= { charts: new Map() };
    this.resources.set(file, item);
    item.pending = true;
    const {signal} = this.requests;
    loadChart(new URL(file, this.assetRoot), signal).then(data => {
      if (signal.aborted) return;
      item.data = data;
      item.used = performance.now();
      const ready = [...this.resources].filter(([name, entry]) => name !== index.national && entry.data);
      if (ready.length > this.cacheLimit) {
        ready.sort((a, b) => a[1].used - b[1].used);
        this.resources.delete(ready[0][0]);
      }
      this.redraw();
    }).catch(() => {
      if (signal.aborted) return;
      item.failures = (item.failures ?? 0) + 1;
      const delay = Math.min(60000, 1500 * 2 ** Math.min(item.failures - 1, 6));
      item.retryAt = performance.now() + delay;
      setTimeout(() => { if (!signal.aborted) this.redraw(); }, delay + 20);
    }).finally(() => { item.pending = false; });
    return null;
  }

  paths(item, slot) {
    if (!item.charts.has(slot)) {
      const national = slot === "national";
      item.charts.set(slot, chartPaths(national ? item.data : item.data[slot]));
      // Path2D and the label list now own this tile. Other slots still decode lazily.
      if (national) item.data = true;
      else delete item.data[slot];
    }
    return item.charts.get(slot);
  }

  drawNational(ctx, camera, w, h, k, detailed) {
    const item = this.resource(index.national, detailed);
    const { paths: p } = item && detailed ? this.paths(item, "national") : this.overview;
    const unit = k / index.units;
    ctx.fillStyle = "#d0e2dd";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + (index.bounds[0] - camera.x) * k, h / 2 + (camera.y - nationalTop) * k);
    ctx.scale(unit, unit);
    paint(ctx, p.land, "#e9e7d7");
    stroke(ctx, p.land, "#c6c9b4", .7 / unit);
    paint(ctx, p.focus, "#d9dfc3");
    stroke(ctx, p.ridgeLight, "#e7e8d0", .8 / unit);
    stroke(ctx, p.ridge, "#84997576", .65 / unit);
    stroke(ctx, p.ridgeDark, "#718c6f9c", .9 / unit);
    stroke(ctx, p.focus, "#82967c", 1 / unit);
    stroke(ctx, p.province, "#89977ca1", .65 / unit);
    stroke(ctx, p.tributary, "#8aafaa", .55 / unit);
    stroke(ctx, p.river, "#729c98", .86 / unit);
    ctx.restore();
  }

  tileAt(z, x, y) { return indexedTile(z, x, y); }
  visibleTiles(level, camera, w, h, k) {
    const deg = 360 / 2 ** level;
    const left = Math.floor((camera.x + 180 - w / (2 * k)) / deg);
    const right = Math.floor((camera.x + 180 + w / (2 * k)) / deg);
    const top = Math.floor((180 - camera.y - h / (2 * k)) / deg);
    const bottom = Math.floor((180 - camera.y + h / (2 * k)) / deg);
    const visible = new Map();
    let covered = 0;
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        let candidates = 0;
        for (let z = level; z >= MIN_LEVEL; z--) {
          const shift = level - z;
          const tile = this.tileAt(z, x >> shift, y >> shift);
          if (!tile) continue;
          const item = this.resource(tile.file, candidates === 0 || (candidates === 1 && level - z < 4) || z === MIN_LEVEL);
          candidates++;
          if (!item) continue;
          visible.set(tile.file + "/" + tile.slot, { ...tile, item });
          covered++;
          break;
        }
      }
    }
    const tiles = [...visible.values()].sort((a, b) => a.z - b.z);
    return { tiles, complete: covered === (right - left + 1) * (bottom - top + 1) };
  }

  drawTile(ctx, p, unit, size, level) {
    const px = 1 / unit;
    ctx.lineJoin = ctx.lineCap = "round";
    for (const [key, color] of Object.entries(fills)) paint(ctx, p[key], color);
    stroke(ctx, p.water, "#8db4ad", .65 * px);
    stroke(ctx, p.stream, "#91b9b3", Math.min(15, Math.max(.85, 6 * unit)) * px);
    if (level === MAX_LEVEL && p.building && size > 880) {
      ctx.save();
      ctx.clip(p.building);
      stroke(ctx, this.hatch[size > 2350 ? 1 : 0], "#9f8c7245", .6 * px);
      ctx.restore();
    }
    stroke(ctx, p.building, "#b6a994", Math.min(2, Math.max(.55, 1.25 * unit)) * px);
    // Widths and casings follow the current camera continuously, including overzoom.
    const road = Math.max(1.2, Math.min(13, size / 125));
    const lane = Math.max(.85, road * .52);
    stroke(ctx, p.path, "#b7ad92", Math.max(.6, lane * .45) * px);
    stroke(ctx, p.lane, "#c6b99f", (lane + .9) * px);
    stroke(ctx, p.road, "#bbaa87", (road + 1.15) * px);
    stroke(ctx, p.artery, "#ad936c", (road * 1.32 + 1.45) * px);
    stroke(ctx, p.lane, "#f9f5e8", lane * px);
    stroke(ctx, p.road, "#fbf3de", road * px);
    stroke(ctx, p.artery, "#ede0b9", road * 1.32 * px);
    stroke(ctx, p.rail, "#a59d91", Math.max(.7, lane * .38) * px);
    if (p.rail) {
      ctx.setLineDash([2 * px, 4 * px]);
      stroke(ctx, p.rail, "#eee9dc", .65 * px);
      ctx.setLineDash([]);
    }
  }

  draw(ctx, camera, w, h, { lens = false, language = "en" } = {}) {
    const k = w / camera.span;
    const scale = Math.log2(360 * k / 320);
    const alpha = lens ? 1 : Math.min(1, Math.max(0, (scale - 5.25) / 1.15));
    if (!alpha) {
      this.drawNational(ctx, camera, w, h, k, true);
      return { level: 0, labels: [] };
    }
    const level = Math.max(lens ? 13 : MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(scale)));
    const { tiles, complete } = this.visibleTiles(level, camera, w, h, k);
    if (alpha < 1 || !complete) this.drawNational(ctx, camera, w, h, k, alpha < 1);
    const labels = [];
    const dpr = ctx.getTransform().a;
    const snap = v => Math.round(v * dpr) / dpr;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const tile of tiles) {
      const deg = 360 / 2 ** tile.z, size = deg * k, unit = size / EXTENT;
      const x = w / 2 + (tile.x * deg - 180 - camera.x) * k;
      const y = h / 2 + (camera.y - 180 + tile.y * deg) * k;
      const { paths, labels: names } = this.paths(tile.item, tile.slot);
      ctx.save();
      ctx.beginPath();
      ctx.rect(snap(x), snap(y), snap(x + size) - snap(x), snap(y + size) - snap(y));
      ctx.clip();
      ctx.fillStyle = this.tilePaper ?? "#efeada";
      ctx.fillRect(snap(x), snap(y), snap(x + size) - snap(x), snap(y + size) - snap(y));
      ctx.translate(x, y);
      ctx.scale(unit, unit);
      this.drawTile(ctx, paths, unit, size, tile.z);
      ctx.restore();
      if (!lens && tile.z >= level - 1) {
        for (const [rank, tx, ty, native, en] of names) {
          const sx = x + tx * unit, sy = y + ty * unit;
          if (sx > 14 && sx < w - 14 && sy > 24 && sy < h - 20)
            labels.push({ x: sx, y: sy, rank, name: language === "en" && en ? en : native });
        }
      }
    }
    ctx.restore();
    return { level: tiles.at(-1)?.z ?? 0, labels: labels.sort((a, b) => a.rank - b.rank) };
  }
}

export function paintChart(map, surface, job) {
  const { width, height, dpr, camera, layer, language } = job;
  const pxWidth = Math.round(width * dpr), pxHeight = Math.round(height * dpr);
  if (surface.width !== pxWidth) surface.width = pxWidth;
  if (surface.height !== pxHeight) surface.height = pxHeight;
  const ctx = surface.getContext("2d", { alpha: false, willReadFrequently: true });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return map.draw(ctx, camera, width, height, { lens: layer === "lens", language });
}

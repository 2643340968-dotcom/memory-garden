import { getLanguage, placeText, t } from "../i18n/LanguageController.js";
import { CHINA, CITIES, PLACES } from "./places.js";
import { cityStudies } from "./identities.js";
import { FieldStudy } from "./FieldStudy.js";
import { groupMarkers, overlaps } from "./markerLayout.js";
import reliefUrl from "./maps/china-relief.webp";
import bounds from "./maps/place-bounds.json";
import watercourses from "./maps/watercourses.json";

const mapFiles = import.meta.glob("./maps/**/*.webp", { eager: true, query: "?url", import: "default" });
const national = { url: reliefUrl, bounds: [48, 2, 161, 67], reveal: Infinity };
const backgroundLayers = [national];
const detailLayers = new Map();
for (const [name, entry] of Object.entries(bounds)) {
  const layer = { ...entry, url: mapFiles["./maps/" + name + ".webp"] };
  if (entry.level === "region" || entry.level === "city") {
    layer.reveal = entry.level === "region" ? 15 : Math.min(5, (entry.bounds[2] - entry.bounds[0]) * 2.5);
    backgroundLayers.push(layer);
  } else {
    layer.reveal = 0.20;
    detailLayers.set(entry.level, layer);
  }
}
backgroundLayers.sort((a, b) => b.reveal - a.reveal);

const annotations = [
  [103.6, 36.5, "C H I N A", "中　国", "country", 16, 220],
  [87.7, 32.1, "Tibetan Plateau", "青藏高原", "terrain", 16, 200],
  [120.97, 23.7, "Taiwan", "台湾", "terrain", 30, 190],
  [125, 27.5, "East China Sea", "东海", "water", 16, 200],
  [112.0, 15.6, "South China Sea", "南海", "water", 16, 200],
  [117.24, 31.82, "Hefei", "合肥", "terrain", 0.9, 10],
  [120.3, 31.58, "Wuxi", "无锡", "terrain", 0.9, 10],
  [120.17, 31.20, "Lake Tai", "太湖", "water", 0.9, 10],
  [118.704, 32.084, "Yangtze River", "长江", "water", 0.12, 0.84],
  [118.797, 32.077, "Xuanwu Lake", "玄武湖", "water", 0.10, 0.84],
  [118.7271, 32.00637, "Jianye", "建邺", "terrain", 0.10, 0.84],
  [118.78959, 32.04115, "Qinhuai", "秦淮", "terrain", 0.10, 0.55],
  [118.72001, 32.04253, "Hanzhongmen Street", "汉中门大街", "street", 0.012, 0.09],
  [118.7377, 32.03033, "Jiqingmen Street", "集庆门大街", "street", 0.012, 0.09],
  [118.74901, 32.03562, "Shuiximen Street", "水西门大街", "street", 0.012, 0.09],
  [116.3906,39.9164,"Palace Museum","故宫博物院","terrain",0.018,0.34],
  [116.3809,39.9235,"Beihai Park","北海公园","water",0.02,0.32],
  [94.662,40.142,"Dunhuang oasis","敦煌绿洲","terrain",0.27,2.5],
  [104.066,30.66,"Chengdu Plain","成都平原","terrain",0.6,4],
  [103.603,31.017,"Min River","岷江","water",0.021,0.11],
  [118.599,24.906,"Quanzhou old city","泉州古城","terrain",0.2,1.8],
];

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const northing = (lat) => Math.asinh(Math.tan(lat * Math.PI / 180)) * 180 / Math.PI;
const latitude = (y) => Math.atan(Math.sinh(y * Math.PI / 180)) * 180 / Math.PI;

function inside([w, s, e, n], lon, lat) {
  return lon >= w && lon <= e && lat >= s && lat <= n;
}
function at(camera, width, height, [lon, lat]) {
  return [width / 2 + (lon - camera.x) * width / camera.span,
    height / 2 - (northing(lat) - camera.y) * width / camera.span];
}
function blendCamera(a, b, progress) {
  const ratio = b.span / a.span;
  const scale = ratio ** progress;
  const pan = Math.abs(ratio - 1) < 0.00001 ? progress : (scale - 1) / (ratio - 1);
  return { x: a.x + (b.x - a.x) * pan, y: a.y + (b.y - a.y) * pan, span: a.span * scale };
}
const smooth = (p) => p * p * (3 - 2 * p);

export class AtlasMap {
  constructor(root, navigate, onPreview) {
    this.root = root;
    this.navigate = navigate;
    this.onPreview = onPreview;
    this.canvas = root.querySelector("#atlas-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.markers = root.querySelector("#atlas-markers");
    this.ghost = root.querySelector("#atlas-ghost");
    this.study = new FieldStudy(root.querySelector("#atlas-plate"));
    this.caption = root.querySelector("#plate-caption");
    this.scale = root.querySelector("#atlas-scale");
    this.zoomIn = root.querySelector("#atlas-zoom-in");
    this.zoomOut = root.querySelector("#atlas-zoom-out");
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.route = { level: "country" };
    this.images = new Map();
    this.pointers = new Map();
    this.inkStarted = performance.now();
    this.width = this.height = 1;
    this.zoomIn.onclick = () => this.zoom(1.8);
    this.zoomOut.onclick = () => this.zoom(1 / 1.8);
    root.querySelector("#atlas-fit").onclick = () => { this.onPreview(null); this.fly(this.route); };
    this.markers.addEventListener("click", (event) => {
      const mark = event.target.closest("button")?.atlasMark;
      if (!mark) return;
      if (mark.national) this.navigate({ level: "city", city: mark.city });
      else if (mark.members.length > 1) this.expand(mark);
      else this.navigate({ level: this.route.place === mark.id ? "garden" : "place", city: mark.city, place: mark.id });
    });
    root.addEventListener("wheel", (event) => {
      if (event.target.closest(".atlas-tools")) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      this.zoom(Math.exp(-clamp(delta, -260, 260) * 0.0025), this.point(event));
    }, { passive: false });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      this.takeControl();
      if (this.route.place) this.onPreview(this.route.place, "selected");
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, this.point(event));
      this.canvas.classList.add("is-panning");
    });
    this.canvas.addEventListener("pointermove", (event) => this.move(event));
    this.canvas.addEventListener("lostpointercapture", (event) => {
      this.pointers.delete(event.pointerId);
      if (!this.pointers.size) this.canvas.classList.remove("is-panning");
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(root);
    this.resize();
  }

  point(event) {
    const box = this.canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }
  resize() {
    const { clientWidth: w, clientHeight: h } = this.root;
    if (!w || !h) return;
    const oldFit = this.fittedSpan;
    this.width = w;
    this.height = h;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.pixelRatio);
    this.canvas.height = Math.round(h * this.pixelRatio);
    const fit = this.target(this.route);
    if (!this.camera || !this.manual) { this.flight = null; this.camera = fit; }
    else if (oldFit) this.camera.span *= fit.span / oldFit;
    this.fittedSpan = fit.span;
    this.previewTween = null;
    this.draw();
  }
  target(route) {
    const area = PLACES[route.place] ?? CITIES[route.city] ?? CHINA;
    const [x, lat] = area.center;
    const dy = northing(lat + area.latitudeSpan / 2) - northing(lat - area.latitudeSpan / 2);
    const overlay = this.width >= 880 && !matchMedia("(max-width:950px) and (orientation:portrait)").matches;
    const horizontal = route.level === "country" && this.width <= 520 ? 65 : area.span;
    const span = Math.max(horizontal / (overlay ? 0.73 : 0.92), dy * this.width / (this.height * 0.86));
    return { x: x - (overlay ? span * 0.105 : 0), y: northing(lat), span };
  }
  queueDraw() {
    if (this.pending || document.hidden) return;
    this.pending = requestAnimationFrame(() => { this.pending = 0; this.draw(); });
  }
  clearPreview() {
    this.preview = null;
    this.previewTween = null;
    this.ghost.classList.remove("is-visible");
    delete this.ghost.dataset.place;
  }
  fly(route, immediate = false) {
    const from = this.view ?? this.camera;
    this.clearPreview();
    this.route = route;
    this.manual = false;
    this.inkStarted = performance.now();
    const dest = this.target(route);
    this.fittedSpan = dest.span;
    this.flyTo(from, dest, immediate ? 0 : 940);
  }
  flyTo(from, to, duration) {
    this.previewTween = null;
    this.flight = null;
    if (this.reduced.matches || !from || !duration) this.camera = to;
    else this.flight = { from, to, start: performance.now(), duration };
    this.draw();
  }
  expand(mark) {
    if (this.route.level === "country") { this.navigate({ level: "city", city: mark.city }); return; }
    const coordinates = mark.members.map((id) => PLACES[id].center);
    const xs = coordinates.map(([lon]) => lon);
    const ys = coordinates.map(([, lat]) => northing(lat));
    const lowX = Math.min(...xs), highX = Math.max(...xs), lowY = Math.min(...ys), highY = Math.max(...ys);
    const span = Math.min(this.camera.span * 0.48, Math.max(0.009, (highX - lowX) * 2.3, (highY - lowY) * 2.4 * this.width / this.height));
    const from = this.view;
    this.onPreview(null);
    this.clearPreview();
    this.manual = true;
    this.flyTo(from, { x: (lowX + highX) / 2 - (this.width >= 880 ? span * 0.08 : 0), y: (lowY + highY) / 2, span }, 620);
  }
  takeControl() {
    const current = this.view ?? this.camera;
    this.onPreview(null);
    this.clearPreview();
    this.flight = null;
    this.camera = { ...current };
    this.manual = true;
  }
  move(event) {
    const old = this.pointers.get(event.pointerId);
    if (!old) return;
    const point = this.point(event);
    const second = [...this.pointers].find(([id]) => id !== event.pointerId)?.[1];
    this.pointers.set(event.pointerId, point);
    if (second) {
      const distance = (p) => Math.hypot(p.x - second.x, p.y - second.y);
      this.zoom(distance(point) / Math.max(1, distance(old)), { x: (old.x + second.x) / 2, y: (old.y + second.y) / 2 });
    }
    const unit = this.camera.span / this.width * (second ? 0.5 : 1);
    const layer = this.camera.span < 0.065 ? this.detailAt(this.camera.x, latitude(this.camera.y)) : null;
    const limit = layer?.bounds ?? [73, 17, 135, 54];
    this.camera.x = clamp(this.camera.x - (point.x - old.x) * unit, limit[0], limit[2]);
    this.camera.y = clamp(this.camera.y + (point.y - old.y) * unit, northing(limit[1]), northing(limit[3]));
    this.draw();
  }
  detailAt(lon, lat) {
    const selected = detailLayers.get(this.route.place);
    if (selected && inside(selected.bounds, lon, lat)) return selected;
    let nearest = null, distance = Infinity;
    for (const [id, layer] of detailLayers) {
      if (!inside(layer.bounds, lon, lat)) continue;
      const [x, y] = PLACES[id].center;
      const score = (lon - x) ** 2 + (lat - y) ** 2;
      if (score < distance) { nearest = layer; distance = score; }
    }
    return nearest;
  }
  minimum(lon, lat) {
    if (this.detailAt(lon, lat)) return 0.006;
    for (let i = backgroundLayers.length - 1; i > 0; i--) {
      const layer = backgroundLayers[i];
      if (inside(layer.bounds, lon, lat)) return layer.level === "city" ? 0.07 : 0.55;
    }
    return 6;
  }
  zoom(factor, point = { x: this.width / 2, y: this.height / 2 }) {
    const keepId = this.preview?.id ?? this.route.place;
    if ((this.preview && this.preview.source !== "selected") || this.previewTween || this.flight) this.takeControl();
    this.manual = true;
    const c = this.camera;
    const old = c.span;
    const lon = c.x + (point.x - this.width / 2) * old / this.width;
    const lat = latitude(c.y - (point.y - this.height / 2) * old / this.width);
    c.span = clamp(old / factor, Math.min(old, this.minimum(lon, lat)), this.target({ level: "country" }).span * 1.12);
    const shift = (old - c.span) / this.width;
    c.x = clamp(c.x + (point.x - this.width / 2) * shift, 73, 135);
    c.y = clamp(c.y - (point.y - this.height / 2) * shift, northing(17), northing(54));
    if (keepId && this.preview?.id !== keepId) this.onPreview(keepId, "selected");
    this.draw();
  }
  setPreview(id, source = "marker") {
    if (id === this.preview?.id && source === this.preview.source) return;
    if (!id && !this.preview) return;
    const from = this.view ?? this.camera;
    const wasVisible = this.ghost.classList.contains("is-visible");
    if (id) {
      const site = PLACES[id];
      this.preview = { id, source, start: performance.now() };
      this.study.show(site.study, site.ink, !wasVisible);
      this.ghost.style.setProperty("--spot-ink", site.ink);
      this.ghost.dataset.place = id;
      this.caption.textContent = placeText(site.name) + "  /  " + placeText(site.motif);
    } else {
      this.clearPreview();
    }
    this.previewTween = !this.reduced.matches && !this.flight ? { from, start: performance.now() } : null;
    this.draw();
  }
  previewCamera() {
    if (!this.preview || this.preview.source === "selected" || this.flight) return this.camera;
    const [lon, lat] = PLACES[this.preview.id].center;
    let [x, y] = at(this.camera, this.width, this.height, [lon, lat]);
    if (this.preview.source === "index") {
      x = clamp(x, this.width * (this.width >= 880 ? 0.37 : 0.13), this.width * 0.86);
      y = clamp(y, this.height * 0.30, this.height * 0.84);
    }
    const span = this.camera.span / (this.route.level === "country" ? 1.13 : 1.09);
    return { x: lon - (x - this.width / 2) * span / this.width, y: northing(lat) + (y - this.height / 2) * span / this.width, span };
  }
  screen(lon, lat) { return at(this.view, this.width, this.height, [lon, lat]); }
  getImage(url) {
    if (!this.images.has(url)) {
      const image = new Image();
      image.onload = () => this.queueDraw();
      this.images.set(url, image);
      image.src = url;
    }
    return this.images.get(url);
  }
  drawLayer(layer) {
    if (!layer || this.view.span >= layer.reveal) return;
    const [west, south, east, north] = layer.bounds;
    const [x, y] = this.screen(west, north), [r, b] = this.screen(east, south);
    if (r < 0 || b < 0 || x > this.width || y > this.height) return;
    const image = this.getImage(layer.url);
    if (!image.complete || !image.naturalWidth) return;
    this.ctx.globalAlpha = clamp(Math.log2(layer.reveal / this.view.span) * 1.4, 0, 1);
    this.ctx.drawImage(image, x, y, r - x, b - y);
  }
  draw() {
    if (!this.camera && !this.flight || !this.ctx || !this.root.clientWidth) return;
    const { ctx, width: w, height: h } = this;
    const now = performance.now();
    if (this.flight) {
      const f = this.flight, p = clamp((now - f.start) / f.duration, 0, 1);
      this.camera = blendCamera(f.from, f.to, smooth(p));
      if (p === 1) this.flight = null;
    }
    const desired = this.previewCamera();
    this.view = desired;
    if (this.previewTween) {
      const p = clamp((now - this.previewTween.start) / 390, 0, 1);
      this.view = blendCamera(this.previewTween.from, desired, smooth(p));
      if (p === 1) this.previewTween = null;
    }
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#d3e4df";
    ctx.fillRect(0, 0, w, h);
    for (const layer of backgroundLayers) this.drawLayer(layer);
    if (this.view.span < 0.20) this.drawLayer(this.detailAt(this.view.x, latitude(this.view.y)));
    ctx.globalAlpha = 1;
    this.drawGrid();
    const ink = this.reduced.matches ? 1 : clamp((now - this.inkStarted) / 1500, 0, 1);
    if (this.view.span > 9) this.drawWater(ink);
    const opening = this.preview && !this.reduced.matches ? clamp((now - this.preview.start) / 420, 0, 1) : 1;
    this.drawImpression(opening);
    this.drawMarkers();
    const scaleKm = this.view.span / w * 111.32 * Math.cos(latitude(this.view.y) * Math.PI / 180);
    const unit = 10 ** Math.floor(Math.log10(scaleKm * 78));
    const km = [5, 2, 1].find(v => v * unit <= scaleKm * 78) * unit;
    this.scale.lastElementChild.style.width = km / scaleKm + "px";
    this.scale.firstElementChild.textContent = km < 1 ? Math.round(km * 1000) + " m" : km + " km";
    this.zoomIn.disabled = this.camera.span <= this.minimum(this.camera.x, latitude(this.camera.y)) * 1.0001;
    this.zoomOut.disabled = this.camera.span >= this.target({ level: "country" }).span * 1.11999;
    if (this.flight || this.previewTween || opening < 1 || (this.view.span > 9 && ink < 1)) this.queueDraw();
  }
  drawGrid() {
    const { ctx, width: w, height: h, view: c } = this;
    const country = c.span > 15;
    const step = 10 ** Math.floor(Math.log10(c.span / 3));
    const interval = step * (c.span/step > 12 ? 5 : 1);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = country ? "rgba(74,91,78,.10)" : "rgba(87,98,81,.13)";
    ctx.fillStyle = "rgba(55,73,68,.65)";
    ctx.font = "9px Consolas, monospace";
    ctx.textAlign = "left";
    const lonMin = c.x - c.span/2;
    const latMin = latitude(c.y - c.span*h/(2*w));
    const latMax = latitude(c.y + c.span*h/(2*w));
    ctx.beginPath();
    for (let lon = Math.ceil(lonMin/interval)*interval; lon < lonMin+c.span; lon+=interval) {
      const [x] = this.screen(lon,0);
      ctx.moveTo(x,0); ctx.lineTo(x,h);
      if (x > 20 && x < w-68) ctx.fillText(`${+Math.abs(lon).toFixed(3)}°${lon < 0 ? "W" : "E"}`, x+5, 18);
    }
    for (let lat = Math.ceil(latMin/interval)*interval; lat<latMax; lat+=interval) {
      const [,y] = this.screen(0,lat);
      ctx.moveTo(0,y); ctx.lineTo(w,y);
      if (y>42 && y<h-30) ctx.fillText(`${+Math.abs(lat).toFixed(3)}°${lat < 0 ? "S" : lat > 0 ? "N" : ""}`,8,y-5);
    }
    ctx.stroke();
    ctx.textAlign = "center";
    for (const [lon,lat,en,zh,kind,min,max] of annotations) {
      if (c.span<min || c.span>max) continue;
      if (country && w <= 520 && kind !== "water") continue;
      const [x,y] = this.screen(lon,lat);
      const major = kind === "country";
      ctx.font = major ? `${w<500?15:21}px Georgia, serif` : `${kind==="street"?"":"italic "}${country && w>600?14:11}px Georgia, "SimSun", serif`;
      ctx.fillStyle = major ? "#5c6956" : kind === "water" ? "#567773" : "#67705b";
      const label = getLanguage()==="en" ? en : zh;
      const half = ctx.measureText(label).width/2;
      if (x-half<8 || x+half>w-10 || y<34 || y>h-18) continue;
      ctx.strokeStyle = "rgba(243,241,220,.80)";
      ctx.lineWidth = 3;
      ctx.strokeText(label,x,y);
      ctx.fillText(label,x,y);
    }
    ctx.textAlign = "left";
  }

  drawWater(phase) {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = this.width < 600 ? 0.72 : 1.05;
    ctx.strokeStyle = "rgba(64,113,114,.83)";
    for (const course of watercourses) {
      const end = Math.ceil((0.13 + 0.87 * phase) * course.length);
      ctx.beginPath();
      for (let i = 0; i < end; i++) {
        const [x, y] = this.screen(...course[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawImpression(phase) {
    const preview = this.preview;
    if (!preview) return;
    const site = PLACES[preview.id];
    const [x, y] = this.screen(...site.center);
    const visible = x >= 4 && x <= this.width - 4 && y >= 4 && y <= this.height - 4;
    this.ghost.classList.toggle("is-visible", visible);
    if (!visible) return;
    const w = this.ghost.offsetWidth, h = this.ghost.offsetHeight;
    const size = this.width < 600 ? 32 : 47;
    let cx = clamp(x, w / 2 + 6, this.width - w / 2 - 6);
    let cy = y - size * 0.64 - h;
    if (cy < 6) {
      cx = clamp(x + (x > this.width / 2 ? -1 : 1) * (w * 0.6 + size), w / 2 + 6, this.width - w / 2 - 6);
      cy = Math.max(5, Math.min(y - h * 0.46, this.height - h - 5));
    }
    this.ghost.style.transform = "translate(" + (cx - w / 2) + "px," + cy + "px)";
    const { ctx } = this;
    const layer = detailLayers.get(preview.id);
    const image = this.getImage(layer.url);
    const radius = size * (1 - (1 - phase) ** 3);
    ctx.save();
    if (radius > 1 && image.complete && image.naturalWidth) {
      const [west, south, east, north] = layer.bounds;
      const ix = (site.center[0] - west) / (east - west) * image.naturalWidth;
      const iy = (northing(north) - northing(site.center[1])) /
        (northing(north) - northing(south)) * image.naturalHeight;
      const sample = Math.min(image.naturalWidth * 0.38, site.span * 0.41 / (east - west) * image.naturalWidth);
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(image, ix - sample / 2, iy - sample / 2, sample, sample, x - radius, y - radius, 2 * radius, 2 * radius);
      ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#faf7eb"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = site.ink; ctx.lineWidth = 0.95; ctx.stroke();
    }
    ctx.globalAlpha = phase * 0.83;
    ctx.strokeStyle = site.ink; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(cx, cy + h - 1); ctx.lineTo(x, y - 4); ctx.stroke();
    ctx.restore();
  }
  markerGroups() {
    const { width, height, camera } = this;
    if (this.route.level === "country" && camera.span > 7) {
      return Object.keys(CITIES).map((city) => {
        const id = cityStudies[city].site, [x, y] = at(camera, width, height, PLACES[id].center);
        return { id: city, site: id, city, x, y, national: true, members: [id] };
      });
    }
    const ids = this.route.city ? CITIES[this.route.city].places : Object.keys(PLACES);
    const points = [];
    for (const id of ids) {
      const center = PLACES[id].center;
      const [screenX, screenY] = this.screen(...center);
      if (screenX < -90 || screenX > width + 90 || screenY < -65 || screenY > height + 65) continue;
      const [x, y] = at(camera, width, height, center);
      points.push({ id, site: id, city: PLACES[id].city, x, y });
    }
    // Keep the garden action and an index preview on their own exact coordinates.
    const isIndividual = ({ id }) => id === this.route.place ||
      (this.preview?.source === "index" && id === this.preview.id);
    const radius = camera.span < 0.032 ? 0 : width <= 520 ? 22 : 19;
    const individuals = points.filter(isIndividual).map(point => ({ ...point, members: [point.id] }));
    return individuals.concat(groupMarkers(points.filter(point => !isIndividual(point)), radius));
  }
  drawMarkers() {
    const groups = this.markerGroups();
    const key = [this.route.level, this.route.place, getLanguage(), ...groups.map(g => g.id + ":" + g.members.join(","))].join("/");
    if (this.markerKey !== key) {
      this.markerKey = key;
      const buttons = groups.map((g) => {
        const site = PLACES[g.site], city = CITIES[g.city];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "atlas-marker";
        button.dataset.id = g.id;
        button.dataset.preview = g.site;
        button.atlasMark = g;
        button.style.setProperty("--spot-ink", site.ink);
        button.classList.toggle("is-national", Boolean(g.national));
        button.classList.toggle("is-cluster", g.members.length > 1);
        const label = placeText(g.national ? city.name : site.name);
        const subtitle = g.national ? t("atlas.placeCount", { count: city.places.length }) : "";
        const action = g.members.length > 1 ? t("atlas.cluster", { count: g.members.length }) :
          this.route.place === g.id ? t("atlas.enter") : subtitle;
        button.setAttribute("aria-label", action ? label + " · " + action : label);
        button.innerHTML = '<i aria-hidden="true"><b></b></i><span><strong></strong><small></small></span>';
        button.querySelector("b").textContent = g.members.length > 1 ? g.members.length : "";
        button.querySelector("strong").textContent = label;
        button.querySelector("small").textContent = subtitle;
        button.atlasLabel = label;
        return button;
      });
      this.markers.replaceChildren(...buttons);
    }
    const candidates = [];
    for (const button of this.markers.children) {
      const mark = button.atlasMark;
      const [x, y] = this.screen(...PLACES[mark.site].center);
      button.hidden = x < 0 || y < 0 || x > this.width || y > this.height;
      if (button.hidden) continue;
      button.style.left = x + "px"; button.style.top = y + "px";
      const hot = mark.members.includes(this.preview?.id) || mark.id === this.route.place;
      button.classList.toggle("is-current", hot);
      candidates.push({ button, mark, x, y, hot });
    }
    this.layoutLabels(candidates);
  }
  layoutLabels(candidates) {
    const { width, height, ctx } = this;
    const occupied = [];
    candidates.sort((a, b) => Number(b.hot) - Number(a.hot) || b.mark.members.length - a.mark.members.length);
    for (const { button, mark, x, y, hot } of candidates) {
      const national = mark.national, compact = width <= 520;
      const font = national ? compact ? 14 : 19 : compact ? 12 : 14;
      ctx.font = font + "px Georgia, SimSun, serif";
      const labelWidth = Math.min(compact ? width * 0.46 : 245, Math.max(national && !compact ? 55 : 0, Math.ceil(ctx.measureText(button.atlasLabel).width) + 10));
      const labelHeight = national && !compact ? 35 : font + 8;
      const gap = mark.members.length > 1 || national ? 13 : 8;
      const right = [gap, -labelHeight / 2], left = [-labelWidth - gap, -labelHeight / 2];
      const preferLeft = x > width * 0.78 || (national && ["dunhuang", "chengdu"].includes(mark.city));
      const locations = [...(preferLeft ? [left, right] : [right, left]), [-labelWidth / 2, gap], [-labelWidth / 2, -labelHeight - gap]];
      if (hot && button.labelOffset) locations.unshift(button.labelOffset);
      button.classList.remove("has-label");
      for (const [dx, dy] of locations) {
        const box = { left: x + dx, right: x + dx + labelWidth, top: y + dy, bottom: y + dy + labelHeight };
        if (box.left < 3 || box.right > width - 3 || box.top < 2 || box.bottom > height - 2) continue;
        if (!hot && occupied.some(other => overlaps(box, other))) continue;
        if (!hot && !national && candidates.some(other => other.button !== button && other.x > box.left - 4 && other.x < box.right + 4 && other.y > box.top - 4 && other.y < box.bottom + 4)) continue;
        button.style.setProperty("--label-x", dx + "px");
        button.style.setProperty("--label-y", dy + "px");
        button.style.setProperty("--label-width", labelWidth + "px");
        button.labelOffset = [dx, dy];
        button.classList.add("has-label");
        occupied.push(box);
        break;
      }
    }
  }
}

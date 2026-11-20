import { getLanguage, placeText, t } from "../i18n/LanguageController.js";
import { CHINA, CITIES, PLACES } from "./places.js";
import { cityStudies } from "./identities.js";
import { FieldStudy } from "./FieldStudy.js";
import { groupMarkers, overlaps } from "./markerLayout.js";
import { routeAtZoom } from "./zoomRoute.js";
import { VectorBasemap } from "./VectorBasemap.js";
import bounds from "./maps/place-bounds.json";
import watercourses from "./maps/watercourses.json";

const areas = Object.values(bounds);
const backgroundAreas = ["city", "region"].flatMap(level => areas.filter(area => area.level === level));
const detailLayers = new Map(areas.filter(area => PLACES[area.level]).map(area => [area.level, area]));

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
const magnifies = (preview) => preview?.source === "index" || preview?.source === "marker";

export class AtlasMap {
  constructor(root, navigate, onPreview) {
    this.root = root;
    this.navigate = navigate;
    this.onPreview = onPreview;
    this.canvas = root.querySelector("#atlas-canvas");
    // A CPU-backed map avoids repeated GPU path tessellation during camera flights.
    // The separate garden canvas still uses its WebGL renderer.
    this.ctx = this.canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    this.markers = root.querySelector("#atlas-markers");
    this.ghost = root.querySelector("#atlas-ghost");
    this.study = new FieldStudy(root.querySelector("#atlas-plate"));
    this.caption = root.querySelector("#plate-caption");
    this.scale = root.querySelector("#atlas-scale");
    this.zoomIn = root.querySelector("#atlas-zoom-in");
    this.zoomOut = root.querySelector("#atlas-zoom-out");
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.route = { level: "country" };
    this.basemap = new VectorBasemap(() => this.queueDraw());
    this.pointers = new Map();
    this.inkStarted = performance.now();
    this.width = this.height = 1;
    this.zoomIn.onclick = () => this.zoom(1.8);
    this.zoomOut.onclick = () => this.zoom(1 / 1.8);
    root.querySelector("#atlas-fit").onclick = () => this.recenter();
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
      const delta = event.deltaY * (event.deltaMode === 2 ? this.height : event.deltaMode === 1 ? 16 : 1);
      const point = this.point(event), now = performance.now();
      const previous = this.wheelAnchor;
      const continuing = previous && now - previous.time < 260 && Math.hypot(point.x - previous.x, point.y - previous.y) < 5;
      const site = continuing ? previous.site : event.target.closest(".atlas-marker")?.dataset.preview;
      this.wheelAnchor = { ...point, time: now, site };
      // A pin or its label may be several kilometres wide at national scale.
      // Keep its real coordinate under the gesture as the markers regroup.
      const [x, y] = site ? this.screen(...PLACES[site].center) : [point.x, point.y];
      this.zoom(Math.exp(-clamp(delta, -260, 260) * 0.0025), { x, y });
    }, { passive: false });
    root.addEventListener("pointerdown", (event) => this.beginPan(event));
    root.addEventListener("pointermove", (event) => this.move(event));
    const release = (event) => {
      this.pointers.delete(event.pointerId);
      if (!this.pointers.size) this.canvas.classList.remove("is-panning");
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);
    root.addEventListener("lostpointercapture", (event) => {
      if (event.target === root) release(event);
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(root);
    const trackResolution = () => {
      matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener("change", () => {
        this.resize();
        trackResolution();
      }, { once: true });
    };
    trackResolution();
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
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, Math.sqrt(16000000 / (w * h)));
    this.canvas.width = Math.round(w * this.pixelRatio);
    this.canvas.height = Math.round(h * this.pixelRatio);
    const fit = this.target(this.route);
    if (!this.camera || !this.manual) { this.flight = null; this.camera = fit; }
    else if (oldFit) this.camera.span *= fit.span / oldFit;
    this.fittedSpan = fit.span;
    this.previewTween = null;
    this.draw();
  }
  hasSidePanel() {
    return !matchMedia("(max-width:879px), (max-width:950px) and (orientation:portrait)").matches;
  }
  target(route) {
    const area = PLACES[route.place] ?? CITIES[route.city] ?? CHINA;
    const [x, lat] = area.center;
    const dy = northing(lat + area.latitudeSpan / 2) - northing(lat - area.latitudeSpan / 2);
    const overlay = this.hasSidePanel();
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
    this.study.hide();
    this.ghost.classList.remove("is-visible");
    delete this.ghost.dataset.place;
  }
  followZoom(route) {
    this.clearPreview();
    this.route = route;
    this.fittedSpan = this.target(route).span;
  }
  recenter() {
    this.fly(this.route);
    this.onPreview(this.route.place ?? null, "selected");
  }
  fly(route, immediate = false) {
    const from = this.view ?? this.camera;
    this.wheelAnchor = null;
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
    this.flyTo(from, { x: (lowX + highX) / 2 - (this.hasSidePanel() ? span * 0.08 : 0), y: (lowY + highY) / 2, span }, 620);
  }
  takeControl() {
    this.camera = { ...(this.view ?? this.camera) };
    this.view = this.camera;
    this.previewTween = null;
    this.flight = null;
    if (this.preview) this.preview.source = "manual";
    this.manual = true;
  }
  beginPan(event) {
    if (event.button !== 0 || event.target.closest(".atlas-tools") || this.pointers.size >= 2) return;
    const onPin = Boolean(event.target.closest(".atlas-marker"));
    if (onPin && event.pointerType !== "touch") return;
    this.wheelAnchor = null;
    this.pointers.set(event.pointerId, { ...this.point(event), tap: onPin });
    if (onPin && this.pointers.size === 1) return;
    this.takeControl();
    for (const id of this.pointers.keys()) this.root.setPointerCapture(id);
    this.canvas.classList.add("is-panning");
  }
  move(event) {
    const old = this.pointers.get(event.pointerId);
    if (!old) return;
    const point = this.point(event);
    const second = [...this.pointers].find(([id]) => id !== event.pointerId)?.[1];
    if (old.tap && !second) {
      if (Math.hypot(point.x - old.x, point.y - old.y) < 6) return;
      this.takeControl();
      this.root.setPointerCapture(event.pointerId);
      this.canvas.classList.add("is-panning");
    }
    this.pointers.set(event.pointerId, point);
    if (second) {
      const distance = (p) => Math.max(1, Math.hypot(p.x - second.x, p.y - second.y));
      const midpoint = (p) => ({ x: (p.x + second.x) / 2, y: (p.y + second.y) / 2 });
      this.zoom(distance(point) / distance(old), midpoint(old), midpoint(point));
      return;
    }
    const unit = this.camera.span / this.width;
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
    for (const layer of backgroundAreas) {
      if (inside(layer.bounds, lon, lat)) return layer.level === "city" ? 0.07 : 0.55;
    }
    return 6;
  }
  zoom(factor, point = { x: this.width * (this.hasSidePanel() ? 0.605 : 0.5), y: this.height / 2 }, nextPoint = point) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    this.takeControl();
    const c = this.camera;
    const old = c.span;
    const lon = c.x + (point.x - this.width / 2) * old / this.width;
    const y = c.y - (point.y - this.height / 2) * old / this.width, lat = latitude(y);
    const overview = this.target({ level: "country" });
    c.span = clamp(old / factor, Math.min(old, this.minimum(lon, lat)), overview.span);
    c.x = clamp(lon - (nextPoint.x - this.width / 2) * c.span / this.width, 73, 135);
    c.y = clamp(y + (nextPoint.y - this.height / 2) * c.span / this.width, northing(17), northing(54));
    if (c.span > old && c.span > overview.span * 0.60) {
      const start = Math.max(old, overview.span * 0.60);
      const pull = (c.span - start) / (overview.span - start);
      c.x += (overview.x - c.x) * pull;
      c.y += (overview.y - c.y) * pull;
    }
    if (c.span !== old) {
      const next = routeAtZoom(this.route, c.span, c.span > old, [lon, lat], route => this.target(route).span);
      if (next !== this.route) { this.navigate(next, { fromZoom: true }); return; }
    }
    this.draw();
  }
  setPreview(id, source = "marker") {
    if (id === this.preview?.id && source === this.preview?.source) return;
    if (!id && !this.preview) return;
    const from = this.view ?? this.camera;
    const previous = this.preview;
    if (id) {
      const site = PLACES[id];
      this.preview = { id, source, start: previous?.id === id ? previous.start : performance.now() };
      if (previous?.id !== id) this.study.show(id, site.study, site.ink);
      this.ghost.style.setProperty("--spot-ink", site.ink);
      this.ghost.dataset.place = id;
      this.caption.textContent = placeText(site.name) + "  /  " + placeText(site.motif);
    } else {
      this.clearPreview();
    }
    this.previewTween = !this.reduced.matches && !this.flight && (magnifies(previous) || magnifies(this.preview))
      ? { from, start: performance.now() } : null;
    this.draw();
  }
  previewCamera() {
    if (!magnifies(this.preview) || this.flight) return this.camera;
    const [lon, lat] = PLACES[this.preview.id].center;
    let [x, y] = at(this.camera, this.width, this.height, [lon, lat]);
    if (this.preview.source === "index") {
      x = clamp(x, this.width * (this.hasSidePanel() ? 0.37 : 0.13), this.width * 0.86);
      y = clamp(y, this.height * 0.30, this.height * 0.84);
    }
    const span = this.camera.span / (this.route.level === "country" ? 1.13 : 1.09);
    return { x: lon - (x - this.width / 2) * span / this.width, y: northing(lat) + (y - this.height / 2) * span / this.width, span };
  }
  screen(lon, lat) { return at(this.view, this.width, this.height, [lon, lat]); }
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
    const detail = this.basemap.draw(ctx, this.view, w, h, { language: getLanguage() });
    this.canvas.dataset.detailLevel = detail ? String(detail) : "national";
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
    const focusLon = this.camera.x + (this.hasSidePanel() ? 0.105 * this.camera.span : 0);
    this.zoomIn.disabled = this.camera.span <= this.minimum(focusLon, latitude(this.camera.y)) * 1.0001;
    this.zoomOut.disabled = this.camera.span >= this.target({ level: "country" }).span * 0.999999;
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
    this.study.setVisible(visible);
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
    const radius = size * (1 - (1 - phase) ** 3);
    ctx.save();
    if (radius > 1) {
      const reach = radius * 2.45;
      const pool = ctx.createRadialGradient(x - radius * 0.38, y - radius * 0.4, 0, x, y, reach);
      pool.addColorStop(0, "#fff3c994");
      pool.addColorStop(0.48, "#ffedba57");
      pool.addColorStop(1, "#fff3cc00");
      ctx.fillStyle = pool;
      ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
    }
    if (radius > 1) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
      ctx.save();
      ctx.translate(x - radius, y - radius);
      const span = Math.min(.018, site.span * .4, this.view.span * size / this.width) * radius / size;
      this.basemap.draw(ctx, { x: site.center[0], y: northing(site.center[1]), span }, radius * 2, radius * 2, { lens: true });
      ctx.restore();
      const glass = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
      glass.addColorStop(0, "#fff9dda8"); glass.addColorStop(0.40, "#fff9e50a");
      glass.addColorStop(1, site.ink + "27");
      ctx.fillStyle = glass; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#faf7eb"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = site.ink; ctx.lineWidth = 0.95; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, radius - 1.4), Math.PI * 1.02, Math.PI * 1.68);
      ctx.strokeStyle = "#fffcdd"; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.globalAlpha = phase * 0.83;
    const thread = ctx.createLinearGradient(cx, cy + h, x, y);
    thread.addColorStop(0, site.ink); thread.addColorStop(0.58, "#bd9a55"); thread.addColorStop(1, site.ink);
    ctx.strokeStyle = thread; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy + h - 1); ctx.lineTo(x, y - 4); ctx.stroke();
    ctx.restore();
  }
  markerGroups() {
    const { width, height, camera } = this;
    if (this.route.level === "country") {
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

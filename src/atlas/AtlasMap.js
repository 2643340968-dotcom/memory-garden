import { getLanguage, placeText, t } from "../i18n/LanguageController.js";
import { CHINA, CITIES, PLACES } from "./places.js";
import { cityStudies } from "./identities.js";
import { FieldStudy } from "./FieldStudy.js";
import { groupMarkers, overlaps, placeSpecimen } from "./markerLayout.js";
import { adjacentStop, routeAtZoom } from "./zoomRoute.js";
import { AtlasCharts } from "./AtlasCharts.js";
import watercourses from "./maps/watercourses.json";

const closestSpan = .006;

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
const stops = { country: 440, city: 380, place: 300 };
const magnifies = (preview) => preview?.source === "marker" || preview?.source === "keyboard";

export class AtlasMap {
  constructor(root, navigate, onPreview) {
    this.root = root;
    this.navigate = navigate;
    this.onPreview = onPreview;
    this.canvas = root.querySelector("#atlas-canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.lens = root.querySelector("#atlas-lens");
    this.leader = root.querySelector("#atlas-leader");
    this.markers = root.querySelector("#atlas-markers");
    this.ghost = root.querySelector("#atlas-ghost");
    this.study = new FieldStudy(root.querySelector("#atlas-plate"));
    this.caption = root.querySelector("#plate-caption");
    this.platePlace = root.querySelector("#plate-place");
    this.plateReason = root.querySelector("#plate-reason");
    this.scale = root.querySelector("#atlas-scale");
    this.zoomIn = root.querySelector("#atlas-zoom-in");
    this.zoomOut = root.querySelector("#atlas-zoom-out");
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.route = { level: "country" };
    this.charts = new AtlasCharts(root, () => this.queueDraw());
    this.textWidths = new Map();
    document.fonts.addEventListener("loadingdone", () => {
      this.textWidths.clear();
      this.annotationKey = null;
      this.queueDraw();
    });
    this.pointers = new Map();
    this.width = this.height = 1;
    this.zoomIn.onclick = () => this.zoom(1.55);
    this.zoomOut.onclick = () => this.zoom(1 / 1.55);
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
      this.zoom(Math.exp(-clamp(delta, -260, 260) * 0.0025), point, point, false, site);
    }, { passive: false });
    root.addEventListener("pointerdown", (event) => this.beginPan(event));
    root.addEventListener("pointermove", (event) => this.move(event));
    const release = (event) => {
      this.pointers.delete(event.pointerId);
      if (!this.pointers.size) { this.canvas.classList.remove("is-panning"); this.queueDraw(); }
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);
    root.addEventListener("lostpointercapture", (event) => {
      if (event.target === root) release(event);
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.ghostSize = new ResizeObserver(([entry]) => {
      this.plateWidth = entry.contentRect.width;
      this.plateHeight = entry.contentRect.height;
      this.queueDraw();
    });
    this.ghostSize.observe(this.ghost);
    this.observer.observe(root);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.queueDraw();
    });
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
    const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(16000000 / (w * h)));
    if (this.width === w && this.height === h && this.pixelRatio === dpr) return;
    const oldFit = this.fittedSpan;
    const widthRatio = w / this.width, heightRatio = h / this.height;
    this.width = w;
    this.height = h;
    this.pixelRatio = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.annotationKey = null;
    const fit = this.target(this.route);
    const spanRatio = oldFit ? fit.span / oldFit : 1;
    if (!this.camera || !this.manual) this.camera = fit;
    else this.camera = { ...this.camera, span: this.camera.span * spanRatio };
    // Adapt the same flight when the responsive map changes height mid-landing.
    if (this.flight) {
      this.flight.from = { ...this.flight.from, span: this.flight.from.span * spanRatio };
      this.flight.to = this.camera;
    }
    if (this.queuedZoom) {
      const resized = point => ({ x: point.x * widthRatio, y: point.y * heightRatio });
      this.queuedZoom.point = resized(this.queuedZoom.point);
      this.queuedZoom.nextPoint = resized(this.queuedZoom.nextPoint);
    }
    this.fittedSpan = fit.span;
    this.previewTween = null;
    this.queueDraw();
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
    this.lens.hidden = true;
    this.leader.hidden = true;
    this.charts.layers.lens.wanted = null;
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
    let from = this.view ?? this.camera;
    this.wheelAnchor = null;
    this.queuedZoom = null;
    this.clearPreview();
    this.route = route;
    this.manual = false;
    const dest = this.target(route);
    this.fittedSpan = dest.span;
    const arrival = !this.presented && route.level === "country";
    if (arrival) from = { ...dest, span: dest.span * 1.12 };
    this.flyTo(from, dest, immediate && !arrival ? 0 : stops[route.level], route.level);
  }
  flyTo(from, to, duration, node = null, direction = 0) {
    this.previewTween = null;
    this.camera = to;
    this.flight = !this.reduced.matches && from && duration
      ? { from: { ...from }, to, start: performance.now(), duration, node, direction } : null;
    this.queueDraw();
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
    this.queuedZoom = null;
    this.flyTo(from, { x: (lowX + highX) / 2 - (this.hasSidePanel() ? span * 0.08 : 0), y: (lowY + highY) / 2, span }, 260);
  }
  takeControl() {
    if (this.flight || this.previewTween || magnifies(this.preview)) this.camera = { ...(this.view ?? this.camera) };
    this.view = this.camera;
    this.previewTween = null;
    this.flight = null;
    this.queuedZoom = null;
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
      this.zoom(distance(point) / distance(old), midpoint(old), midpoint(point), true);
      return;
    }
    const unit = this.camera.span / this.width;
    this.camera.x = clamp(this.camera.x - (point.x - old.x) * unit, 73, 135);
    this.camera.y = clamp(this.camera.y + (point.y - old.y) * unit, northing(17), northing(54));
    this.queueDraw();
  }
  zoom(factor, point = { x: this.width * (this.hasSidePanel() ? 0.605 : 0.5), y: this.height / 2 }, nextPoint = point, touch = false, site = null) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const direction = Math.sign(Math.log(factor));
    if (direction && this.flight?.direction === direction) {
      this.queuedZoom = { factor: Math.max(.001, Math.min(1000, factor * (this.queuedZoom?.factor ?? 1))), point, nextPoint, touch, site };
      return;
    }
    const from = this.view ?? this.camera;
    // Successive free wheel deltas accumulate on the logical destination,
    // even when they arrive before the next display frame.
    if (this.flight?.node || magnifies(this.preview) || this.previewTween) this.takeControl();
    else { this.flight = null; this.queuedZoom = null; this.manual = true; }
    const c = { ...this.camera };
    // A label can be kilometres wide at country scale. Anchor to its surveyed
    // point on the current camera, including when a gesture reverses a landing.
    if (site) {
      const [x, y] = at(c, this.width, this.height, PLACES[site].center);
      point = nextPoint = { x, y };
    }
    const old = c.span;
    const lon = c.x + (point.x - this.width / 2) * old / this.width;
    const y = c.y - (point.y - this.height / 2) * old / this.width, lat = latitude(y);
    const overview = this.target({ level: "country" });
    c.span = clamp(old / factor, closestSpan, overview.span);
    c.x = clamp(lon - (nextPoint.x - this.width / 2) * c.span / this.width, 73, 135);
    c.y = clamp(y + (nextPoint.y - this.height / 2) * c.span / this.width, northing(17), northing(54));
    if (c.span > old && c.span > overview.span * 0.60) {
      const start = Math.max(old, overview.span * 0.60);
      const pull = (c.span - start) / (overview.span - start);
      c.x += (overview.x - c.x) * pull;
      c.y += (overview.y - c.y) * pull;
    }
    const wanted = c.span === old ? this.route :
      routeAtZoom(this.route, c.span, c.span > old, [lon, lat], route => this.target(route).span);
    if (wanted !== this.route) {
      const next = adjacentStop(this.route, wanted);
      const fit = this.target(next);
      let dest = fit;
      if (factor > 1) {
        const span = next.level === "place" ? Math.max(closestSpan, Math.min(c.span * .69, fit.span * .68))
          : Math.min(fit.span, old * .72);
        dest = { span, x: lon - (nextPoint.x - this.width / 2) * span / this.width,
          y: y + (nextPoint.y - this.height / 2) * span / this.width };
      }
      const remainder = wanted !== next ? { factor: dest.span / c.span, point: nextPoint, nextPoint, touch, site } : null;
      this.flyTo(from, dest, stops[next.level], next.level, direction);
      this.navigate(next, { fromZoom: true });
      if (this.flight) this.queuedZoom = remainder;
      else if (remainder) this.zoom(remainder.factor, nextPoint, nextPoint, touch, site);
      return;
    }
    this.flyTo(from, c, touch ? 0 : 115);
  }
  localizePreview() {
    if (!this.preview) return;
    const site = PLACES[this.preview.id];
    this.caption.textContent = placeText(site.motif);
    this.platePlace.textContent = placeText(site.name);
    this.plateReason.textContent = placeText(site.flowerReason);
  }
  setPreview(id, source = "marker", anchor = null) {
    if (id === this.preview?.id && source === this.preview?.source) return;
    if (!id && !this.preview) return;
    const from = this.view ?? this.camera;
    const previous = this.preview;
    if (id) {
      const site = PLACES[id];
      this.preview = { id, source, anchor, start: previous?.id === id ? previous.start : performance.now() };
      if (previous?.id !== id) this.study.show(id, site.study, site.ink);
      this.ghost.style.setProperty("--spot-ink", site.ink);
      this.ghost.dataset.place = id;
      this.localizePreview();
    } else {
      this.clearPreview();
    }
    this.previewTween = !this.reduced.matches && !this.flight && (magnifies(previous) || magnifies(this.preview))
      ? { from, start: performance.now() } : null;
    this.queueDraw();
  }
  previewCamera(base) {
    if (!magnifies(this.preview) || this.flight || this.reduced.matches) return base;
    const [lon, lat] = PLACES[this.preview.id].center;
    let [x, y] = at(base, this.width, this.height, [lon, lat]);
    // The reading centre excludes the fixed title on wide layouts. Keep the
    // excursion small enough that neighbouring flowers remain discoverable.
    const dx = this.width * (this.hasSidePanel() ? 0.62 : 0.5) - x;
    const dy = this.height * 0.5 - y;
    const pull = Math.min(0.26, 48 / Math.max(1, Math.hypot(dx, dy)));
    x += dx * pull;
    y += dy * pull;
    const span = base.span / (this.route.level === "country" ? 1.13 : 1.09);
    return { x: lon - (x - this.width / 2) * span / this.width, y: northing(lat) + (y - this.height / 2) * span / this.width, span };
  }
  screen(lon, lat) { return at(this.view, this.width, this.height, [lon, lat]); }
  draw() {
    if (!this.camera || !this.ctx || this.root.closest("[hidden]")) return;
    const { ctx, width: w, height: h } = this;
    const now = performance.now();
    let camera = this.camera, replay = null;
    if (this.flight) {
      const f = this.flight, p = clamp((now - f.start) / f.duration, 0, 1);
      const ease = f.node ? 1 - (1 - p) ** 3 * (1 + 1.4 * p) : 1 - (1 - p) ** 3;
      camera = blendCamera(f.from, f.to, ease);
      if (p === 1) { this.flight = null; replay = this.queuedZoom; this.queuedZoom = null; }
    }
    this.root.dataset.arrival = this.flight?.node ?? "";
    this.presented = true;
    const desired = this.previewCamera(camera);
    this.view = desired;
    if (this.previewTween) {
      const p = clamp((now - this.previewTween.start) / 390, 0, 1);
      this.view = blendCamera(this.previewTween.from, desired, smooth(p));
      if (p === 1) this.previewTween = null;
    }
    const moving = Boolean(this.flight || this.pointers.size || this.previewTween);
    this.root.classList.toggle("is-moving", moving);
    this.study.setTraveling(Boolean(this.flight || this.pointers.size));
    const chart = this.charts.update("base", this.view, w, h, this.pixelRatio, getLanguage(), moving);
    this.canvas.dataset.detailLevel = chart?.frame.level ? String(chart.frame.level) : "national";
    const opening = this.preview && !this.reduced.matches ? clamp((now - this.preview.start) / 420, 0, 1) : 1;
    const groups = this.markerGroups();
    const studyBox = this.drawImpression(opening, moving, groups);
    const reserved = this.drawMarkers(studyBox, groups);
    const annotationKey = [this.view.x,this.view.y,this.view.span,w,h,this.pixelRatio,getLanguage(),this.route.level,
      this.preview?.id,this.plateWidth,this.plateHeight,this.markerKey].join("/");
    if (!moving && (this.annotationKey !== annotationKey || this.annotationFrame !== chart?.frame)) {
      this.annotationKey = annotationKey;
      this.annotationFrame = chart?.frame;
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      ctx.clearRect(0, 0, w, h);
      this.drawGrid(reserved);
      if (chart?.scale > .73 && chart.scale < 1.4) this.drawStreetNames(chart, reserved);
      if (this.view.span > 9) this.drawWater(1);
    }
    this.charts.flush();
    const scaleKm = this.view.span / w * 111.32 * Math.cos(latitude(this.view.y) * Math.PI / 180);
    const unit = 10 ** Math.floor(Math.log10(scaleKm * 78));
    const km = [5, 2, 1].find(v => v * unit <= scaleKm * 78) * unit;
    this.scale.lastElementChild.style.width = km / scaleKm + "px";
    this.scale.firstElementChild.textContent = km < 1 ? Math.round(km * 1000) + " m" : km + " km";
    this.zoomIn.disabled = camera.span <= closestSpan * 1.0001;
    this.zoomOut.disabled = camera.span >= this.target({ level: "country" }).span * 0.999999;
    if (this.flight || this.previewTween || opening < 1) this.queueDraw();
    if (replay) this.zoom(replay.factor, replay.point, replay.nextPoint, replay.touch, replay.site);
  }
  measure(label, font) {
    const key = font + "|" + label;
    if (!this.textWidths.has(key)) {
      this.ctx.font = font;
      if (this.textWidths.size >= 4000) this.textWidths.clear();
      this.textWidths.set(key, this.ctx.measureText(label).width);
    }
    return this.textWidths.get(key);
  }
  drawStreetNames({ frame, scale, x: ox, y: oy }, reserved) {
    const ctx = this.ctx, names = new Set();
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 2.6; ctx.lineJoin = "round";
    ctx.strokeStyle = "#f4f0dfd9";
    for (const { x, y, rank, name } of frame.labels) {
      const sx = ox + x * scale, sy = oy + y * scale;
      if (sx < 12 || sx > this.width - 12 || sy < 22 || sy > this.height - 14 || names.has(name)) continue;
      const font = (rank < 2 ? "12px" : "11px") + ' Georgia, "Microsoft YaHei", sans-serif';
      const half = this.measure(name, font) / 2;
      const rect = { left: sx - half - 6, right: sx + half + 6, top: sy - 9, bottom: sy + 9 };
      if (rect.left < 4 || rect.right > this.width - 4 || reserved.some(b => overlaps(b, rect, 6))) continue;
      reserved.push(rect); names.add(name);
      ctx.font = font;
      ctx.fillStyle = rank === 1 ? "#647d77" : "#777b69";
      ctx.strokeText(name, sx, sy); ctx.fillText(name, sx, sy);
    }
    ctx.restore();
  }
  drawGrid(reserved) {
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
      const rect = { left: x-half, right: x+half, top: y-13, bottom: y+3 };
      if (reserved.some(other => overlaps(rect, other))) continue;
      reserved.push(rect);
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

  drawImpression(phase, moving, groups) {
    const preview = this.preview;
    if (!preview) return;
    const site = PLACES[preview.id];
    const [x, y] = this.screen(...site.center);
    const visible = x >= 4 && x <= this.width - 4 && y >= 4 && y <= this.height - 4;
    this.ghost.classList.toggle("is-visible", visible);
    this.lens.hidden = !visible;
    this.leader.hidden = !visible;
    this.study.setVisible(visible);
    if (!visible) { this.charts.layers.lens.wanted = null; return; }
    const w = this.plateWidth || this.ghost.offsetWidth, h = this.plateHeight || this.ghost.offsetHeight;
    const size = this.width < 600 ? 32 : 45;
    const bounds = { left:(this.hasSidePanel() ? this.width * .3 : 0) + 6, top:6, right:this.width-6, bottom:this.height-6 };
    const keepClear = [{ left:this.width-76, top:this.height-166, right:this.width-4, bottom:this.height-4 }];
    if (preview.anchor) keepClear.push({ left:preview.anchor.x-2, right:preview.anchor.x+2, top:preview.anchor.y-2, bottom:preview.anchor.y+2 });
    for (const group of groups) {
      if (group.site === preview.id) continue;
      const [px, py] = this.screen(...PLACES[group.site].center);
      keepClear.push({ left:px-16, top:py-16, right:px+16, bottom:py+16 });
    }
    const box = placeSpecimen(x, y, w, h, size+6, bounds, keepClear, preview.placement);
    preview.placement = box.index;
    this.ghost.style.transform = `translate(${box.left}px,${box.top}px)`;
    const open = 1 - (1 - phase) ** 3;
    this.lens.style.width = this.lens.style.height = size * 2 + "px";
    this.lens.style.transform = `translate(${x-size}px,${y-size}px) scale(${open})`;
    this.lens.style.setProperty("--spot-ink", site.ink);
    const span = Math.min(.018, site.span * .4, this.view.span * size / this.width);
    this.charts.update("lens", { x:site.center[0], y:northing(site.center[1]), span },
      size*2, size*2, this.pixelRatio, getLanguage(), moving);
    const joinX = clamp(x, box.left + 10, box.right - 10);
    const joinY = clamp(y, box.top, box.bottom);
    const dx = x-joinX, dy = y-joinY;
    this.leader.style.width = Math.hypot(dx,dy) + "px";
    this.leader.style.backgroundColor = site.ink;
    this.leader.style.transform = `translate(${joinX}px,${joinY}px) rotate(${Math.atan2(dy,dx)}rad)`;
    return box;
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
    const isIndividual = ({ id }) => id === this.route.place;
    const radius = camera.span < 0.032 ? 0 : width <= 520 ? 22 : 19;
    const individuals = points.filter(isIndividual).map(point => ({ ...point, members: [point.id] }));
    return individuals.concat(groupMarkers(points.filter(point => !isIndividual(point)), radius));
  }
  drawMarkers(studyBox, groups) {
    const key = [this.route.level, this.route.place, getLanguage(), ...groups.map(g => g.id + ":" + g.members.join(","))].join("/");
    if (this.markerKey !== key) {
      this.markerKey = key;
      const existing = new Map(Array.from(this.markers.children, button => [button.dataset.id, button]));
      for (const g of groups) {
        const site = PLACES[g.site], city = CITIES[g.city];
        let button = existing.get(g.id);
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = "atlas-marker";
          button.innerHTML = '<em class="atlas-hover-bridge" aria-hidden="true"></em><i aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false"><use href="#atlas-flower-pin"/></svg><b></b></i><span><strong></strong><small></small></span>';
          this.markers.append(button);
        }
        existing.delete(g.id);
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
        button.querySelector("b").textContent = g.members.length > 1 ? g.members.length : "";
        button.querySelector("strong").textContent = label;
        button.querySelector("small").textContent = subtitle;
        button.atlasLabel = label;
      }
      for (const button of existing.values()) button.remove();
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
      const described = mark.site === this.preview?.id && this.ghost.classList.contains("is-visible");
      if (described) button.setAttribute("aria-describedby", "atlas-ghost");
      else button.removeAttribute("aria-describedby");
      const bridge = button.firstElementChild;
      const anchor = described && this.preview.source === "marker" && this.preview.anchor;
      bridge.hidden = !anchor;
      if (anchor) {
        // A stationary mouse must still hover and click the moving flower,
        // including when it first touched the outer edge of a long place name.
        const dx = anchor.x - x, dy = anchor.y - y;
        bridge.style.width = Math.hypot(dx, dy) + 18 + "px";
        bridge.style.transform = `rotate(${Math.atan2(dy, dx)}rad) translateX(-9px)`;
      }
      candidates.push({ button, mark, x, y, hot });
    }
    return this.layoutLabels(candidates, studyBox);
  }
  layoutLabels(candidates, studyBox) {
    const { width, height } = this;
    const occupied = studyBox ? [studyBox] : [];
    const pins = candidates.map(({ button, x, y }) => ({ button, left:x-10, right:x+10, top:y-10, bottom:y+10 }));
    const serif = getLanguage() === "en" ? 'Baskerville, "Baskerville Old Face", Georgia, serif' :
      '"Garden Song", "Songti SC", "Noto Serif CJK SC", SimSun, serif';
    candidates.sort((a, b) => Number(b.mark.site === this.preview?.id) - Number(a.mark.site === this.preview?.id) ||
      Number(b.hot) - Number(a.hot) || b.mark.members.length - a.mark.members.length);
    for (const { button, mark, x, y, hot } of candidates) {
      const national = mark.national, compact = width <= 520;
      const font = hot ? compact ? 17 : 22 : national ? compact ? 16 : 20 : compact ? 14 : 16;
      const weight = hot || national ? 650 : 600;
      const natural = this.measure(button.atlasLabel, weight + " " + font + "px " + serif) + 13;
      const subtitle = national && !compact ? this.measure(button.querySelector("small").textContent, "11px sans-serif") + 16 : 0;
      const labelWidth = Math.ceil(Math.min(compact ? width * .48 : 240, Math.max(subtitle, natural)));
      const lines = hot && natural > labelWidth + 1 ? 2 : 1;
      const labelHeight = Math.ceil(lines * font * 1.26 + 5 + (national && !compact ? 14 : 0));
      button.style.setProperty("--label-font", font + "px");
      button.style.setProperty("--label-weight", weight);
      const gap = mark.members.length > 1 || national || hot ? 21 : 15;
      const right = [gap, -labelHeight / 2], left = [-labelWidth - gap, -labelHeight / 2];
      const preferLeft = x > width * 0.78 || (national && ["dunhuang", "chengdu"].includes(mark.city));
      const locations = [...(preferLeft ? [left, right] : [right, left]), [-labelWidth / 2, gap], [-labelWidth / 2, -labelHeight - gap]];
      if (hot) locations.push([clamp(x-labelWidth/2, 3, width-labelWidth-3)-x,
        y + labelHeight + gap < height ? gap : -labelHeight-gap]);
      let best = null;
      for (const [dx, dy] of locations) {
        const box = { left: x + dx, right: x + dx + labelWidth, top: y + dy, bottom: y + dy + labelHeight };
        if (box.left < 3 || box.right > width - 3 || box.top < 2 || box.bottom > height - 2) continue;
        const collisions = occupied.filter(other => overlaps(box, other, 2)).length +
          pins.filter(pin => pin.button !== button && overlaps(box, pin, 2)).length;
        if (!best || collisions < best.collisions) best = { box, dx, dy, collisions };
        if (!collisions) break;
      }
      const show = Boolean(best && (hot || !best.collisions));
      button.classList.toggle("has-label", show);
      if (show) {
        button.style.setProperty("--label-x", best.dx + "px");
        button.style.setProperty("--label-y", best.dy + "px");
        button.style.setProperty("--label-width", labelWidth + "px");
        occupied.push(best.box);
      }
    }
    return occupied.concat(pins);
  }
}

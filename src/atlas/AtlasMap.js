import { getLanguage, t } from "../i18n/LanguageController.js";
import { CHINA, CITIES, PLACES } from "./places.js";
import reliefUrl from "./maps/china-relief.webp";
import regionUrl from "./maps/lower-yangtze.webp";
import cityUrl from "./maps/nanjing.webp";
import siteUrl from "./maps/jiangdongmen.webp";

const layers = [
  { url: reliefUrl, bounds: [32, -38, 174, 78], reveal: Infinity, minSpan: 7 },
  { url: regionUrl, bounds: [115.3125, 29.535230, 123.75, 36.597889], reveal: 10, minSpan: 0.65 },
  { url: cityUrl, bounds: [118.476563, 31.802893, 119.003906, 32.249974], reveal: 0.85, minSpan: 0.10 },
  { url: siteUrl, bounds: [118.652344, 31.989442, 118.784180, 32.101190], reveal: 0.17, minSpan: 0.027 },
];
const annotations = [
  [104.1, 35.4, "C H I N A", "中 国", "country", 16, 220],
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
];

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const northing = (lat) => Math.asinh(Math.tan(lat * Math.PI / 180)) * 180 / Math.PI;
const latitude = (y) => Math.atan(Math.sinh(y * Math.PI / 180)) * 180 / Math.PI;

function minimumSpan(lon, lat) {
  return layers.findLast(({ bounds: [w,s,e,n] }) => lon >= w && lon <= e && lat >= s && lat <= n)?.minSpan ?? layers[0].minSpan;
}

export class AtlasMap {
  constructor(root, navigate) {
    this.root = root;
    this.navigate = navigate;
    this.canvas = root.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.markers = root.querySelector("#atlas-markers");
    this.scale = root.querySelector("#atlas-scale");
    this.zoomIn = root.querySelector("#atlas-zoom-in");
    this.zoomOut = root.querySelector("#atlas-zoom-out");
    this.route = { level: "country" };
    this.pointers = new Map();
    this.images = new Map();
    this.width = this.height = 1;
    this.zoomIn.onclick = () => this.zoom(1.8);
    this.zoomOut.onclick = () => this.zoom(1 / 1.8);
    root.querySelector("#atlas-fit").onclick = () => this.fly(this.route);
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      this.zoom(Math.exp(-clamp(delta, -260, 260) * 0.0025), this.point(event));
    }, { passive: false });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      this.stopFlight();
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
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
    this.fittedSpan = fit.span;
    if (!this.camera) this.camera = fit;
    else if (oldFit && !this.flight) this.camera.span *= fit.span / oldFit;
    this.draw();
  }

  target(route) {
    const area = PLACES[route.place] ?? CITIES[route.city] ?? CHINA;
    const [x, lat] = area.center;
    const dy = northing(lat + area.latitudeSpan / 2) - northing(lat - area.latitudeSpan / 2);
    return { x, y: northing(lat), span: Math.max(area.span, dy * this.width / this.height) };
  }

  stopFlight() {
    cancelAnimationFrame(this.flight);
    this.flight = 0;
  }

  fly(route, immediate = false) {
    this.stopFlight();
    this.route = route;
    this.markerKey = null;
    const dest = this.target(route);
    this.fittedSpan = dest.span;
    if (immediate || !this.camera || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.camera = dest;
      this.draw();
      return;
    }
    const start = { ...this.camera };
    const ratio = dest.span / start.span;
    const t0 = performance.now();
    const frame = (now) => {
      const p = clamp((now - t0) / 870, 0, 1);
      const ease = p * p * (3 - 2 * p);
      const size = ratio ** ease;
      // A stationary geographic point remains under the same screen pixel throughout a zoom.
      const pan = Math.abs(ratio - 1) < 0.0001 ? ease : (size - 1) / (ratio - 1);
      this.camera = { x: start.x + (dest.x-start.x)*pan, y: start.y + (dest.y-start.y)*pan, span: start.span*size };
      this.draw();
      this.flight = p < 1 ? requestAnimationFrame(frame) : 0;
    };
    this.flight = requestAnimationFrame(frame);
  }

  move(event) {
    const old = this.pointers.get(event.pointerId);
    if (!old) return;
    const point = this.point(event);
    const second = [...this.pointers].find(([id]) => id !== event.pointerId)?.[1];
    this.pointers.set(event.pointerId, point);
    if (second) {
      const dist = (a) => Math.hypot(a.x-second.x, a.y-second.y);
      this.zoom(dist(point)/Math.max(1, dist(old)), {
        x: (old.x+second.x)/2, y: (old.y+second.y)/2,
      });
    }
    const unit = this.camera.span/this.width * (second ? 0.5 : 1);
    this.camera.x = clamp(this.camera.x - (point.x-old.x)*unit, 73, 135);
    this.camera.y = clamp(this.camera.y + (point.y-old.y)*unit, northing(17), northing(54));
    const detail = layers.findLast((_, i) => i > 0 && this.camera.span < layers[i-1].minSpan);
    if (detail) {
      const [w,s,e,n] = detail.bounds;
      this.camera.x = clamp(this.camera.x,w,e);
      this.camera.y = clamp(this.camera.y,northing(s),northing(n));
    }
    this.draw();
  }

  zoom(factor, point = { x: this.width/2, y: this.height/2 }) {
    this.stopFlight();
    const c = this.camera;
    const old = c.span;
    const max = this.target({ level: "country" }).span * 1.12;
    const lon = c.x + (point.x - this.width/2) * old/this.width;
    const lat = latitude(c.y - (point.y - this.height/2) * old/this.width);
    c.span = clamp(old/factor, Math.min(old, minimumSpan(lon, lat)), max);
    const shift = (old - c.span)/this.width;
    c.x = clamp(c.x + (point.x - this.width/2)*shift, 73, 135);
    c.y = clamp(c.y - (point.y - this.height/2)*shift, northing(17), northing(54));
    this.draw();
  }

  screen(lon, lat) {
    const k = this.width / this.camera.span;
    return [this.width/2 + (lon-this.camera.x)*k, this.height/2 - (northing(lat)-this.camera.y)*k];
  }

  draw() {
    if (!this.camera || !this.ctx || !this.root.clientWidth) return;
    const { ctx, width: w, height: h } = this;
    const span = this.camera.span;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.fillStyle = "#1a1720";
    ctx.fillRect(0, 0, w, h);
    for (const { url, bounds: [west,south,east,north], reveal } of layers) {
      if (span >= reveal) continue;
      const [x,y] = this.screen(west,north);
      const [r,b] = this.screen(east,south);
      if (r < 0 || b < 0 || x > w || y > h) continue;
      let img = this.images.get(url);
      if (!img) {
        img = new Image();
        img.onload = () => this.draw();
        this.images.set(url,img);
        img.src = url;
      }
      if (img.complete && img.naturalWidth) {
        ctx.globalAlpha = clamp(Math.log2(reveal/span)*1.5, 0, 1);
        ctx.drawImage(img,x,y,r-x,b-y);
      }
    }
    ctx.globalAlpha = 1;
    this.drawGrid();
    this.drawMarkers();
    const scaleKm = span/w * 111.32 * Math.cos(latitude(this.camera.y)*Math.PI/180);
    const unit = 10 ** Math.floor(Math.log10(scaleKm * 78));
    const km = [5,2,1].find((v) => v*unit <= scaleKm*78) * unit;
    this.scale.lastElementChild.style.width = `${km / scaleKm}px`;
    this.scale.firstElementChild.textContent = km < 1 ? `${Math.round(km*1000)} m` : `${km} km`;
    this.zoomIn.disabled = span <= minimumSpan(this.camera.x, latitude(this.camera.y)) * 1.0001;
    this.zoomOut.disabled = span >= this.target({ level: "country" }).span * 1.11999;
  }

  drawGrid() {
    const { ctx, width: w, height: h, camera: c } = this;
    const country = c.span > 15;
    const step = 10 ** Math.floor(Math.log10(c.span / 3));
    const interval = step * (c.span/step > 12 ? 5 : 1);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(209,190,206,.15)";
    ctx.fillStyle = "rgba(214,198,211,.62)";
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
      const [x,y] = this.screen(lon,lat);
      const major = kind === "country";
      ctx.font = major ? `${w<500?15:21}px Georgia, serif` : `${kind==="street"?"":"italic "}${country && w>600?14:11}px Georgia, "SimSun", serif`;
      ctx.fillStyle = major ? "#d1bed0" : kind === "water" ? "#ad9eae" : "#c3b2bf";
      const label = getLanguage()==="en" ? en : zh;
      const half = ctx.measureText(label).width/2;
      if (x-half<8 || x+half>w-10 || y<34 || y>h-18) continue;
      ctx.strokeStyle = "rgba(36,29,39,.72)";
      ctx.lineWidth = 3;
      ctx.strokeText(label,x,y);
      ctx.fillText(label,x,y);
    }
    ctx.textAlign = "left";
  }

  drawMarkers() {
    const local = this.route.level !== "country" || this.camera.span < 2;
    const ids = local ? (CITIES[this.route.city]?.places ?? Object.keys(PLACES)) : Object.keys(CITIES);
    const key = `${local}:${ids.join()}:${getLanguage()}:${this.route.level}`;
    if (key !== this.markerKey) {
      this.markerKey = key;
      this.markers.replaceChildren();
      for (const id of ids) {
        const place = (local ? PLACES : CITIES)[id];
        const target = local ? { level: this.route.level === "place" ? "garden" : "place", city: place.city, place: id } : { level: "city", city: id };
        const button = document.createElement("button");
        button.type = "button";
        button.className = "atlas-marker";
        button.dataset.id = id;
        button.setAttribute("aria-label", target.level==="garden" ? t("atlas.enter") : t(place.name));
        button.innerHTML = '<i aria-hidden="true"></i><span></span>';
        button.lastElementChild.textContent = t(place.name);
        button.onclick = () => this.navigate(target);
        this.markers.append(button);
      }
    }
    for (const button of this.markers.children) {
      const [x,y] = this.screen(...(local ? PLACES : CITIES)[button.dataset.id].center);
      button.hidden = x<0 || x>this.width || y<0 || y>this.height;
      button.classList.toggle("label-left", x>this.width-115);
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
    }
  }
}

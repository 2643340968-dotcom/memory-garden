import { getLanguage, placeText, t } from "../i18n/LanguageController.js";
import { CHINA, CITIES, PLACES } from "./places.js";
import reliefUrl from "./maps/china-relief.webp";
import regionUrl from "./maps/lower-yangtze.webp";
import cityUrl from "./maps/nanjing.webp";
import siteUrl from "./maps/jiangdongmen.webp";
import bounds from "./maps/place-bounds.json";
import watercourses from "./maps/watercourses.json";

const mapFiles = import.meta.glob("./maps/*.webp", { eager: true, query: "?url", import: "default" });
const newLayers = Object.entries(bounds).map(([name, extent]) => {
  const [city, scale] = name.split("-");
  const [reveal, minSpan] = { region: [11,0.8], city: [1.05,0.11], site: [0.14,0.016] }[scale];
  return { city, scale, url: mapFiles[`./maps/${name}.webp`], bounds: extent, reveal, minSpan };
});
const layers = [
  { url: reliefUrl, bounds: [48, 2, 161, 67], reveal: Infinity, minSpan: 7 },
  { url: regionUrl, bounds: [115.3125, 29.535230, 123.75, 36.597889], reveal: 10, minSpan: 0.65 },
  { url: cityUrl, bounds: [118.476563, 31.802893, 119.003906, 32.249974], reveal: 0.85, minSpan: 0.10 },
  { city: "nanjing", scale: "site", url: siteUrl, bounds: [118.652344, 31.989442, 118.784180, 32.101190], reveal: 0.17, minSpan: 0.027 },
  ...newLayers,
].sort((a,b) => b.reveal-a.reveal);
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

function coveringLayer(lon,lat) {
  return layers.findLast(({ bounds: [west, south, east, north] }) =>
    lon >= west && lon <= east && lat >= south && lat <= north) ?? layers[0];
}
const minimumSpan = (lon, lat) => coveringLayer(lon, lat).minSpan;

export class AtlasMap {
  constructor(root, navigate, onPreview) {
    this.root = root;
    this.navigate = navigate;
    this.onPreview = onPreview;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.canvas = root.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.markers = root.querySelector("#atlas-markers");
    this.scale = root.querySelector("#atlas-scale");
    this.zoomIn = root.querySelector("#atlas-zoom-in");
    this.zoomOut = root.querySelector("#atlas-zoom-out");
    this.route = { level: "country" };
    this.pointers = new Map();
    this.images = new Map();
    this.inkStarted = performance.now();
    this.lensStarted = this.inkStarted;
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
    if (!this.camera || (!this.flight && Math.abs(this.camera.span-oldFit)<.000001 && !this.manual)) this.camera = fit;
    else if (oldFit && !this.flight) this.camera.span *= fit.span / oldFit;
    this.draw();
  }

  target(route) {
    const area = PLACES[route.place] ?? CITIES[route.city] ?? CHINA;
    const [x, lat] = area.center;
    const dy = northing(lat + area.latitudeSpan / 2) - northing(lat - area.latitudeSpan / 2);
    const overlaid = this.width >= 880 && !matchMedia("(max-width: 950px) and (orientation: portrait)").matches;
    const horizontal = route.level === "country" && this.width <= 520 ? 65 : area.span;
    const span = Math.max(horizontal / (overlaid ? 0.76 : 0.94), dy * this.width / (this.height * 0.91));
    return { x: x - (overlaid ? span*0.115 : 0), y: northing(lat), span };
  }

  stopFlight() {
    cancelAnimationFrame(this.flight);
    this.flight = 0;
  }

  fly(route, immediate = false) {
    this.stopFlight();
    this.route = route;
    this.manual = false;
    this.lensCity = null;
    this.inkStarted = performance.now();
    this.markerKey = null;
    const dest = this.target(route);
    this.fittedSpan = dest.span;
    if (immediate || !this.camera || this.reduced.matches) {
      this.camera = dest;
      this.draw();
      return;
    }
    const start = { ...this.camera };
    const ratio = dest.span / start.span;
    const t0 = performance.now();
    const frame = (now) => {
      const p = clamp((now - t0) / 1080, 0, 1);
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
    this.manual = true;
    this.lensCity = null;
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
    const currentLayer = coveringLayer(this.camera.x, latitude(this.camera.y));
    this.camera.x = clamp(this.camera.x - (point.x-old.x)*unit, 73, 135);
    this.camera.y = clamp(this.camera.y + (point.y-old.y)*unit, northing(17), northing(54));
    if (currentLayer !== layers[0] && this.camera.span < currentLayer.reveal*.65) {
      const [w,s,e,n] = currentLayer.bounds;
      this.camera.x = clamp(this.camera.x,w,e);
      this.camera.y = clamp(this.camera.y,northing(s),northing(n));
    }
    this.draw();
  }

  zoom(factor, point = { x: this.width/2, y: this.height/2 }) {
    this.stopFlight();
    this.manual = true;
    this.lensCity = null;
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

  getImage(url) {
    if (!this.images.has(url)) {
      const img = new Image();
      img.onload = () => this.draw();
      this.images.set(url, img);
      img.src = url;
    }
    return this.images.get(url);
  }

  highlight(city, reveal = true) {
    const lens = reveal && this.route.level === "country" ? city : null;
    if (city === this.highlighted && lens === this.lensCity) return;
    this.highlighted = city;
    this.lensCity = lens;
    this.lensStarted = performance.now();
    this.draw();
  }

  draw() {
    if (!this.camera || !this.ctx || !this.root.clientWidth) return;
    const { ctx, width: w, height: h } = this;
    const span = this.camera.span;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.fillStyle = "#15141c";
    ctx.fillRect(0, 0, w, h);
    for (const { url, bounds: [west,south,east,north], reveal } of layers) {
      if (span >= reveal) continue;
      const [x,y] = this.screen(west,north);
      const [r,b] = this.screen(east,south);
      if (r < 0 || b < 0 || x > w || y > h) continue;
      const img = this.getImage(url);
      if (img.complete && img.naturalWidth) {
        ctx.globalAlpha = clamp(Math.log2(reveal/span)*1.5, 0, 1);
        ctx.drawImage(img,x,y,r-x,b-y);
      }
    }
    ctx.globalAlpha = 1;
    this.drawGrid();
    if (this.route.level === "country" && span > 8) {
      const now = performance.now();
      const ink = this.reduced.matches ? 1 : clamp((now - this.inkStarted) / 1750, 0, 1);
      const lens = this.reduced.matches ? 1 : clamp((now - this.lensStarted) / 650, 0, 1);
      this.drawWater(ink);
      if (this.lensCity) this.drawLens(lens);
      if ((ink < 1 || (this.lensCity && lens < 1)) && !this.inkFrame && !document.hidden) {
        this.inkFrame = requestAnimationFrame(() => {
          this.inkFrame = 0;
          this.draw();
        });
      }
    }
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
    ctx.strokeStyle = country ? "rgba(203,188,178,.055)" : "rgba(209,190,206,.10)";
    ctx.fillStyle = "rgba(214,198,211,.48)";
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

  drawWater(phase) {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = this.width < 600 ? 0.72 : 1.05;
    ctx.strokeStyle = "rgba(245,212,170,.70)";
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

  drawLens(phase) {
    const city = this.lensCity;
    const site = PLACES[CITIES[city].places[0]];
    const detail = layers.find(layer => layer.city === city && layer.scale === "site");
    if (!detail) return;
    const image = this.getImage(detail.url);
    if (!image.naturalWidth) return;
    const { ctx } = this;
    const [x, y] = this.screen(...site.center);
    const open = 1 - (1 - phase) ** 3;
    const radius = (this.width < 600 ? 33 : 56) * open;
    if (radius < 1) return;
    const [west, south, east, north] = detail.bounds;
    const ix = (site.center[0] - west) / (east - west) * image.naturalWidth;
    const iy = (northing(north) - northing(site.center[1])) /
      (northing(north) - northing(south)) * image.naturalHeight;
    const sample = (site.span * 0.52 / (east - west)) * image.naturalWidth;
    const diameter = radius * 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#332a34";
    ctx.fillRect(x - radius, y - radius, diameter, diameter);
    ctx.drawImage(image, ix - sample / 2, iy - sample / 2, sample, sample,
      x - radius, y - radius, diameter, diameter);
    ctx.restore();
    ctx.strokeStyle = "rgba(246,214,179,.85)";
    ctx.lineWidth = 1;
    ctx.stroke();
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
        const site=local ? place : PLACES[place.places[0]];
        button.setAttribute("aria-label", target.level==="garden" ? t("atlas.enter")+" · "+placeText(site.name) :
          local ? placeText(site.name) : placeText(place.name)+" · "+placeText(site.name));
        button.innerHTML = '<i aria-hidden="true"></i><span><strong></strong><small></small></span>';
        button.querySelector("strong").textContent = placeText(place.name);
        button.querySelector("small").textContent = local ? "" : placeText(site.name);
        if (!local) {
          button.onpointerenter=()=>this.onPreview(id);
          button.onfocus=()=>this.onPreview(id);
        }
        button.onclick = () => this.navigate(target);
        this.markers.append(button);
      }
    }
    for (const button of this.markers.children) {
      const id=button.dataset.id;
      const point=local ? PLACES[id] : PLACES[CITIES[id].places[0]];
      const [x,y] = this.screen(...point.center);
      button.hidden = x<0 || x>this.width || y<0 || y>this.height;
      button.classList.toggle("label-left", x>this.width-(this.width<600?85:140) || (!local && (id==="chengdu" || id==="dunhuang") && x>115));
      button.classList.toggle("is-current", local || this.highlighted===id);
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
    }
  }
}

import {AtlasCharts} from "../atlas/AtlasCharts.js";
import {CHINA, CITIES, PLACES} from "./places.js";
import {groupMarkers, overlaps} from "../atlas/markerLayout.js";
import {getLanguage, placeText} from "../i18n/LanguageController.js";
import {blend, cameraProgress, clamp, mercator, project} from "./geometry.js";
import {chartLabelInLanguage, WheelGesture} from "./levels.js";
import {restFlower, RippleField} from "./ripples.js";
import {FlowBasemap, NavigationChart, paintChart} from "./FlowBasemap.js";
import {nationalMarks, OverviewReveal} from "./overview.js";
import {cityFlowers} from "./cityFlowers.js";
import {forms, plateURL} from "./flowerForms.js";
import {MapGlints, setPetalRhythm} from "./petalLight.js";
import {MemoryBeds} from "./memoryBeds.js";

export function markFlower(g) {
  return g.national ? g.id : g.city;
}
const stops = {
  country : 860,
  city : 780,
  place : 660
};
const zh = () => getLanguage() === "zh-CN";
const seas = [
  [ 124, 28, "东海", "East China Sea" ], [ 113, 15.5, "南海", "South China Sea" ],
  [ 89.6, 32, "青藏高原", "Tibetan Plateau" ]
];

const labelDirections = Array.from({length : 16}, (_, index) => {
  const angle = index * Math.PI / 8;
  return [Math.cos(angle), Math.sin(angle)];
});
function* labelOffsets(width, height, gap, preferWest, national) {
  const east = [gap, -height / 2], west = [-width - gap, -height / 2];
  yield* preferWest ? [west, east] : [east, west];
  yield [-width / 2, gap];
  yield [-width / 2, -height - gap];
  if (!national) return;
  // Keep crowded national labels readable without moving a geographic dot.
  for (let radius = 22; radius <= 146; radius += 8) {
    for (const [ux, uy] of labelDirections)
      yield [ux * radius - width / 2, uy * radius - height / 2];
  }
}

export class FlowAtlas {
  constructor(root, callbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.markers = root.querySelector("#pins");
    this.nearby = document.getElementById("nearby");
    this.wheel = new WheelGesture();
    this.notes = root.querySelector("#notations");
    this.ctx = this.notes.getContext("2d");
    this.pointers = new Map();
    this.pins = new Map();
    this.quiet = matchMedia("(prefers-reduced-motion: reduce)");
    this.glints = new MapGlints(root, this.quiet);
    this.overviewReveal = new OverviewReveal(root, this.markers, this.quiet);
    this.charts = new AtlasCharts(root, () => this.invalidate(), {
      surfaces : {base : "#base"},
      makeWorker : () => new Worker(new URL("./chart.worker.js", import.meta.url), {type : "module"}),
      loadPainter : async () => ({VectorBasemap : FlowBasemap, paintChart}),
    });
    this.surround = new NavigationChart(
        root.querySelector("#surround"), this.charts.assetRoot, () => this.invalidate());
    this.ripples =
        new RippleField(root.querySelector("#waves"), coord => project(this.view, this.w, this.h, coord));
    this.beds = new MemoryBeds(root.querySelector("#memory-beds"), this.quiet);
    this.route = {level : "country"};
    this.active = true;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(root);
    this.bind();
    this.resize();
  }
  resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h)
      return;
    const dpr = Math.min(devicePixelRatio || 1, 2.5, Math.sqrt(9000000 / (w * h)));
    if (this.w === w && this.h === h && dpr === this.dpr)
      return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    const fit = this.fit(this.route);
    this.view = this.manual && this.view ? {...this.view, span : fit.span} : fit;
    if (this.cover) this.positionCover();
    this.flight = null;
    this.notes.width = Math.round(w * dpr);
    this.notes.height = Math.round(h * dpr);
    this.ripples.resize(w, h, Math.min(1.65, dpr));
    this.beds.resize(w, h, dpr);
    this.invalidate();
  }
  fit(route) {
    const {w, h} = this, wide = w >= 820, country = route.level === "country";
    const area = PLACES[route.place] ?? CITIES[route.city] ?? CHINA;
    const [lon, lat] = area.center;
    const dy = country ? mercator(54) - mercator(18) :
                         mercator(lat + area.latitudeSpan / 2) - mercator(lat - area.latitudeSpan / 2);
    const k = Math.min(
        w * (country ? (wide ? .81 : .93) : (wide ? .73 : .82)) / (country ? 63 : area.span),
        h * (country ? .89 : .68) / dy);
    const span = w / k, cx = wide ? .515 : .5, cy = wide ? .49 : .51;
    const my = country ? (mercator(54) + mercator(18)) * .5 : mercator(lat);
    return {x : lon - (cx - .5) * span, y : my + (cy - .5) * h / k, span};
  }
  positionCover() {
    const target = this.fit({level : "country"});
    const span = target.span / this.cover.scale;
    this.view = {...target, span, y : target.y + this.cover.drift * this.h * span / this.w};
  }
  setCover(pose) {
    if (pose && !this.cover) this.ripples.clear();
    this.cover = pose;
    this.flight = null;
    if (pose) {
      this.overviewReveal.stop(true);
      if (this.w) this.positionCover();
    } else {
      if (this.w) this.view = this.fit({level : "country"});
      this.overviewReveal.update(true, false);
    }
    this.invalidate();
  }
  show(route, {restore = null, immediate = false} = {}) {
    this.closeNearby();
    this.unhover();
    if (route.level !== "country") this.overviewReveal.stop();
    this.active = true;
    this.route = route;
    this.root.hidden = false;
    this.resize();
    this.groupKey = "";
    this.manual = Boolean(restore);
    const fitted = this.fit(route);
    const dest = restore ? {...fitted, x: restore.x, y: restore.y} : fitted;
    this.fly(dest, immediate ? 0 : stops[route.level]);
  }
  hide(holdFrame = false) {
    this.closeNearby();
    this.unhover();
    this.overviewReveal.stop();
    this.active = false;
    this.pointers.clear();
    this.pinch = null;
    this.dragging = false;
    this.root.classList.remove("dragging", "stirring");
    this.flight = null;
    this.ripples.clear(holdFrame);
    this.glints.show(null);
    this.beds.clear(holdFrame);
    this.root.hidden = !holdFrame;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
  fly(to, duration = 0) {
    const now = performance.now(), prior = this.flight;
    let velocity = 0;
    if (prior) {
      const t = clamp((now - prior.start) / prior.duration, 0, 1);
      const p = cameraProgress(t, prior.slope);
      velocity = (cameraProgress(t + .001, prior.slope) - p) * 1000 / prior.duration *
          Math.log(prior.to.span / prior.from.span);
      this.view = blend(prior.from, prior.to, p);
    }
    const distance = Math.log(to.span / this.view.span);
    if (duration > 250)
      duration += Math.min(325, Math.abs(distance) * 64);
    const slope = Math.abs(distance) > .00001 ? velocity * duration / distance : 0;
    this.flight = duration && !this.quiet.matches ?
        {from : {...this.view}, to, start : now, duration, slope} :
        null;
    if (!this.flight)
      this.view = to;
    this.invalidate();
  }
  snapshot() {
    return {...(this.flight?.to ?? this.view)};
  }
  invalidate() {
    if (!this.active || !this.w || this.frame || document.hidden)
      return;
    this.frame = requestAnimationFrame(t => {
      this.frame = 0;
      this.draw(t);
    });
  }
  point(e) {
    const box = this.root.getBoundingClientRect();
    return [ e.clientX - box.left, e.clientY - box.top ];
  }
  nearestPin([x, y], radius) {
    let closest = null;
    for (const entry of this.visiblePins ?? []) {
      const distance = Math.hypot(x-entry.x, y-entry.y);
      if (distance < radius && entry.pin.isConnected && !entry.pin.hidden) {
        closest = entry.pin;
        radius = distance;
      }
    }
    return closest;
  }
  targetAt(e) {
    if (!this.active || this.markers.inert || !this.root.contains(e.target)) return {};
    const point = this.point(e), hit = e.target.closest?.(".pin");
    if (hit && !hit.hidden) {
      // A long label may sit away from its dot. For a corolla overhanging a neighbour,
      // give the closest geographic centre the first 15 pixels.
      const pin = e.target.closest("span") ? hit : this.nearestPin(point,15) ?? hit;
      return {pin, mark:pin.mark};
    }
    const bed = this.route.level === "place" && this.beds.hit(point);
    if (bed) return {bed, mark:{city:PLACES[bed].city,site:bed}};
    const pin = this.nearestPin(point, this.route.level === "country" ? 42 : 30);
    return pin ? {pin, mark:pin.mark} : {};
  }
  unhover() {
    if (!this.hot)
      return;
    this.ripples.leave(this.hot);
    this.pins.get(this.hot)?.classList.remove("hot");
    this.hot = null;
    this.callbacks.read(null);
    this.invalidate();
  }
  hover(pin) {
    if (!pin || pin.hidden || this.hot === pin.dataset.id)
      return;
    this.unhover();
    const mark = pin.mark;
    this.hot = mark.id;
    pin.classList.add("hot");
    this.ripples.strike(pin);
    this.callbacks.read(mark);
    this.invalidate();
  }
  activate(pin) {
    const mark = pin.mark;
    this.callbacks.gesture();
    this.ripples.strike(pin, true);
    if (mark.national) {
      this.callbacks.navigate({level : "city", city : mark.city});
      return;
    }
    if (mark.members.length > 1) {
      this.openNearby(pin);
      return;
    }
    this.callbacks.choose(mark.site);
  }
  openNearby(pin) {
    if (this.nearbyPin === pin) { this.closeNearby(true); return; }
    this.closeNearby();
    this.nearbyPin = pin;
    pin.setAttribute("aria-expanded", "true");
    this.nearby.replaceChildren(...pin.mark.members.map(id => {
      const button = document.createElement("button");
      button.type = "button";
      const flower = new Image();
      flower.alt = "";
      flower.width = flower.height = 25;
      flower.src = plateURL(PLACES[id].city);
      button.append(flower, placeText(PLACES[id].name));
      button.onclick = () => this.callbacks.choose(id);
      return button;
    }));
    this.nearby.hidden = false;
    this.positionNearby();
    this.nearby.firstElementChild.focus({preventScroll: true});
  }
  positionNearby() {
    const pin = this.nearbyPin;
    if (!pin) return;
    if (!pin.isConnected || pin.hidden) { this.closeNearby(); return; }
    const [x, y] = project(this.view, this.w, this.h, pin.mark.center);
    const width = this.nearby.offsetWidth, height = this.nearby.offsetHeight;
    const below = y + 18;
    this.nearby.style.left = clamp(x - width / 2, 8, this.w - width - 8) + "px";
    this.nearby.style.top = clamp(below + height < this.h - 8 ? below : y - height - 18,
                                  8, this.h - height - 8) + "px";
  }
  closeNearby(focus = false) {
    if (!this.nearbyPin) return;
    this.nearbyPin.setAttribute("aria-expanded", "false");
    if (focus) this.nearbyPin.focus({preventScroll: true});
    this.nearbyPin = null;
    this.nearby.hidden = true;
  }
  bind() {
    const {root, markers} = this;
    markers.addEventListener("focusin", e => {
      if (e.target.matches(":focus-visible"))
        this.hover(e.target);
    });
    markers.addEventListener("focusout", () => this.unhover());
    root.addEventListener("click", e => {
      if (e.detail && performance.now() < (this.suppressClickUntil ?? 0)) return;
      const {pin,bed} = e.detail ? this.targetAt(e) : {pin:e.target.closest(".pin")};
      if (pin) this.activate(pin);
      else if (bed) this.callbacks.choose(bed);
    });
    root.addEventListener("pointerdown", e => {
      if (e.button !== 0 || this.pointers.size >= 2) return;
      if (!this.pointers.size) this.suppressClickUntil = 0;
      const {pin,bed,mark} = this.targetAt(e);
      const point = this.point(e);
      this.callbacks.gesture();
      this.pointers.set(e.pointerId, {point, start:point, mark, pin, bed, time:e.timeStamp});
      if (this.pointers.size === 2) {
        this.unhover();
        this.beds.release();
        const [a, b] = this.pointers.values();
        a.stepped = b.stepped = false;
        const [x, y] = [(a.point[0] + b.point[0]) / 2, (a.point[1] + b.point[1]) / 2];
        const box = root.getBoundingClientRect();
        const clientX=box.left+x, clientY=box.top+y;
        const target=document.elementFromPoint(clientX,clientY);
        const midpoint=target && this.targetAt({clientX,clientY,target}).mark;
        this.pinch = {distance: Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1]),
                      mark: midpoint ?? a.mark ?? b.mark, used: false};
        this.dragging = true;
        for (const id of this.pointers.keys()) root.setPointerCapture(id);
      }
    });
    root.addEventListener("pointermove", e => {
      const track = this.pointers.get(e.pointerId);
      if (!track) {
        if (!e.buttons && e.pointerType !== "touch") {
          const {pin} = this.targetAt(e);
          if (pin) this.hover(pin);
          else this.unhover();
          const point = this.point(e);
          this.ripples.steer(...point);
          this.beds.hover(point);
        }
        return;
      }
      const xy = this.point(e), old = track.point;
      track.point = xy;
      if (this.pinch) {
        const other = [...this.pointers.values()].find(p => p !== track);
        if (!other || this.pinch.used) return;
        const distance = Math.hypot(xy[0] - other.point[0], xy[1] - other.point[1]);
        const change = distance - this.pinch.distance;
        if (Math.abs(change) >= Math.max(14, this.pinch.distance * .16)) {
          this.pinch.used = true;
          this.step(change > 0, this.pinch.mark);
        }
        return;
      }
      if (track.stepped) return;
      const dx = xy[0] - track.start[0], dy = xy[1] - track.start[1];
      if (e.pointerType === "touch" && !track.horizontal) {
        if (Math.abs(dx) > 11 && Math.abs(dx) > Math.abs(dy) * 1.2) track.horizontal = true;
        else {
          if (Math.abs(dy) > 48 && !track.stepped) {
            track.stepped = true;
            track.inward = dy < 0;
            this.dragging = true;
            root.setPointerCapture(e.pointerId);
          }
          return;
        }
      }
      if (!this.dragging && Math.hypot(dx, dy) < 5) return;
      if (!root.hasPointerCapture(e.pointerId)) root.setPointerCapture(e.pointerId);
      this.dragging = true;
      if (track.bed || track.pin) this.beds.pull(old, xy, (e.timeStamp - track.time) / 1000);
      if (track.bed && !track.pin) {
        track.time = e.timeStamp;
        root.classList.add("stirring");
        return;
      }
      if (track.pin) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest(".pin");
        const flower = hit ?? this.pins.get(this.hot) ?? track.pin;
        if (!flower.isConnected) return;
        this.hover(flower);
        this.ripples.pull(flower, old, xy, (e.timeStamp - track.time) / 1000);
        track.time = e.timeStamp;
        root.classList.add("stirring");
        return;
      }
      if (this.flight) return;
      this.unhover();
      this.manual = true;
      root.classList.add("dragging");
      const k = this.view.span / this.w;
      this.view = {
        ...this.view,
        x: clamp(this.view.x - (xy[0] - old[0]) * k, 65, 146),
        y: clamp(this.view.y + (xy[1] - old[1]) * k, 14, 70)
      };
      this.invalidate();
    });
    const end = e => {
      const track = this.pointers.get(e.pointerId);
      if (!track) return;
      this.pointers.delete(e.pointerId);
      if (this.dragging && track.pin && this.hot) {
        this.ripples.release(this.hot);
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest(".pin");
        if (e.type === "pointercancel" || e.pointerType === "touch" || hit?.dataset.id !== this.hot) this.unhover();
      }
      if (this.dragging) this.suppressClickUntil = performance.now() + 300;
      if (!this.pointers.size) {
        this.beds.release();
        this.dragging = false;
        this.pinch = null;
        root.classList.remove("dragging", "stirring");
        this.invalidate();
      }
      // Let touchend reach the original map surface before replacing its pins.
      if (e.type === "pointerup" && track.stepped && !track.horizontal) {
        const from = this.route;
        requestAnimationFrame(() => { if (this.active && this.route === from) this.step(track.inward,track.mark); });
      }
    };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    root.addEventListener("lostpointercapture", e => {
      if (e.target === root)
        end(e);
    });
    window.addEventListener("pointerup", end);
    root.addEventListener("pointerleave", () => { if (!this.pointers.size) { this.beds.release(); this.unhover(); } });
    this.nearby.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      this.closeNearby(true);
    });
    document.addEventListener("pointerdown", e => {
      if (this.nearbyPin && !this.nearby.contains(e.target) && e.target.closest(".pin") !== this.nearbyPin)
        this.closeNearby();
    });
    this.nearby.addEventListener("focusout", e => {
      if (e.relatedTarget && !this.nearby.contains(e.relatedTarget)) this.closeNearby();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.overviewReveal.stop();
      else this.invalidate();
    });
    this.quiet.addEventListener("change", () => this.invalidate());
    document.fonts?.ready.then(() => this.invalidate());
    document.querySelector("#level-target").onchange = e => {
      const id = e.target.value;
      if (!id) return;
      this.step(true, this.route.level === "country" ? {national: true, city: id} : {site: id});
      root.focus({preventScroll: true});
    };
    document.querySelector("#zoom-out").onclick = () => {
      this.step(false);
      root.focus({preventScroll: true});
    };
    document.querySelector("#fit").onclick = () => {
      this.recenter();
      root.focus({preventScroll: true});
    };
  }
  recenter() {
    this.callbacks.gesture();
    this.unhover();
    this.manual = false;
    this.fly(this.fit(this.route), 450);
  }
  step(inward, mark) {
    if (inward && !mark) return;
    if (inward && mark.members?.length > 1) {
      const pin=this.pins.get(mark.id);
      if (pin && this.nearbyPin !== pin) this.openNearby(pin);
      return;
    }
    this.callbacks.gesture();
    this.callbacks.step(inward, mark);
  }
  groups() {
    const national = this.route.level === "country";
    if (national)
      return nationalMarks;
    const pts = CITIES[this.route.city].places.map(id => {
      const p = PLACES[id], [ x, y ] = project(this.view, this.w, this.h, p.center);
      return {id, site : id, city : p.city, name : p.name, center : p.center, x, y};
    });
    const rest = pts.filter(p => p.id !== this.route.place),
          selected = pts.find(p => p.id === this.route.place);
    const radius = this.view.span < .029 ? 0 : (this.w < 600 ? 33 : 27);
    return [
      ...(selected ? [ {...selected, members : [ selected.id ]} ] : []), ...groupMarkers(rest, radius)
    ];
  }
  draw(now) {
    if (!this.active || !this.w)
      return;
    if (this.flight) {
      const f = this.flight, t = clamp((now - f.start) / f.duration, 0, 1);
      this.view = blend(f.from, f.to, cameraProgress(t, f.slope));
      if (t === 1)
        this.flight = null;
    }
    const f = this.flight;
    // Look ahead to the wider extent on retreat; stay close to the visible
    // scale on approach so the finer streets arrive as they come into focus.
    const gap = f ? Math.abs(Math.log(f.to.span / this.view.span)) : 0;
    let landing = this.view;
    if (f && f.to.span > this.view.span) {
      const ahead = cameraProgress((now - f.start + 235) / f.duration, f.slope);
      landing = blend(f.from, f.to, ahead);
    } else if (gap > .20) {
      landing = blend(this.view, f.to, Math.min(.22, .15 / gap));
    }
    const detail = this.charts.update(
        "base", this.view, this.w, this.h, this.dpr, getLanguage(), !!f || this.dragging || !!this.cover, landing);
    const chart = this.surround.select(detail, this.view, this.w, this.h, getLanguage(), this.dpr);
    this.root.classList.toggle("provisional", this.surround.needed);
    if (chart)
      this.root.dataset.vectorLevel = chart.frame.level;
    if (!f && chart && !this.surround.needed && this.route.level === "city") this.callbacks.cityLanded(this.route.city);
    const reserved = this.cover ? [] : this.drawPins(this.groups());
    this.overviewReveal.update(this.route.level === "country" && !this.cover, !f && !!chart && !this.dragging);
    this.glints.show(this.cover || f ? null : this.route.level);
    this.beds.place(this.cover ? null : this.route.city, this.view, !!this.flight || (this.dragging && !this.root.classList.contains("stirring")));
    this.annotate(chart, reserved);
    this.positionNearby();
    this.charts.flush();
    this.ripples.present(now, !!this.flight);
    this.root.dataset.level = this.route.level;
    if (this.flight)
      this.invalidate();
  }
  drawPins(groups) {
    const language = getLanguage(), key = [
      language, this.route.level, ...groups.map(g => g.id + ":" + g.members.join(","))
    ].join("/");
    if (this.groupKey !== key) {
      this.groupKey = key;
      const gone = new Set(this.pins.keys());
      for (const g of groups) {
        gone.delete(g.id);
        let pin = this.pins.get(g.id);
        if (!pin) {
          pin = document.createElement("button");
          pin.type = "button";
          pin.className = "pin";
          pin.dataset.id = g.id;
          setPetalRhythm(pin, g.id);
          pin.innerHTML = '<i class="stamp" aria-hidden="true"><canvas width="136" height="136"></canvas><b></b></i><span></span>';
          this.pins.set(g.id, pin);
          this.markers.append(pin);
        }
        if (g.national && !pin.querySelector(".rain-impact")) {
          const ring = document.createElement("i");
          ring.className = "rain-impact";
          ring.setAttribute("aria-hidden", "true");
          pin.prepend(ring);
        }
        pin.mark = g;
        const species = markFlower(g);
        if (pin.dataset.species !== species) {
          if (this.hot === g.id) this.unhover();
          pin.dataset.species = species;
          pin.style.setProperty("--pin-ink", forms[species].hem);
          restFlower(pin);
        }
        const name = placeText(g.name);
        const note = cityFlowers[species].reason;
        pin.setAttribute("aria-description", placeText(note));
        const entrance = this.route.level === "place" && this.route.place === g.site;
        pin.lastElementChild.textContent = entrance ? name + " ↓" : name;
        const action = entrance ? (zh() ? " · 进入花园" : " · Enter the garden") : "";
        if (entrance) pin.title = name + action;
        else pin.removeAttribute("title");
        pin.querySelector(".stamp b").textContent =
            g.members.length > 1 ? g.members.length : "";
        pin.setAttribute(
            "aria-label",
            name + action +
                (g.members.length > 1 ? (zh() ? " · 附近 " : " · ") + g.members.length +
                         (zh() ? " 处地点" : " nearby places") :
                                        ""));
        pin.classList.toggle("national", !!g.national);
        pin.classList.toggle("cluster", g.members.length > 1);
        if (g.members.length > 1) {
          pin.setAttribute("aria-controls", "nearby");
          pin.setAttribute("aria-expanded", String(pin === this.nearbyPin));
        } else {
          pin.removeAttribute("aria-controls");
          pin.removeAttribute("aria-expanded");
        }
      }
      for (const id of gone) {
        if (this.hot === id)
          this.unhover();
        this.pins.get(id).remove();
        this.pins.delete(id);
      }
    }
    const screen = [];
    for (const [id, pin] of this.pins) {
      const [x, y] = project(this.view, this.w, this.h, pin.mark.center);
      pin.hidden = x < -5 || y < -5 || x > this.w + 5 || y > this.h + 5;
      if (pin.hidden)
        continue;
      pin.style.transform = `translate(${x}px,${y}px)`;
      const hot = id === this.hot || id === this.route.place;
      pin.classList.toggle("active", hot);
      screen.push({pin, x, y, hot});
    }
    this.visiblePins = screen;
    const blocked = screen.map(({x, y, pin}) => {
      const radius = pin.classList.contains("hot") ? this.ripples.openRadius() * .82 : pin.mark.national ? (this.w <= 560 ? 13 : 18) : this.w <= 560 ? 9 : 15;
      return {left : x - radius, right : x + radius, top : y - radius, bottom : y + radius, pin};
    });
    screen.sort(
        (a, b) => Number(b.hot) - Number(a.hot) || b.pin.mark.members.length - a.pin.mark.members.length);
    this.ctx.font = (this.w < 620 ? "13" : "15") + "px system-ui";
    for (const {pin, x, y, hot} of screen) {
      const label = pin.lastElementChild, national = pin.mark.national;
      if (!national && pin.mark.members.length === 1) {
        const site = PLACES[pin.mark.site], name = placeText(site.name);
        const text = name + (pin.dataset.id === this.hot ? " · " + placeText(cityFlowers[site.city].name) : "") +
            (this.route.place === pin.mark.site ? " ↓" : "");
        if (label.textContent !== text) label.textContent = text;
      }
      if (national) {
        const name = placeText(pin.mark.name);
        const text = hot ? name + " · " + placeText(cityFlowers[pin.mark.id].name) : name;
        if (label.textContent !== text) label.textContent = text;
      }
      const width = Math.min(this.w * .42, Math.ceil(this.ctx.measureText(label.textContent).width +
                                                    (national && this.w < 620 ? 6 : 14)));
      const height = national && this.w <= 560 ? 20 : 24;
      const expanded = pin.dataset.id === this.hot;
      const gap = expanded ? this.ripples.openRadius() * .92 + 3 : national ? (this.w <= 560 ? 18 : 26) : this.w <= 560 ? 13 : 19;
      let show = false;
      let leader = false;
      for (const [dx, dy] of labelOffsets(width, height, gap, x > this.w * .76, national || hot)) {
        const box = {left : x + dx, right : x + dx + width, top : y + dy, bottom : y + dy + height};
        if (box.left < 2 || box.right > this.w - 2 || box.top < 1 || box.bottom > this.h - 1)
          continue;
        if (blocked.some(other => (national || other.pin !== pin) && overlaps(box, other, 1)))
          continue;
        label.style.left = dx + "px";
        label.style.top = dy + "px";
        label.style.width = width + "px";
        if (national) {
          const vx = clamp(0, dx, dx + width), vy = clamp(0, dy, dy + height);
          const length = Math.hypot(vx, vy);
          leader = length > 16;
          if (leader) {
            pin.style.setProperty("--leader-length", (length - 1) + "px");
            pin.style.setProperty("--leader-angle", Math.atan2(vy, vx) + "rad");
          }
        }
        blocked.push(box);
        show = true;
        break;
      }
      label.hidden = !show;
      pin.classList.toggle("with-leader", leader);
    }
    return blocked;
  }
  annotate(chart, reserved) {
    const {ctx, w, h, dpr, view} = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const opacity = this.flight || this.dragging ? "0.45" : "1";
    if (this.notes.style.opacity !== opacity)
      this.notes.style.opacity = opacity;
    const k = w / view.span, step = 10 ** Math.floor(Math.log10(view.span * .32)), grid = step * k;
    ctx.font = "9px Consolas, monospace";
    ctx.fillStyle = "#747687";
    ctx.strokeStyle = "#afb1bd8c";
    ctx.lineWidth = .7;
    const startX = w / 2 + (Math.floor(view.x / step) * step - view.x) * k;
    const startY = h / 2 + (view.y - Math.floor(view.y / step) * step) * k;
    for (let x = startX % grid; x < w; x += grid) {
      if (x < 10)
        continue;
      for (let y = startY % grid; y < h; y += grid) {
        if (y < 6)
          continue;
        ctx.beginPath();
        ctx.moveTo(x - 2.5, y);
        ctx.lineTo(x + 2.5, y);
        ctx.moveTo(x, y - 2.5);
        ctx.lineTo(x, y + 2.5);
        ctx.stroke();
      }
    }
    const candidates = view.span > 8 ?
        seas.map(([ lon, lat, cn, en ]) => {
          const [x, y] = project(view, w, h, [ lon, lat ]);
          return {x, y, name : zh() ? cn : en};
        }) :
        (chart?.frame.language === getLanguage() ? chart.frame.labels : [])
            .slice(0, 180)
            .filter(label => chartLabelInLanguage(label.name, getLanguage()))
            .map(
                l => ({name : l.name, x : chart.x + l.x * chart.scale, y : chart.y + l.y * chart.scale}));
    ctx.font = (view.span > 8 ? "italic 13px Georgia, serif" : "11px system-ui");
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#fbfaf2d9";
    ctx.fillStyle = "#687383";
    const used = new Set();
    const limit = view.span > 8 ? 4 : Math.max(3, Math.min(16, Math.floor(w * h / 78000)));
    for (const {name, x, y} of candidates) {
      if (!name || used.has(name) || x < 27 || y < 20 || x > w - 27 || y > h - 15)
        continue;
      const extent = ctx.measureText(name).width / 2 + 4,
            b = {left : x - extent, right : x + extent, top : y - 13, bottom : y + 3};
      if (reserved.some(pos => overlaps(b, pos, 17)))
        continue;
      ctx.strokeText(name, x, y);
      ctx.fillText(name, x, y);
      reserved.push(b);
      used.add(name);
      if (used.size >= limit)
        break;
    }
    ctx.textAlign = "start";
  }
}

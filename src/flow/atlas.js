import {AtlasCharts} from "../atlas/AtlasCharts.js";
import {CHINA, CITIES, PLACES} from "../atlas/places.js";
import {groupMarkers, overlaps} from "../atlas/markerLayout.js";
import {adjacentStop, routeAtZoom} from "../atlas/zoomRoute.js";
import {getLanguage, placeText} from "../i18n/LanguageController.js";
import {blend, cameraProgress, clamp, latitude, mercator, project, under} from "./geometry.js";
import {RippleField} from "./ripples.js";
import {FlowBasemap, NavigationChart, paintChart} from "./FlowBasemap.js";
import {nationalMarks, OverviewRipples} from "./overview.js";

const stops = {
  country : 860,
  city : 780,
  place : 660
};
const stopScale = .0055;
const cityInks = {
  nanjing : "#815b97",
  beijing : "#ba645b",
  dunhuang : "#aa7040",
  chengdu : "#45867f",
  quanzhou : "#4a79a0"
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
    this.notes = root.querySelector("#notations");
    this.ctx = this.notes.getContext("2d");
    this.pointers = new Map();
    this.pins = new Map();
    this.quiet = matchMedia("(prefers-reduced-motion: reduce)");
    this.overviewRipples = new OverviewRipples(root, this.markers, this.quiet);
    this.charts = new AtlasCharts(root, () => this.invalidate(), {
      surfaces : {base : "#base"},
      makeWorker : () => new Worker(new URL("./chart.worker.js", import.meta.url), {type : "module"}),
      loadPainter : async () => ({VectorBasemap : FlowBasemap, paintChart}),
    });
    this.surround = new NavigationChart(
        root.querySelector("#surround"), this.charts.assetRoot, () => this.invalidate());
    this.ripples =
        new RippleField(root.querySelector("#waves"), coord => project(this.view, this.w, this.h, coord));
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
    const old = this.w && this.fit(this.route);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    const fit = this.fit(this.route);
    this.view = old && this.manual ? {...this.view, span : this.view.span * fit.span / old.span} : fit;
    if (this.cover) this.positionCover();
    this.flight = null;
    this.notes.width = Math.round(w * dpr);
    this.notes.height = Math.round(h * dpr);
    this.ripples.resize(w, h, Math.min(1.65, dpr));
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
      this.overviewRipples.stop();
      if (this.w) this.positionCover();
    } else {
      if (this.w) this.view = this.fit({level : "country"});
      this.overviewRipples.update(true, false);
    }
    this.invalidate();
  }
  show(route, {restore = null, keep = false, immediate = false} = {}) {
    this.unhover();
    this.selectedLabel = null;
    if (route.level !== "country") this.overviewRipples.stop();
    this.active = true;
    this.route = route;
    this.root.hidden = false;
    this.resize();
    if (!keep)
      this.wheel = null;
    this.groupKey = "";
    this.manual = Boolean(restore || keep);
    if (!keep) {
      const dest = restore ?? this.fit(route);
      this.fly(dest, immediate || restore ? 0 : stops[route.level]);
    } else
      this.invalidate();
  }
  hide(holdFrame = false) {
    this.unhover();
    this.overviewRipples.stop();
    this.active = false;
    this.pointers.clear();
    this.flight = null;
    this.ripples.clear(holdFrame);
    this.root.hidden = !holdFrame;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
  fly(to, duration = 0, free = false) {
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
        {from : {...this.view}, to, start : now, duration, free, slope} :
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
  unhover() {
    if (!this.hot)
      return;
    this.ripples.leave(this.hot);
    this.pins.get(this.hot)?.classList.remove("hot");
    this.hot = null;
    this.callbacks.read(this.pins.get(this.selectedLabel)?.mark ?? null);
    this.invalidate();
  }
  hover(pin) {
    if (!pin || pin.hidden || this.hot === pin.dataset.id)
      return;
    this.unhover();
    const mark = pin.mark;
    this.hot = mark.id;
    pin.classList.add("hot");
    this.ripples.strike(mark.id, mark.center, this.route.level);
    this.callbacks.read(mark);
    this.invalidate();
  }
  activate(pin) {
    const mark = pin.mark;
    this.callbacks.gesture();
    this.ripples.strike(mark.id, mark.center, this.route.level, true);
    if (mark.national) {
      if (!mark.city) {
        this.selectLabel(this.selectedLabel === mark.id ? null : mark.id);
        return;
      }
      this.callbacks.navigate({level : "city", city : mark.city});
      return;
    }
    if (mark.members.length > 1) {
      this.unhover();
      const places = mark.members.map(id => PLACES[id].center);
      const xs = places.map(p => p[0]), ys = places.map(p => mercator(p[1]));
      const xr = Math.max(...xs) - Math.min(...xs), yr = Math.max(...ys) - Math.min(...ys);
      const span = Math.max(
          stopScale,
          Math.min(this.view.span * .44, Math.max(.012, xr * 2.3, yr * 2.3 * this.w / this.h)));
      this.manual = true;
      this.fly(
          {
            x : (Math.max(...xs) + Math.min(...xs)) / 2,
            y : (Math.max(...ys) + Math.min(...ys)) / 2,
            span
          },
          330);
      return;
    }
    this.callbacks.choose(mark.site);
  }
  selectLabel(id) {
    if (this.selectedLabel === id) return;
    this.selectedLabel = id;
    this.callbacks.read(this.pins.get(id ?? this.hot)?.mark ?? null);
    this.invalidate();
  }
  bind() {
    const {root, markers} = this;
    markers.addEventListener("pointerover", e => {
      if (e.pointerType !== "touch" && !e.buttons)
        this.hover(e.target.closest(".pin"));
    });
    markers.addEventListener("pointerout", e => {
      if (e.pointerType !== "touch" && !e.relatedTarget?.closest?.(".pin"))
        this.unhover();
    });
    markers.addEventListener("focusin", e => {
      if (e.target.matches(":focus-visible"))
        this.hover(e.target);
    });
    markers.addEventListener("focusout", () => this.unhover());
    markers.addEventListener("click", e => {
      const pin = e.target.closest(".pin");
      if (pin && performance.now() > (this.suppressClickUntil ?? 0))
        this.activate(pin);
    });
    root.addEventListener("wheel", e => {
      e.preventDefault();
      const xy = this.point(e), prev = this.wheel;
      // The pin can move under a stationary pointer at a semantic stop.
      // Only moving the pointer or choosing another control changes its anchor.
      const same = prev && Math.hypot(prev.xy[0] - xy[0], prev.xy[1] - xy[1]) < 5;
      const site = (same ? prev.site : null) ?? e.target.closest(".pin")?.mark.site;
      this.wheel = {xy, site};
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.h : 1);
      this.zoom(Math.exp(-clamp(delta, -300, 300) * .0028), xy, xy, site);
    }, {passive : false});
    root.addEventListener("pointerdown", e => {
      if (e.button !== 0 || this.pointers.size >= 2)
        return;
      if (!e.target.closest(".pin")) this.selectLabel(null);
      const point = this.point(e);
      this.callbacks.gesture();
      this.wheel = null;
      this.pointers.set(e.pointerId, {point, start : point});
      if (this.pointers.size === 2) {
        this.dragging = true;
        for (const id of this.pointers.keys())
          root.setPointerCapture(id);
      }
    });
    root.addEventListener("pointermove", e => {
      const track = this.pointers.get(e.pointerId);
      if (!track) {
        if (!e.buttons && e.pointerType !== "touch")
          this.ripples.steer(...this.point(e));
        if (this.wheel) {
          const [x, y] = this.point(e);
          if (Math.hypot(x - this.wheel.xy[0], y - this.wheel.xy[1]) >= 5)
            this.wheel = null;
        }
        return;
      }
      const xy = this.point(e), old = track.point,
            other = [...this.pointers.values() ].find(t => t !== track)?.point;
      if (!this.dragging && Math.hypot(xy[0] - track.start[0], xy[1] - track.start[1]) < 5)
        return;
      if (!root.hasPointerCapture(e.pointerId))
        root.setPointerCapture(e.pointerId);
      this.dragging = true;
      this.unhover();
      this.flight = null;
      this.manual = true;
      root.classList.add("dragging");
      track.point = xy;
      if (other) {
        const gap = p => Math.max(1, Math.hypot(p[0] - other[0], p[1] - other[1]));
        const mid = p => [(p[0] + other[0]) / 2, (p[1] + other[1]) / 2];
        this.zoom(gap(xy) / gap(old), mid(old), mid(xy), null, true);
        return;
      }
      const k = this.view.span / this.w;
      this.view = {
        ...this.view,
        x : clamp(this.view.x - (xy[0] - old[0]) * k, 65, 146),
        y : clamp(this.view.y + (xy[1] - old[1]) * k, 14, 70)
      };
      this.invalidate();
    });
    const end = e => {
      if (!this.pointers.delete(e.pointerId))
        return;
      if (this.dragging)
        this.suppressClickUntil = performance.now() + 350;
      if (!this.pointers.size) {
        this.dragging = false;
        root.classList.remove("dragging");
        if (this.pinchStop && performance.now() - this.pinchStop.time < 220 &&
            Math.abs(Math.log(this.view.span / this.pinchStop.span)) < .28) {
          this.fly(this.fit(this.route), 430, true);
        }
        this.pinchStop = null;
        this.invalidate();
      }
    };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    root.addEventListener("pointerleave", () => {
      this.wheel = null;
    });
    root.addEventListener("lostpointercapture", e => {
      if (e.target === root)
        end(e);
    });
    window.addEventListener("pointerup", end);
    root.addEventListener("keydown", e => {
      if (e.key === "Escape") this.selectLabel(null);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.overviewRipples.stop();
      else this.invalidate();
    });
    this.quiet.addEventListener("change", () => this.invalidate());
    document.fonts?.ready.then(() => this.invalidate());
    document.querySelector("#zoom-in").onclick = () => this.zoom(1.85);
    document.querySelector("#zoom-out").onclick = () => this.zoom(1 / 1.85);
    document.querySelector("#fit").onclick = () => this.recenter();
  }
  recenter() {
    this.callbacks.gesture();
    this.unhover();
    this.manual = false;
    this.wheel = null;
    this.fly(this.fit(this.route), 450);
  }
  zoom(
      factor, point = [ this.w * (this.w >= 820 ? .515 : .5), this.h * .50 ], next = point, site = null,
      touch = false) {
    this.callbacks.gesture();
    const flight = this.flight;
    const reversing = flight && (flight.to.span - this.view.span) * (factor - 1) > 0;
    const base = flight?.free && !reversing ? flight.to : this.view;
    if (site)
      point = next = project(base, this.w, this.h, PLACES[site].center);
    const [lon, my] = under(base, this.w, this.h, ...point);
    const cap = this.fit({level : "country"}), span = clamp(base.span / factor, stopScale, cap.span);
    const dest = {
      x : clamp(lon - (next[0] - this.w / 2) * span / this.w, 65, 146),
      y : clamp(my + (next[1] - this.h / 2) * span / this.w, 14, 70),
      span
    };
    if (factor < 1 && span > cap.span * .70) {
      const pull = (span - Math.max(base.span, cap.span * .70)) /
          Math.max(.001, cap.span - Math.max(base.span, cap.span * .70));
      dest.x += (cap.x - dest.x) * clamp(pull, 0, 1);
      dest.y += (cap.y - dest.y) * clamp(pull, 0, 1);
    }
    this.manual = true;
    const route = routeAtZoom(this.route, span, factor < 1, [ lon, latitude(my) ], r => this.fit(r).span);
    if (route !== this.route) {
      const step = adjacentStop(this.route, route);
      this.callbacks.step(step);
      if (touch) {
        this.pinchStop = {time : performance.now(), span};
        this.fly(dest, 0, true);
      } else
        this.fly(this.fit(step), stops[step.level], true);
    } else
      this.fly(dest, touch ? 0 : 185, true);
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
    const reserved = this.cover ? [] : this.drawPins(this.groups());
    this.overviewRipples.update(this.route.level === "country" && !this.cover, !f && !!chart && !this.dragging);
    this.annotate(chart, reserved);
    this.charts.flush();
    this.ripples.present(now, !!this.flight);
    document.querySelector("#zoom-out").disabled =
        this.view.span >= this.fit({level : "country"}).span * .999;
    document.querySelector("#zoom-in").disabled = this.view.span <= stopScale * 1.001;
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
          pin.innerHTML = "<i class=\"stamp\" aria-hidden=\"true\"><b></b></i><span></span>";
          this.pins.set(g.id, pin);
          this.markers.append(pin);
        }
        pin.mark = g;
        pin.style.setProperty("--pin-ink", cityInks[g.city] ?? "#6d817d");
        const name = placeText(g.name);
        pin.lastElementChild.textContent = name;
        pin.firstElementChild.firstElementChild.textContent =
            g.members.length > 1 ? g.members.length : "";
        pin.setAttribute(
            "aria-label",
            name + (!g.city ? (zh() ? " · 地图标注" : " · Map location") : "") +
                (g.members.length > 1 ? (zh() ? " · 附近 " : " · ") + g.members.length +
                         (zh() ? " 处地点" : " nearby places") :
                                        ""));
        pin.classList.toggle("national", !!g.national);
        pin.classList.toggle("annotation", !g.city);
        pin.classList.toggle("cluster", g.members.length > 1);
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
      const hot = id === this.hot || id === this.route.place || id === this.selectedLabel;
      if (!pin.mark.city) pin.setAttribute("aria-pressed", String(id === this.selectedLabel));
      pin.classList.toggle("active", hot);
      screen.push({pin, x, y, hot});
    }
    const blocked = screen.map(({x, y, pin}) => {
      const radius = pin.mark.national ? (pin.mark.city ? 8 : 5) : 12;
      return {left : x - radius, right : x + radius, top : y - radius, bottom : y + radius, pin};
    });
    screen.sort(
        (a, b) => Number(b.hot) - Number(a.hot) || b.pin.mark.members.length - a.pin.mark.members.length);
    this.ctx.font = (this.w < 620 ? "13" : "15") + "px system-ui";
    for (const {pin, x, y, hot} of screen) {
      if (!pin.mark.city && !hot) {
        pin.lastElementChild.hidden = true;
        pin.classList.remove("with-leader");
        continue;
      }
      const label = pin.lastElementChild, national = pin.mark.national;
      const width = Math.min(this.w * .42, Math.ceil(this.ctx.measureText(label.textContent).width +
                                                    (national && this.w < 620 ? 6 : 14)));
      const height = national && this.w <= 560 ? 20 : 24;
      const gap = national ? (this.w < 620 ? 10 : 12) : pin.mark.members.length > 1 ? 18 : 13;
      let show = false;
      let leader = false;
      for (const [dx, dy] of labelOffsets(width, height, gap, x > this.w * .76, national)) {
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
        (chart?.frame.labels ?? [])
            .slice(0, 180)
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

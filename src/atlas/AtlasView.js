import { getLanguage, placeText, t } from "../i18n/LanguageController.js";
import { AtlasMap } from "./AtlasMap.js";
import { atlasHash, CHINA, CITIES, PLACES } from "./places.js";

function linkTo(route, label) {
  const link = document.createElement("a");
  link.href = atlasHash(route);
  link.textContent = label;
  return link;
}

export class AtlasView {
  constructor(navigate) {
    this.root = document.querySelector("#memory-atlas");
    this.title = document.querySelector("#atlas-title");
    this.choices = document.querySelector("#atlas-choices");
    this.crumbs = document.querySelector("#atlas-breadcrumbs");
    this.previous = document.querySelector("#atlas-prev");
    this.next = document.querySelector("#atlas-next");
    this.previous.onclick = () => this.changePage(-1);
    this.next.onclick = () => this.changePage(1);
    this.map = new AtlasMap(document.querySelector("#atlas-map"), navigate, (id, source) => this.preview(id, source));
    this.page = 0;
    this.root.addEventListener("click", (event) => {
      const link = event.target.closest(".atlas-wordmark, #atlas-breadcrumbs a");
      if (!link || link.hash !== atlasHash(this.route) || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      this.map.recenter();
    });
    const previewFrom = (target) => {
      const node = target?.closest?.("[data-preview]");
      if (node) this.preview(node.dataset.preview, node.closest("#atlas-choices") ? "index" : "marker");
      return Boolean(node);
    };
    this.root.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "touch") previewFrom(event.target);
    });
    this.root.addEventListener("focusin", (event) => previewFrom(event.target));
    const leave = (event) => {
      const node = event.target.closest("[data-preview]");
      const next = event.relatedTarget?.closest?.("[data-preview]");
      if (!node || next) return;
      this.preview(this.route?.place, "selected");
    };
    this.root.addEventListener("pointerout", (event) => { if (event.pointerType !== "touch") leave(event); });
    this.root.addEventListener("focusout", leave);
    this.size = new ResizeObserver(() => {
      if (this.route && this.root.clientWidth && this.pageSize !== this.capacity()) this.renderIndex();
    });
    this.size.observe(this.root);
  }
  capacity() {
    return this.root.clientWidth <= 520 ? 4 : this.root.clientWidth < 1000 ? 5 : 6;
  }
  show(route, { fit = true, immediate = false, focus = false, fromZoom = false } = {}) {
    const old = this.route;
    this.route = route;
    this.root.dataset.level = route.level;
    this.root.style.setProperty("--location-ink", PLACES[route.place]?.ink ?? CITIES[route.city]?.ink ?? "#416555");
    if (old?.city !== route.city || route.level === "country") this.page = 0;
    if (route.level === "city" && old?.place && old.city === route.city) {
      this.page = Math.max(0, Math.floor(CITIES[route.city].places.indexOf(old.place) / this.capacity()));
    }
    if (fromZoom) this.map.followZoom(route);
    else if (fit) this.map.fly(route, immediate);
    this.render();
    if (focus) this.title.focus({ preventScroll: true });
    const touchCity = !fromZoom && route.level === "city" && matchMedia("(hover:none)").matches;
    this.preview(route.place ?? (touchCity ? CITIES[route.city].places[0] : null), "selected");
  }
  preview(id, source = "marker") {
    this.map.setPreview(id ?? null, source);
    for (const link of this.choices.children) link.classList.toggle("is-preview", link.dataset.preview === id);
  }
  changePage(offset) {
    this.page += offset;
    this.preview(null);
    this.renderIndex();
    const control = offset > 0 ? this.next : this.previous;
    if (control.disabled) this.choices.querySelector("a")?.focus({ preventScroll: true });
  }
  renderIndex() {
    const { route, choices } = this;
    const city = CITIES[route.city], site = PLACES[route.place];
    const ids = site ? [route.place] : city ? city.places : Object.keys(CITIES);
    this.pageSize = this.capacity();
    const size = route.level === "city" ? this.pageSize : ids.length;
    this.page = Math.max(0, Math.min(this.page, Math.ceil(ids.length / size) - 1));
    const start = this.page * size;
    const end = Math.min(ids.length, start + size);
    const paged = ids.length > size;
    document.querySelector("#atlas-page-controls").hidden = !paged;
    document.querySelector("#atlas-index-range").textContent = paged ? (start + 1) + "–" + end + " / " + ids.length : "";
    this.previous.disabled = start === 0;
    this.next.disabled = end === ids.length;
    document.querySelector("#atlas-index-label").textContent = site ? t("atlas.at") :
      city ? t("atlas.placesIn", { city: placeText(city.name) }) : t("atlas.cityIndex");
    const links = [];
    for (const id of ids.slice(start, end)) {
      const item = city ? PLACES[id] : CITIES[id];
      const place = city ? item : PLACES[item.places[0]];
      const next = site ? { ...route, level: "garden" } : city ?
        { level: "place", city: route.city, place: id } : { level: "city", city: id };
      const link = linkTo(next, "");
      link.className = "atlas-choice";
      link.dataset.city = route.city ?? id;
      link.dataset.preview = city ? id : item.places[0];
      link.style.setProperty("--spot-ink", place.ink);
      const name = document.createElement("strong"), detail = document.createElement("small");
      name.textContent = site ? t("atlas.enter") : placeText(item.name);
      detail.textContent = site ? this.coordinates(place.center) : city ? placeText(place.motif) :
        t("atlas.placeCount", { count: item.places.length });
      const arrow = document.createElement("span");
      arrow.className = "atlas-choice-arrow"; arrow.setAttribute("aria-hidden", "true"); arrow.textContent = "↗";
      link.append(name, detail, arrow);
      links.push(link);
    }
    choices.replaceChildren(...links);
  }
  render() {
    if (!this.route) return;
    const { route, title, crumbs } = this;
    const city = CITIES[route.city], site = PLACES[route.place], area = site ?? city ?? CHINA;
    document.querySelector("#atlas-kicker").textContent = placeText(area.context ?? "atlas.countryKicker");
    title.classList.toggle("is-place", Boolean(site));
    title.replaceChildren();
    if (city) title.textContent = placeText(area.name);
    else {
      const accent = document.createElement("em");
      accent.textContent = t("atlas.titleSecond");
      title.append(t("atlas.titleFirst"), getLanguage() === "en" ? " " : "", accent);
    }
    document.querySelector("#atlas-description").textContent = placeText(area.introduction ?? "atlas.countryIntro");
    const source = document.querySelector("#atlas-source");
    source.hidden = !site;
    if (site) source.href = site.sourceUrl;
    let status = t("atlas.overviewCount", { cities: Object.keys(CITIES).length, places: Object.keys(PLACES).length });
    if (city) {
      const detail = site ? (city.places.indexOf(route.place) + 1) + " / " + city.places.length :
        t("atlas.placeCount", { count: city.places.length });
      status = placeText(city.name) + " · " + detail;
    }
    document.querySelector("#atlas-legend-count").textContent = status;
    crumbs.replaceChildren(linkTo({ level: "country" }, t(CHINA.name)));
    if (city) crumbs.append(linkTo({ level: "city", city: route.city }, placeText(city.name)));
    if (site) crumbs.append(linkTo(route, placeText(site.name)));
    crumbs.lastElementChild.setAttribute("aria-current", "location");
    this.renderIndex();
    if (this.map.preview) {
      const place = PLACES[this.map.preview.id];
      this.map.caption.textContent = placeText(place.name) + "  /  " + placeText(place.motif);
    }
    this.map.draw();
  }
  coordinates([lon, lat]) { return lat.toFixed(3) + "° N   " + lon.toFixed(3) + "° E"; }
}

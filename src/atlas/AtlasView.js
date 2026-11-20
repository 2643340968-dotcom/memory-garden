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
    this.crumbs = document.querySelector("#atlas-breadcrumbs");
    this.map = new AtlasMap(document.querySelector("#atlas-map"), navigate, (id, source) => this.preview(id, source));
    this.root.addEventListener("click", (event) => {
      const link = event.target.closest(".atlas-wordmark, #atlas-breadcrumbs a");
      if (!link || link.hash !== atlasHash(this.route) || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      this.map.recenter();
    });
    const markers = this.map.markers, ghost = this.map.ghost;
    const cancelLeave = () => clearTimeout(this.leaveTimer);
    const releaseHover = () => {
      cancelLeave();
      this.leaveTimer = setTimeout(() => {
        const source = this.map.preview?.source;
        if (source !== "marker" && source !== "keyboard") return;
        const focused = markers.querySelector(":focus-visible");
        this.preview(focused?.dataset.preview ?? this.route?.place, focused ? "keyboard" : "selected");
      }, 150);
    };
    markers.addEventListener("pointerover", (event) => {
      if (event.pointerType === "touch" || event.buttons || this.map.pointers.size) return;
      const pin = event.target.closest(".atlas-marker");
      if (!pin) return;
      cancelLeave();
      this.map.setPreview(pin.dataset.preview, "marker", this.map.point(event));
    });
    markers.addEventListener("pointerout", (event) => {
      if (event.pointerType !== "touch" && !markers.contains(event.relatedTarget)) releaseHover();
    });
    ghost.addEventListener("pointerenter", cancelLeave);
    ghost.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") releaseHover();
    });
    markers.addEventListener("focusin", (event) => {
      if (!event.target.matches(":focus-visible")) return;
      cancelLeave();
      this.preview(event.target.dataset.preview, "keyboard");
    });
    markers.addEventListener("focusout", (event) => {
      if (event.target.matches(".atlas-marker") && !markers.contains(event.relatedTarget)) releaseHover();
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { cancelLeave(); this.preview(null); }
    });
  }
  show(route, { fit = true, immediate = false, focus = false, fromZoom = false } = {}) {
    clearTimeout(this.leaveTimer);
    this.route = route;
    this.root.dataset.level = route.level;
    this.root.style.setProperty("--location-ink", PLACES[route.place]?.ink ?? CITIES[route.city]?.ink ?? "#416555");
    if (fromZoom) this.map.followZoom(route);
    else if (fit) this.map.fly(route, immediate);
    this.render();
    if (focus) this.title.focus({ preventScroll: true });
    const touchCity = !fromZoom && route.level === "city" && matchMedia("(hover:none)").matches;
    this.preview(route.place ?? (touchCity ? CITIES[route.city].places[0] : null), "selected");
  }
  preview(id, source = "selected") {
    this.map.setPreview(id ?? null, source);
  }
  render() {
    if (!this.route) return;
    const { route, title, crumbs } = this;
    const city = CITIES[route.city], site = PLACES[route.place], area = site ?? city ?? CHINA;
    const kicker = document.querySelector("#atlas-kicker");
    kicker.textContent = placeText(area.context ?? "atlas.countryKicker");
    if (site) {
      const coordinates = document.createElement("span");
      const [lon, lat] = site.center;
      coordinates.className = "atlas-coordinates";
      coordinates.dir = "ltr";
      coordinates.textContent = lat.toFixed(3) + "° N · " + lon.toFixed(3) + "° E";
      kicker.append(coordinates);
    }
    title.classList.toggle("is-place", Boolean(site));
    title.replaceChildren();
    if (city) title.textContent = placeText(area.name);
    else {
      const accent = document.createElement("em");
      accent.textContent = t("atlas.titleSecond");
      title.append(t("atlas.titleFirst"), getLanguage() === "en" ? " " : "", accent);
    }
    title.classList.toggle("is-long", Boolean(site) && title.textContent.length > (getLanguage() === "en" ? 22 : 8));
    document.querySelector("#atlas-description").textContent = placeText(area.introduction ?? "atlas.countryIntro");
    document.querySelector("#atlas-place-actions").hidden = !site;
    if (site) {
      document.querySelector("#atlas-enter").href = atlasHash({ ...route, level: "garden" });
      document.querySelector("#atlas-source").href = site.sourceUrl;
      const flowerSource = document.querySelector("#atlas-flower-source");
      flowerSource.hidden = !site.flowerSource;
      if (site.flowerSource) flowerSource.href = site.flowerSource;
      else flowerSource.removeAttribute("href");
    }
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
    this.map.localizePreview();
    this.map.queueDraw();
  }
}

import { getLanguage, t } from "../i18n/LanguageController.js";
import { AtlasMap } from "./AtlasMap.js";
import { atlasHash, CHINA, CITIES, PLACES } from "./places.js";
import specimen from "./zijincao.webp";

function linkTo(route, label) {
  const link = document.createElement("a");
  link.href = atlasHash(route);
  link.textContent = label;
  return link;
}

export class AtlasView {
  constructor(navigate) {
    this.map = new AtlasMap(document.querySelector("#atlas-map"), navigate);
    this.title = document.querySelector("#atlas-title");
    this.choices = document.querySelector("#atlas-choices");
    this.crumbs = document.querySelector("#atlas-breadcrumbs");
  }

  show(route, { fit = true, immediate = false, focus = false } = {}) {
    this.route = route;
    if (fit) this.map.fly(route, immediate);
    else this.map.draw();
    this.render();
    if (focus) this.title.focus({ preventScroll: true });
  }

  render() {
    const { route, title, crumbs, choices } = this;
    if (!route) return;
    const city = CITIES[route.city];
    const site = PLACES[route.place];
    const area = site ?? city ?? CHINA;
    document.querySelector("#atlas-kicker").textContent = t(area.context ?? "atlas.countryKicker");
    title.classList.toggle("is-place", Boolean(site));
    title.replaceChildren();
    if (city) title.textContent = t(area.name);
    else {
      const second = document.createElement("em");
      second.textContent = t("atlas.titleSecond");
      title.append(t("atlas.titleFirst"), getLanguage() === "en" ? " " : "", second);
    }
    document.querySelector("#atlas-description").textContent = t(area.introduction ?? "atlas.countryIntro");
    document.querySelector("#atlas-index-label").textContent = site
      ? this.coordinates(site.center)
      : t(city?.directory ?? "atlas.cities");
    crumbs.replaceChildren(linkTo({ level: "country" }, t(CHINA.name)));
    if (city) crumbs.append(linkTo({ level: "city", city: route.city }, t(city.name)));
    if (site) crumbs.append(linkTo(route, t(site.name)));
    crumbs.lastElementChild.setAttribute("aria-current", "location");
    choices.replaceChildren();
    const ids = site ? [route.place] : (city?.places ?? Object.keys(CITIES));
    for (const id of ids) {
      const item = city ? PLACES[id] : CITIES[id];
      const next = site ? { ...route, level: "garden" } : city
        ? { level: "place", city: route.city, place: id }
        : { level: "city", city: id };
      const link = linkTo(next, "");
      link.className = "atlas-choice";
      const photo = document.createElement("img");
      photo.src = specimen;
      photo.alt = "";
      photo.draggable = false;
      const label = document.createElement("span");
      const name = document.createElement("strong");
      const hint = document.createElement("small");
      name.textContent = t(site ? "atlas.enter" : item.name);
      hint.textContent = t(site?.flower ?? item.region);
      label.append(name,hint);
      const arrow = document.createElement("span");
      arrow.className = "atlas-choice-arrow";
      arrow.setAttribute("aria-hidden","true");
      arrow.textContent = "→";
      link.append(photo, label, arrow);
      choices.append(link);
    }
    this.map.draw();
  }

  coordinates([lon, lat]) {
    return `${lat.toFixed(4)}° N　${lon.toFixed(4)}° E`;
  }
}

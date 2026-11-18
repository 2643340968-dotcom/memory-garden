import { getLanguage, placeText, t } from "../i18n/LanguageController.js";
import { AtlasMap } from "./AtlasMap.js";
import { FieldStudy } from "./FieldStudy.js";
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
    this.plate = new FieldStudy(document.querySelector("#atlas-plate"));
    this.map = new AtlasMap(document.querySelector("#atlas-map"), navigate, (id) => this.preview(id));
    this.previewCity = "nanjing";
    const previewChoice = (event) => {
      const link = event.target.closest("[data-city]");
      if (link && this.route?.level === "country") this.preview(link.dataset.city);
    };
    this.choices.addEventListener("pointerover", previewChoice);
    this.choices.addEventListener("focusin", previewChoice);
  }

  show(route, { fit = true, immediate = false, focus = false } = {}) {
    this.route = route;
    this.root.dataset.level = route.level;
    if (fit) this.map.fly(route, immediate);
    this.render();
    if (focus) this.title.focus({ preventScroll: true });
  }

  preview(id, interact = true) {
    this.previewCity = id;
    this.plate.show(id);
    const city = CITIES[id];
    const site = PLACES[city.places[0]];
    document.querySelector("#plate-caption").textContent =
      placeText(site.name) + "  /  " + placeText(site.motif);
    this.map.highlight(id, interact);
    for (const link of this.choices.children) {
      link.classList.toggle("is-preview", link.dataset.city === id);
    }
  }

  render() {
    if (!this.route) return;
    const { route, title, choices, crumbs } = this;
    const city = CITIES[route.city];
    const site = PLACES[route.place];
    const area = site ?? city ?? CHINA;
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
    document.querySelector("#atlas-legend-count").textContent = t("atlas.locations", { count: Object.keys(PLACES).length });
    document.querySelector("#atlas-index-label").textContent = site ? t("atlas.at") :
      city ? t("atlas.placesIn", { city: placeText(city.name) }) : t("atlas.directory");
    crumbs.replaceChildren(linkTo({ level: "country" }, t(CHINA.name)));
    if (city) crumbs.append(linkTo({ level: "city", city: route.city }, placeText(city.name)));
    if (site) crumbs.append(linkTo(route, placeText(site.name)));
    crumbs.lastElementChild.setAttribute("aria-current", "location");
    const links = [];
    const ids = site ? [route.place] : (city?.places ?? Object.keys(CITIES));
    for (const id of ids) {
      const item = city ? PLACES[id] : CITIES[id];
      const firstSite = city ? item : PLACES[item.places[0]];
      const next = site ? { ...route, level: "garden" } : city ?
        { level: "place", city: route.city, place: id } : { level: "city", city: id };
      const link = linkTo(next, "");
      link.className = "atlas-choice";
      link.dataset.city = route.city ?? id;
      const name = document.createElement("strong");
      const detail = document.createElement("small");
      const arrow = document.createElement("span");
      name.textContent = site ? t("atlas.enter") : placeText(item.name);
      detail.textContent = city ? this.coordinates(firstSite.center) : placeText(firstSite.name);
      arrow.className = "atlas-choice-arrow";
      arrow.setAttribute("aria-hidden","true");
      arrow.textContent = "↗";
      link.append(name, detail, arrow);
      links.push(link);
    }
    choices.replaceChildren(...links);
    this.map.draw();
    this.preview(route.city ?? this.previewCity, false);
  }

  coordinates([lon, lat]) {
    return `${lat.toFixed(3)}° N   ${lon.toFixed(3)}° E`;
  }
}

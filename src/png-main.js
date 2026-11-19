import "./styles.css";
import "./atlas/atlas.css";
import { createLanguageController, placeText, subscribeLanguage, t } from "./i18n/LanguageController.js";
import { AtlasView } from "./atlas/AtlasView.js";
import { atlasHash, CITIES, PLACES, readAtlasRoute } from "./atlas/places.js";

const language = createLanguageController().start();
const atlasElement = document.querySelector("#memory-atlas");
const gardenElement = document.querySelector("#garden-view");
const loading = document.querySelector("#garden-loading");
const back = document.querySelector("#garden-back");
const themeColor = document.querySelector('meta[name="theme-color"]');
const atlas = new AtlasView((route, { fromZoom = false } = {}) => {
  const hash = atlasHash(route);
  if (fromZoom) {
    history.replaceState(null, "", hash);
    void showRoute({ fromZoom: true });
  } else {
    location.hash = hash;
  }
});
let gardenPromise;
let garden;
let lastRoute;
let routeVersion = 0;

function localizeGarden(route) {
  const site = PLACES[route.place];
  const name = placeText(site.name);
  const locationLabel = placeText(CITIES[route.city].name) + " · " + name;
  gardenElement.dataset.place = route.place;
  gardenElement.style.setProperty("--place-ink", site.ink);
  gardenElement.toggleAttribute("data-toned", !site.bloomOnSubmit);
  if (!site.bloomOnSubmit) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(site.ink.slice(i, i + 2), 16));
    const hue = Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI;
    gardenElement.style.setProperty("--field-hue", (hue - 278) + "deg");
  }
  gardenElement.setAttribute("aria-label", name + " · " + t("atlas.garden"));
  document.querySelector(".brand-block .subtitle").textContent = locationLabel;
  document.querySelector(".memory-entry-index").textContent = locationLabel;
  document.querySelector("#memory-entry-title").textContent = t("entry.placeTitle", { place: name });
  document.querySelector('[data-i18n="entry.descriptionLine1"]').textContent = placeText(site.prompt);
  document.querySelector("#memory-submit span").textContent = t(site.bloomOnSubmit ? "entry.submit" : "entry.save");
}

async function showRoute({ fromZoom = false } = {}) {
  const route = readAtlasRoute(location.hash);
  const version = ++routeVersion;
  const previous = lastRoute;
  lastRoute = route;
  const inGarden = route.level === "garden";
  themeColor.content = inGarden ? "#2b2335" : "#f5f2e8";
  document.body.dataset.view = inGarden ? "garden" : "atlas";
  atlasElement.hidden = inGarden;
  gardenElement.hidden = !inGarden;
  if (!inGarden) {
    if (garden?.memoryExperience.gardenActive) garden.memoryExperience.leave();
    const returning = previous?.level === "garden" && atlas.route?.place === route.place &&
      atlas.route?.level === route.level;
    atlas.show(route, { fit: !returning && !fromZoom, fromZoom,
      immediate: !previous || previous.level === "garden", focus: Boolean(previous) && !fromZoom });
    return;
  }

  atlas.map.clearPreview();
  back.href = atlasHash({ ...route, level: "place" });
  localizeGarden(route);
  back.focus({ preventScroll: true });
  loading.hidden = Boolean(garden);
  const fatal = document.querySelector("#fatal-error");
  fatal.hidden = true;
  if (!gardenPromise) {
    gardenPromise = import("./png-garden.js").then(({ openPNGGarden }) =>
      openPNGGarden(language),
    );
  }
  try {
    const [runtime, collection] = await Promise.all([gardenPromise, PLACES[route.place].loadCollection()]);
    garden = runtime;
    if (!garden) throw new Error("Garden initialization failed");
    if (version === routeVersion) garden.memoryExperience.enter(collection, Boolean(PLACES[route.place].bloomOnSubmit));
    else if (lastRoute.level !== "garden") garden.memoryExperience.leave();
  } catch {
    if (!garden) gardenPromise = null;
    if (version === routeVersion) fatal.hidden = false;
  } finally {
    if (version === routeVersion) loading.hidden = true;
  }
}

back.addEventListener("click", (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (history.state?.gardenFrom === back.hash) {
    event.preventDefault();
    history.back();
  }
});
// A zoom can replace the current entry with the same hash as the preceding
// explicit visit. Traversing those two entries doesn't fire a hashchange.
window.addEventListener("popstate", () => {
  if (lastRoute && lastRoute.level !== "garden" && atlas.map.manual && location.hash === atlasHash(lastRoute)) {
    atlas.map.recenter();
  }
});
window.addEventListener("hashchange", (event) => {
  const from = new URL(event.oldURL).hash;
  if (readAtlasRoute(location.hash).level === "garden" && readAtlasRoute(from).level === "place") {
    history.replaceState({ gardenFrom: from }, "");
  }
  void showRoute();
});
subscribeLanguage(() => {
  if (lastRoute?.level === "garden") localizeGarden(lastRoute);
  else atlas.render();
});
void showRoute();

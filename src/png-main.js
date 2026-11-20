import "./styles.css";
import "./atlas/atlas.css";
import "./memory/visitor-media.css";
import "./atlas/typography.css";
import "./atlas/garden-arrival.css";
import { createLanguageController, placeText, subscribeLanguage, t } from "./i18n/LanguageController.js";
import { AtlasView } from "./atlas/AtlasView.js";
import { GardenArrival } from "./atlas/GardenArrival.js";
import { atlasHash, CITIES, PLACES, readAtlasRoute } from "./atlas/places.js";

const language = createLanguageController().start();
const atlasElement = document.querySelector("#memory-atlas");
const gardenElement = document.querySelector("#garden-view");
const arrival = new GardenArrival(document.querySelector("#garden-arrival"));
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

function loadGarden() {
  gardenPromise ??= import("./png-garden.js")
    .then(({ openPNGGarden }) => openPNGGarden(language))
    .then(runtime => {
      if (!runtime) throw new Error("Garden initialization failed");
      runtime.setRendering(false);
      garden = runtime;
      return runtime;
    })
    .catch(error => {
      gardenPromise = null;
      throw error;
    });
  return gardenPromise;
}

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
  const gardenTitle = t("garden.title") + " · " + locationLabel;
  gardenElement.setAttribute("aria-label", gardenTitle);
  document.title = gardenTitle;
  document.querySelector("#garden-arrival-place").textContent = locationLabel;
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
  atlasElement.inert = inGarden;
  gardenElement.hidden = !inGarden;
  if (!inGarden) {
    arrival.close();
    atlasElement.hidden = false;
    document.title = t("document.title");
    if (garden?.memoryExperience.gardenActive) garden.memoryExperience.leave();
    const returning = previous?.level === "garden" && atlas.route?.place === route.place &&
      atlas.route?.level === route.level;
    atlas.show(route, { fit: !returning && !fromZoom, fromZoom,
      immediate: !previous || previous.level === "garden", focus: Boolean(previous) && !fromZoom });
    return;
  }

  // Keep the paper map underneath the opening veil until the field is ready.
  atlasElement.hidden = !previous || previous.level === "garden";
  if (garden?.memoryExperience.gardenActive && previous?.place !== route.place) garden.memoryExperience.leave();
  atlas.map.clearPreview();
  back.href = atlasHash({ ...route, level: "place" });
  localizeGarden(route);
  const titleHold = arrival.open(route.place, PLACES[route.place]);
  const fatal = document.querySelector("#fatal-error");
  fatal.hidden = true;
  try {
    const [runtime, collection] = await Promise.all([loadGarden(), PLACES[route.place].loadCollection()]);
    if (version !== routeVersion) return;
    arrival.loading.hidden = true;
    await titleHold;
    if (version !== routeVersion) return;
    atlasElement.hidden = true;
    runtime.memoryExperience.enter(collection, Boolean(PLACES[route.place].bloomOnSubmit));
    arrival.reveal();
  } catch {
    if (version === routeVersion) {
      arrival.close();
      atlasElement.hidden = true;
      fatal.hidden = false;
      back.focus({ preventScroll: true });
    }
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

import "./styles.css";
import "./atlas/atlas.css";
import { createLanguageController, subscribeLanguage } from "./i18n/LanguageController.js";
import { AtlasView } from "./atlas/AtlasView.js";
import { atlasHash, PLACES, readAtlasRoute } from "./atlas/places.js";

const language = createLanguageController().start();
const atlasElement = document.querySelector("#memory-atlas");
const gardenElement = document.querySelector("#garden-view");
const loading = document.querySelector("#garden-loading");
const back = document.querySelector("#garden-back");
const atlas = new AtlasView((route) => { location.hash = atlasHash(route); });
let gardenPromise;
let garden;
let lastRoute;
let routeVersion = 0;

async function showRoute() {
  const route = readAtlasRoute(location.hash);
  const version = ++routeVersion;
  const previous = lastRoute;
  lastRoute = route;
  const inGarden = route.level === "garden";
  document.body.dataset.view = inGarden ? "garden" : "atlas";
  atlasElement.hidden = inGarden;
  gardenElement.hidden = !inGarden;
  if (!inGarden) {
    if (garden?.memoryExperience.gardenActive) garden.memoryExperience.leave();
    const returning = previous?.level === "garden" && atlas.route?.place === route.place &&
      atlas.route?.level === route.level;
    atlas.show(route, { fit: !returning, immediate: !previous || previous.level === "garden", focus: Boolean(previous) });
    return;
  }

  back.href = atlasHash({ ...route, level: "place" });
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
    if (version === routeVersion) garden.memoryExperience.enter(collection);
    else if (lastRoute.level !== "garden") garden.memoryExperience.leave();
  } catch {
    gardenPromise = null;
    fatal.hidden = false;
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
window.addEventListener("hashchange", (event) => {
  const from = new URL(event.oldURL).hash;
  if (readAtlasRoute(location.hash).level === "garden" && readAtlasRoute(from).level === "place") {
    history.replaceState({ gardenFrom: from }, "");
  }
  void showRoute();
});
subscribeLanguage(() => atlas.render());
void showRoute();

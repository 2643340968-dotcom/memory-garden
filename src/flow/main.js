import "./style.css";
import {CITIES, PLACES, atlasHash, readAtlasRoute} from "../atlas/places.js";
import {getLanguage, placeText, setLanguage, LANGUAGE_STORAGE_KEY} from "../i18n/LanguageController.js";
import {FlowAtlas} from "./atlas.js";
import {FlowGarden} from "./garden.js";

const el = id => document.getElementById(id);
const local = (zh, en) => getLanguage() === "zh-CN" ? zh : en;
const overview = {
  level : "country"
};
const counts = {
  cities : Object.keys(CITIES).length,
  places : Object.keys(PLACES).length
};
const visits = new Map();
const languageKey = "memory-flow-language-v1";
let initialLanguage = "zh-CN";
try {
  initialLanguage =
      localStorage.getItem(languageKey) ?? localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? initialLanguage;
} catch {
}
setLanguage(initialLanguage, {persist : false});
let route, version = 0, entryTimer, holdTimer, releaseTitle, skipped = false, failed = false,
           hovered = null, noticeTimer, chapterTimer;
const quiet = matchMedia("(prefers-reduced-motion: reduce)");
const touch = matchMedia("(hover:none)");

function cancelEntry() {
  clearTimeout(entryTimer);
}
function closeChapter() {
  clearTimeout(chapterTimer);
  el("chapter").classList.remove("visible");
  el("dismiss-chapter").hidden = true;
}
function playChapter() {
  closeChapter();
  el("guide").open = false;
  el("chapter").classList.add("visible");
  el("dismiss-chapter").hidden = false;
  chapterTimer = setTimeout(closeChapter, route.level === "place" ? 5400 : 3800);
}
function mapGesture() {
  cancelEntry();
  closeChapter();
  el("guide").open = false;
}
const atlas = new FlowAtlas(el("map"), {
  navigate : r => navigate(r),
  step : r => navigate(r, {replace : true, keep : true, focus : false}),
  gesture : mapGesture,
  read : mark => {
    hovered = mark;
    if (mark)
      closeChapter();
    readout();
  },
  choose : chooseSite,
});
const garden = new FlowGarden({
  saved : () => {
    el("notice").textContent =
        local("已留在此处的花园，本次到访可回看。", "Saved in this garden for your visit.");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el("notice").textContent = "", 4200);
  },
  readout : label => readout(label)
});

function chooseSite(id) {
  if (route.level === "garden")
    return;
  const place = {level : "place", city : PLACES[id].city, place : id};
  if (route.place === id) {
    navigate({...place, level : "garden"});
    return;
  }
  void PLACES[id].loadCollection().catch(() => {});
  navigate(place);
  const expected = version;
  entryTimer = setTimeout(() => {
    if (version === expected)
      navigate({...place, level : "garden"});
  }, quiet.matches ? 180 : 760);
}
function navigate(next, opts = {}) {
  cancelEntry();
  if (route && atlasHash(route) === atlasHash(next)) {
    if (next.level !== "garden")
      atlas.recenter();
    return;
  }
  const state = {flowFrom : route ? atlasHash(route) : null};
  history[opts.replace ? "replaceState" : "pushState"](state, "", atlasHash(next));
  void show(next, opts);
}
function link(r, label) {
  const a = document.createElement("a");
  a.href = atlasHash(r);
  a.textContent = label;
  return a;
}
function trail() {
  const nav = el("trail"), city = CITIES[route.city], site = PLACES[route.place];
  const items = [ link(overview, local("全国", "China")) ];
  if (city)
    items.push(link({level : "city", city : route.city}, placeText(city.name)));
  if (site)
    items.push(link({level : "place", city : route.city, place : route.place}, placeText(site.name)));
  if (route.level === "garden")
    items.push(link(route, local("花园", "Garden")));
  nav.replaceChildren(...items);
  items.at(-1).setAttribute("aria-current", "location");
}
function readout(gardenLabel = null) {
  if (!route)
    return;
  const isGarden = route.level === "garden";
  const pos = !isGarden && hovered ? PLACES[hovered.site].center :
                                     PLACES[route.place]?.center ?? CITIES[route.city]?.center;
  let label = local("全国地图", "National atlas");
  if (hovered && !isGarden)
    label = placeText(hovered.national ? CITIES[hovered.city].name : PLACES[hovered.site].name);
  else if (isGarden)
    label = gardenLabel ?? local("花园俯视图", "Garden plan");
  else if (route.city)
    label = placeText((PLACES[route.place] ?? CITIES[route.city]).name);
  el("readout").textContent = label;
  el("coordinates").textContent = pos ? pos[1].toFixed(3) + "° N  /  " + pos[0].toFixed(3) + "° E" : "";
}
function legend(isGarden) {
  const values = isGarden ?
      [
        [ "featured", local("精选记忆", "Featured") ],
        [ "personal", local("个人记忆", "Personal") ],
        ...(route.place === "jiangdongmen" ? [ [ "archive", local("档案片段", "Archives") ] ] : []),
      ] :
      [
        [ "personal", local("个人记忆", "Personal memory") ],
        [ "collective", local("集体记忆", "Collective memory") ],
        [ "public", local("公共记忆", "Public memory") ],
      ];
  el("legend").replaceChildren(...values.map(([ kind, label ]) => {
    const span = document.createElement("span");
    span.className = kind;
    span.textContent = label;
    return span;
  }));
}
function chrome() {
  const isGarden = route.level === "garden", city = CITIES[route.city], site = PLACES[route.place];
  const n = city?.places.length;
  const project = local("记忆之场", "Site of Memory"), gardenName = local("记忆花园", "Memory Garden");
  el("edition-name").textContent = project;
  document.querySelector(".home").setAttribute(
      "aria-label", local("返回全国地图", "Back to the national atlas"));
  el("trail").setAttribute("aria-label", local("当前位置", "Current location"));
  el("map").setAttribute("aria-label", local("可缩放的记忆地图", "Interactive memory atlas"));
  el("garden").setAttribute("aria-label", gardenName);
  el("flow-language").textContent = el("sheet-language").textContent = local("EN", "中文");
  for (const b of [el("flow-language"), el("sheet-language")])
    b.setAttribute("aria-label", local("Switch to English", "切换为中文"));
  el("folio").textContent = site ? placeText(city.name) + "  /  " +
          (isGarden ? local("花园俯视图", "Garden plan") : local("地点地图", "Local map")) :
      city ? local("城市地图", "City atlas") + "  /  " + local(n + " 处地点", n + " places") :
             local(
                 counts.cities + " 座城市  /  " + counts.places + " 处地点",
                 counts.cities + " cities  /  " + counts.places + " places");
  const heading = site ? placeText(site.name) : city ? placeText(city.name) : project;
  el("title").textContent = heading;
  el("title").classList.toggle("long", heading.length > (getLanguage() === "en" ? 24 : 8));
  const tip = isGarden ? local("轻触印记，读一段记忆。", "Select a mark to read a memory.") :
      site             ? local("点选此处，进入花园。", "Select this place to enter its garden.") :
      city          ? local("点开数字，再选一处地点。", "Open a numbered group, then choose a place.") :
      touch.matches ? local("轻触城市，循着水纹进入。", "Touch a city and follow the ripples.") :
                      local("指向城市，看水纹散开。", "Hover over a city to set its waters in motion.");
  el("intro").textContent = site ? placeText(site.introduction) : tip;
  el("guide-tip").textContent = tip;
  const guide = local("浏览说明与图例", "Map guide and legend");
  el("guide-toggle").setAttribute("aria-label", guide);
  el("guide-toggle").title = guide;
  el("legend").setAttribute("aria-label", local("图例", "Legend"));
  el("replay").textContent = local("重看题页", "Replay title");
  el("dismiss-chapter").textContent = local("跳过", "Skip");
  el("stage").dataset.surface = isGarden ? "garden" : "atlas";
  el("stage").dataset.level = route.level;
  el("enter").hidden = route.level !== "place";
  el("enter").textContent = local("进入花园  ↗", "Enter the garden  ↗");
  el("write").hidden = !isGarden;
  el("write").textContent = local("＋  留下记忆", "＋  Leave a memory");
  const back = el("back");
  back.hidden = !isGarden;
  if (isGarden) {
    back.href = atlasHash({...route, level : "place"});
    back.textContent = local("← 返回地图", "← Back to map");
  }
  el("map-tools").hidden = isGarden;
  document.querySelector(".north").hidden = isGarden;
  el("credit-title").textContent = local("地图来源", "Map sources");
  el("zoom-in").setAttribute("aria-label", local("放大", "Zoom in"));
  el("zoom-out").setAttribute("aria-label", local("缩小", "Zoom out"));
  el("fit").setAttribute("aria-label", local("地图居中", "Fit this view"));
  el("arrival-title").textContent =
      failed ? local("花园载入未完成", "The garden could not load") : gardenName;
  el("arrival-place").textContent = site ? placeText(city.name) + "  /  " + placeText(site.name) : "";
  el("arrival-note").textContent = site && !failed ? placeText(site.introduction) : "";
  el("skip").textContent = failed ? local("重试", "Retry") : local("跳过过场", "Skip introduction");
  el("arrival-back").hidden = !failed;
  el("arrival-back").textContent = local("返回地图", "Back to map");
  document.title = (site ? heading + " · " : "") + (isGarden ? gardenName : project) + " · " +
      local("流动地图", "Flow Atlas");
  trail();
  legend(isGarden);
  readout();
  if (isGarden)
    garden.updateLanguage();
  else
    atlas.invalidate();
}
function closeTitle() {
  clearTimeout(holdTimer);
  releaseTitle?.();
  releaseTitle = null;
  el("arrival").hidden = true;
  el("stage").inert = false;
  document.querySelector(".masthead").inert = document.querySelector("footer").inert = false;
}
function holdTitle() {
  el("stage").inert = true;
  document.querySelector(".masthead").inert = document.querySelector("footer").inert = true;
  el("arrival").hidden = false;
  el("arrival").classList.remove("fading");
  el("arrival-title").focus({preventScroll : true});
  const readingTime = el("arrival-note").textContent.length * (getLanguage() === "en" ? 29 : 88);
  return new Promise(resolve => {
    releaseTitle = resolve;
    holdTimer = setTimeout(resolve, Math.min(5800, Math.max(2600, readingTime)));
  });
}
async function finishTitle(turn) {
  if (turn !== version)
    return;
  if (!quiet.matches && !skipped) {
    el("arrival").classList.add("fading");
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  if (turn === version) {
    closeTitle();
    el("title").focus({preventScroll : true});
  }
}
async function show(next, {keep = false, restore = false, focus = true} = {}) {
  cancelEntry();
  const turn = ++version;
  if (route && route.level !== "garden" && !keep && atlas.w && atlasHash(route) !== atlasHash(next)) {
    visits.set(atlasHash(route), atlas.snapshot());
  }
  closeChapter();
  el("guide").open = false;
  closeTitle();
  clearTimeout(noticeTimer);
  el("notice").textContent = "";
  if (route?.level === "garden")
    garden.leave();
  route = next;
  hovered = null;
  skipped = false;
  failed = false;
  if (route.level !== "garden") {
    garden.root.hidden = true;
    atlas.show(
        route, {keep, restore : restore ? visits.get(atlasHash(route)) : null, immediate : turn === 1});
    chrome();
    if (!keep && !restore)
      playChapter();
    if (focus && turn > 1)
      el("title").focus({preventScroll : true});
    return;
  }
  atlas.hide();
  chrome();
  el("write").disabled = true;
  try {
    const [collection] = await Promise.all([ PLACES[route.place].loadCollection(), holdTitle() ]);
    if (turn !== version)
      return;
    garden.enter(route.place, collection);
    el("write").disabled = false;
    chrome();
    await finishTitle(turn);
  } catch {
    if (turn !== version)
      return;
    failed = true;
    chrome();
    el("skip").focus();
  }
}
el("skip").onclick = () => {
  if (failed) {
    void show(route);
    return;
  }
  skipped = true;
  clearTimeout(holdTimer);
  releaseTitle?.();
};
el("arrival-back").onclick = () => navigate({...route, level : "place"}, {restore : true});
el("dismiss-chapter").onclick = closeChapter;
el("guide").addEventListener("toggle", () => {
  if (el("guide").open)
    closeChapter();
});
el("replay").onclick = async () => {
  if (route.level !== "garden") {
    playChapter();
    return;
  }
  el("guide").open = false;
  skipped = false;
  const turn = version;
  await holdTitle();
  await finishTitle(turn);
};
document.addEventListener("pointerdown", e => {
  if (!e.target.closest("#guide"))
    el("guide").open = false;
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape")
    return;
  if (!el("arrival").hidden && !failed) {
    el("skip").click();
    return;
  }
  if (el("guide").open) {
    el("guide").open = false;
    el("guide-toggle").focus();
  }
  closeChapter();
});
el("enter").onclick = () => {
  if (route.place)
    navigate({...route, level : "garden"});
};
el("edition").addEventListener("click", e => {
  const a = e.target.closest(".masthead a[href^=\"#\"],#back");
  if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  e.preventDefault();
  const next = readAtlasRoute(a.hash);
  if (route.level === "garden" && next.level === "place" && history.state?.flowFrom === a.hash) {
    history.back();
    return;
  }
  navigate(next, {restore : route.level === "garden"});
});
function changeLanguage() {
  const lang = getLanguage() === "en" ? "zh-CN" : "en";
  try {
    localStorage.setItem(languageKey, lang);
  } catch {
  }
  setLanguage(lang, {persist : false});
  chrome();
}
el("flow-language").onclick = el("sheet-language").onclick = changeLanguage;
window.addEventListener("popstate", () => {
  void show(readAtlasRoute(location.hash), {restore : true});
});
window.addEventListener("hashchange", () => {
  const next = readAtlasRoute(location.hash);
  if (atlasHash(route) !== atlasHash(next))
    void show(next, {restore : true});
});
void show(readAtlasRoute(location.hash), {focus : false});

import "./style.css";
import "./exchange.css";
import {CITIES, PLACES} from "./places.js";
import {getLanguage, placeText, setLanguage, LANGUAGE_STORAGE_KEY} from "../i18n/LanguageController.js";
import {FlowAtlas} from "./atlas.js";
import {paper} from "./FlowBasemap.js";
import {FlowGarden} from "./garden.js";
import {AtlasLanding} from "./landing.js";
import {nationalMarks} from "./overview.js";
import {flowHash, readFlowRoute, nextMapLevel} from "./levels.js";
import {FlowerBook} from "./flowerBook.js";
import {plateURL, prepareGardenPrints, profileURL} from "./flowerForms.js";
import {ExchangeStore} from "./exchange/store.js";
import {ExchangePanel} from "./exchange/panel.js";

const el = id => document.getElementById(id);
const flowerBackground = key => 'url("' + new URL(plateURL(key), document.baseURI).href + '")';
const local = (zh, en) => getLanguage() === "zh-CN" ? zh : en;
const overview = {
  level : "country"
};
const counts = {
  cities : nationalMarks.length,
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
let route, version = 0, failed = false,
           hovered = null, noticeTimer, chapterTimer;
const quiet = matchMedia("(prefers-reduced-motion: reduce)");
const touch = matchMedia("(hover:none)");
function updateLandingHint() {
  const scroll = local(touch.matches ? "上滑进入地图" : "下滑进入地图", touch.matches ? "Swipe up to enter" : "Scroll to enter");
  const drag = local(touch.matches ? "横划花瓣" : "拖动花瓣", touch.matches ? "Brush petals sideways" : "Drag the petals");
  el("landing-cue").setAttribute("aria-label", local("进入全国地图", "Enter the national atlas"));
  el("landing-hint").textContent = quiet.matches ? scroll : drag + " · " + scroll;
}
quiet.addEventListener("change", updateLandingHint);
touch.addEventListener("change", updateLandingHint);
function setMode(mode) {
  el("edition").dataset.tools = mode;
}

function closeChapter() {
  clearTimeout(chapterTimer);
  el("chapter").classList.remove("visible");
  el("chapter").setAttribute("aria-hidden", "true");
  el("dismiss-chapter").hidden = true;
}
function playChapter() {
  closeChapter();
  el("guide").open = false;
  el("chapter").classList.add("visible");
  el("chapter").removeAttribute("aria-hidden");
  el("dismiss-chapter").hidden = false;
  chapterTimer = setTimeout(closeChapter, route.level === "place" ? 5400 : 3800);
}
function mapGesture() {
  landing.enter();
  closeChapter();
  el("guide").open = false;
}
const atlas = new FlowAtlas(el("map"), {
  navigate : r => navigate(r, {chapter:false}),
  step : (inward, mark) => advance(inward, mark),
  gesture : mapGesture,
  read : mark => {
    hovered = mark;
    if (mark)
      closeChapter();
    readout();
  },
  choose : chooseSite,
  cityLanded : city => flowerBook.cityLanded(city),
});
const landing = new AtlasLanding(el("landing"), atlas, () => {
  setMode("map");
  if (route?.level === "country" && !location.hash)
    history.pushState({flowFrom : "opening"}, "", "#atlas");
});
const flowerBook = new FlowerBook(el("flower-book"), open => {
  landing.flowers.obscured = open;
  landing.flowers.wake();
  if (!open) garden.updateActions();
});

function openLanding(reverse = false) {
  setMode("cover");
  closeChapter();
  const home = new URL(location.href);
  home.hash = "";
  if (location.hash)
    history.pushState({flowOpening : true}, "", home);
  if (route.level !== "country")
    void show(overview, {opening : true, focus : false});
  else {
    atlas.show(overview, {immediate : true});
    landing.open(true, reverse);
  }
}
const store = new ExchangeStore();
const savedMessage = () => store.db ? local("记忆已保存在此浏览器，可在花园或「我的互访」回看。","Memory saved in this browser. Revisit it here or in My exchanges.") :
  local("记忆已留在花园，本次访问可回看。","Memory saved for this visit.");
const garden = new FlowGarden({
  store,
  saved : () => {
    el("notice").textContent = savedMessage();
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el("notice").textContent = "", 4200);
  },
  readout : label => readout(label)
});
let requestedFlower = null;
const exchange = new ExchangePanel(el("exchange-panel"),store,{
  toggle(open) {
    el("guide").open = false;
    if (open) closeChapter();
    landing.flowers.obscured = open;
    landing.flowers.wake();
    if (!open) garden.updateActions();
  },
  language:() => changeLanguage(),
  visit(site,record,write) {
    requestedFlower = {site,record,write};
    if (garden.id === site && route.level === "garden") openRequestedFlower();
    else navigate({level:"garden",city:PLACES[site].city,place:site});
  }
});
function openRequestedFlower() {
  if (!requestedFlower || requestedFlower.site !== garden.id) return;
  const {record, write} = requestedFlower;
  requestedFlower = null;
  if (write || record) {
    garden.directEntry = true;
    garden.invitation.dismiss();
  }
  if (write) garden.openEditor(write);
  else if (record) garden.openRecord(garden.recordById(record));
}
for (const id of ["exchange-my","exchange-guide"]) el(id).onclick = () => exchange.open({view:"mine",city:route.city});
el("exchange-city").onclick = () => exchange.open({view:"hub",city:route.city});
el("exchange-stop").onclick = () => exchange.open({view:"add",city:route.city,site:route.place});

function advance(inward, mark) {
  if (landing.active) {
    if (inward) el("landing-cue").click();
    return;
  }
  if (route.level === "garden" && inward) {
    if (failed) void show(route);
    return;
  }
  const next = nextMapLevel(route, inward, mark);
  if (!next) return;
  if (next.level === "opening") { openLanding(true); return; }
  navigate(next, {chapter:false, focus:false, restore:!inward});
}

function chooseSite(id) {
  if (!atlas.active) return;
  const place = {level : "place", city : PLACES[id].city, place : id};
  if (route.place === id) {
    navigate({...place, level : "arrival"});
    return;
  }
  void PLACES[id].loadCollection().catch(() => {});
  navigate(place, {chapter:false});
}
function navigate(next, opts = {}) {
  if (route && flowHash(route) === flowHash(next)) {
    if (atlas.active) atlas.recenter();
    return;
  }
  const state = {flowFrom : route ? flowHash(route) : null};
  history.pushState(state, "", flowHash(next));
  void show(next, opts);
}
function link(r, label) {
  const a = document.createElement("a");
  a.href = flowHash(r);
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
  if (route.level === "arrival")
    items.push(link(route, local("题页", "Prelude")));
  if (route.level === "garden")
    items.push(link(route, local("花园", "Garden")));
  nav.replaceChildren(...items);
  items.at(-1).setAttribute("aria-current", "location");
}
function readout(gardenLabel = null) {
  if (!route)
    return;
  const isGarden = route.level === "garden";
  const pos = !isGarden && hovered ? hovered.center :
                                     PLACES[route.place]?.center ?? CITIES[route.city]?.center;
  let label = local("全国地图", "National atlas");
  if (hovered && !isGarden)
    label = placeText(hovered.name);
  else if (isGarden)
    label = gardenLabel ?? local("记忆花园", "Memory Garden");
  else if (route.city)
    label = placeText((PLACES[route.place] ?? CITIES[route.city]).name);
  el("readout").textContent = label;
  if (pos) {
    const lat = pos[1].toFixed(3) + "°", lon = pos[0].toFixed(3) + "°";
    el("coordinates").textContent = local("北纬 " + lat + "  /  东经 " + lon, lat + " N  /  " + lon + " E");
  } else el("coordinates").textContent = "";
}
function legend(isGarden) {
  const values = isGarden ?
      [
        [ "featured", local("精选记忆", "Featured") ],
        [ "personal", local("个人记忆", "Personal") ],
        ...(route.place === "jiangdongmen" ? [ [ "archive", local("档案片段", "Archives") ] ] : []),
      ] :
      [
        [ "water", local("水系", "Water") ],
        [ "park", local("绿地", "Green space") ],
        [ "building", local("建筑", "Buildings") ],
      ];
  el("legend").replaceChildren(...values.map(([ kind, label ]) => {
    const span = document.createElement("span");
    span.className = kind;
    if (isGarden) span.style.setProperty("--specimen", 'url("' + new URL(profileURL(route.city), document.baseURI).href + '")');
    else span.style.setProperty("--dot", paper[kind]);
    span.textContent = label;
    return span;
  }));
}
function chrome() {
  const isGarden = route.level === "garden", city = CITIES[route.city], site = PLACES[route.place];
  const n = city?.places.length;
  const project = local("记忆之场", "Site of Memory"), gardenName = local("记忆花园", "Memory Garden");
  el("home-name").textContent = local("首页", "Home");
  el("landing-title").textContent = project;
  const intro = el("landing-intro");
  if (getLanguage() === "zh-CN") {
    intro.replaceChildren(...["一座城，一处记忆花园。", "独自探访，或与另一座城市的同学同行。"].map(words => {
      const phrase = document.createElement("span");
      phrase.textContent = words;
      return phrase;
    }));
  } else intro.textContent = "Explore a city through its memory gardens, on your own or with a student from another city.";
  document.querySelector('meta[name="description"]').content = intro.textContent;
  updateLandingHint();
  el("landing-scroll")
      .setAttribute("aria-label", local("滚动进入全国地图", "Scroll into the national atlas"));
  el("open-map").textContent = local("进入地图", "Enter map");
  document.querySelector(".home").setAttribute(
      "aria-label", local("返回项目首页", "Return to the opening"));
  el("trail").setAttribute("aria-label", local("当前位置", "Current location"));
  el("map").setAttribute("aria-label", local("可缩放的记忆地图", "Interactive memory atlas"));
  el("garden").setAttribute("aria-label", gardenName);
  for (const id of ["flow-language","sheet-language","invitation-language"]) {
    el(id).textContent = local("英文", "Chinese");
    el(id).setAttribute("aria-label", local("切换为英文", "Switch to Chinese"));
  }
  flowerBook.updateLanguage(getLanguage() === "zh-CN");
  exchange.labels();
  el("exchange-map-actions").hidden = !["city","place"].includes(route.level);
  el("exchange-city").textContent = local("双城互访","City exchanges");
  el("exchange-stop").textContent = local("加入共同行程","Add to itinerary");
  el("exchange-stop").hidden = route.level !== "place";
  el("nearby").setAttribute("aria-label", local("附近地点", "Nearby places"));
  document.querySelector(".north span").textContent = local("北", "N");
  if (el("notice").textContent) el("notice").textContent = savedMessage();
  el("folio").textContent = site ? placeText(city.name) + "  /  " +
          (isGarden ? local("记忆花园", "Memory Garden") : local("地点地图", "Local map")) :
      city ? local("城市地图", "City atlas") + "  /  " + local(n + " 处地点", n + " places") :
             local(
                 counts.cities + " 座城市  /  " + counts.places + " 处地点",
                 counts.cities + " cities  /  " + counts.places + " places");
  const heading = site ? placeText(site.name) : city ? placeText(city.name) : project;
  el("title").textContent = heading;
  const specimen = route.city;
  el("folio").style.setProperty("--specimen", specimen ? flowerBackground(specimen) : "none");
  if (site) el("arrival-flower").src = profileURL(specimen, "side");
  el("title").classList.toggle("long", heading.length > (getLanguage() === "en" ? 24 : 8));
  const arrival = route.level === "arrival";
  const tip = isGarden ? local("掠过枝叶可以起风。点花读往事，点「留下记忆」可留言，上滚回到题页。", "Brush the stems to stir a breeze. Pick a flower to read or choose Leave a memory to write. Scroll up for the prelude.") :
      arrival ? local("下滚进入花园，上滚回到地点。", "Scroll down into the garden or up to the place.") :
      site ? local("指向地点的花丛并下滚，进入它的花园题页。上滚返回城市。", "Point to this place’s flowers and scroll down for its garden prelude. Scroll up for the city.") :
      city ? local("指向想看的地点并下滚，上滚回到全国。", "Point to a place and scroll down to visit. Scroll up for the national map.") :
      local("指向一朵城市花并下滚，上滚回到首页。", "Point to a city flower and scroll down to explore. Scroll up for Home.");
  el("intro").textContent = site ? placeText(site.introduction) : tip;
  el("guide-tip").textContent = tip;
  const guide = local("地图导览、图例与来源", "Map guide, legend and sources");
  el("guide-toggle").setAttribute("aria-label", guide);
  el("guide-toggle").title = guide;
  el("legend").setAttribute("aria-label", local("图例", "Legend"));
  el("replay").hidden = arrival;
  el("replay").textContent = local("重看题页", "Replay title");
  el("dismiss-chapter").textContent = local("收起题页", "Hide title");
  el("stage").dataset.surface = isGarden ? "garden" : "atlas";
  el("stage").dataset.level = route.level;
  el("enter").hidden = route.level !== "place";
  el("enter").textContent = local("花园题页", "Garden prelude");
  el("write").textContent = local("留下记忆", "Leave a memory");
  const back = el("back");
  back.hidden = !(isGarden || arrival);
  if (!back.hidden) {
    back.href = flowHash(nextMapLevel(route, false));
    back.textContent = isGarden ? local("回到题页", "Back to prelude") : local("返回地点", "Back to place");
  }
  el("map-tools").hidden = isGarden || arrival;
  document.querySelector(".north").hidden = isGarden || arrival;
  el("credit-title").textContent = local("地图来源", "Map sources");
  el("natural-credit").textContent = local("自然地球地图数据", "Natural Earth");
  el("free-credit").textContent = local("开放自由地图", "OpenFreeMap");
  el("street-credit").textContent = local("© 开放街图贡献者", "© OpenStreetMap contributors");
  const target = el("level-target"), country = route.level === "country";
  target.hidden = !country && route.level !== "city";
  if (!target.hidden) {
    const prompt = country ? local("选择城市", "Choose a city") : local("选择地点", "Choose a place");
    const ids = country ? Object.keys(CITIES) : city.places;
    target.replaceChildren(new Option(prompt, ""), ...ids.map(id =>
      new Option(placeText((country ? CITIES : PLACES)[id].name), id)));
    target.setAttribute("aria-label", prompt);
  }
  el("zoom-out").disabled = false;
  for (const [id, label] of [["zoom-out", local("返回上一级", "Return one level")],
                             ["fit", local("地图居中", "Recenter map")]]) {
    el(id).title = label;
    el(id).setAttribute("aria-label", label);
  }
  el("arrival").toggleAttribute("data-error",failed);
  el("arrival-title").textContent =
      failed ? local("花园载入未完成", "The garden could not load") : gardenName;
  el("arrival-place").textContent = site ? placeText(city.name) + "  /  " + placeText(site.name) : "";
  el("arrival-note").textContent = site && !failed ? placeText(site.introduction) : "";
  el("skip").textContent = failed ? local("重试", "Retry") : local("进入花园", "Enter garden");
  el("arrival-back").hidden = !failed;
  el("arrival-back").textContent = local("返回地图", "Back to map");
  document.title = (site ? heading + " · " : "") + ((isGarden || arrival) ? gardenName : project) + " · " +
      local("流动地图", "Flow Atlas");
  trail();
  legend(isGarden || arrival);
  readout();
  if (isGarden)
    garden.updateLanguage();
  else
    atlas.invalidate();
}
let passage, paperFade;
function paintPassage(origin) {
  const flower = el("arrival-flower");
  if (quiet.matches) return;
  const rect = flower.getBoundingClientRect(), host = el("edition").getBoundingClientRect();
  const dx = origin ? host.x + host.width * origin[0] - rect.x - rect.width / 2 : 0;
  const dy = origin ? host.y + host.height * origin[1] - rect.y - rect.height / 2 : 18;
  passage = flower.animate([
    {transform: "translate(" + dx + "px," + dy + "px) scale(.20) rotate(-12deg)", opacity: .55},
    {transform: "none", opacity: 1}
  ], {duration: 1220, easing: "cubic-bezier(.2,.64,.24,1)"});
}
function closeTitle() {
  passage?.cancel();
  passage = null;
  paperFade?.cancel();
  paperFade = null;
  el("arrival").hidden = true;
  el("arrival").removeAttribute("aria-busy");
  el("skip").hidden = false;
  el("stage").inert = false;
}
function presentTitle(origin = null) {
  const page = el("arrival");
  const opacity = page.hidden ? 0 : Number(getComputedStyle(page).opacity);
  passage?.cancel();
  paperFade?.cancel();
  el("stage").inert = true;
  page.hidden = false;
  page.classList.remove("fading");
  if (!quiet.matches && opacity < 1)
    paperFade = page.animate([{opacity}, {opacity:1}],
      {duration:560*(1-opacity), easing:"cubic-bezier(.3,0,.28,1)"});
  paintPassage(origin);
  el("arrival-title").focus({preventScroll : true});
}
async function finishTitle(turn) {
  if (turn !== version)
    return;
  if (!quiet.matches) {
    const page = el("arrival");
    const opacity = Number(getComputedStyle(page).opacity);
    paperFade?.cancel();
    page.classList.add("fading");
    paperFade = page.animate([{opacity}, {opacity:0}],
      {duration:530*opacity, easing:"cubic-bezier(.34,0,.28,1)", fill:"forwards"});
    try { await paperFade.finished; } catch (error) { if (error.name !== "AbortError") throw error; }
  }
  if (turn === version) {
    closeTitle();
    garden.updateActions();
    el("garden").focus({preventScroll : true});
  }
}
async function show(next, {chapter = true, restore = false, focus = true, opening = false} = {}) {
  if (exchange.dialog.open) exchange.dialog.close();
  if (requestedFlower && (next.level !== "garden" || next.place !== requestedFlower.site)) requestedFlower = null;
  landing.close();
  const turn = ++version;
  const previous = route?.level;
  const wasTitle = !el("arrival").hidden;
  const enteringField = next.level === "garden", atTitle = next.level === "arrival";
  let origin = null;
  if (atTitle && atlas.active) {
    const pin = atlas.pins.get(next.place);
    if (pin && !pin.hidden) {
      const box = pin.getBoundingClientRect(), host = el("edition").getBoundingClientRect();
      origin = [(box.x+box.width/2-host.x)/host.width, (box.y+box.height/2-host.y)/host.height];
    }
  }
  if (route && atlas.active && atlas.w && flowHash(route) !== flowHash(next))
    visits.set(flowHash(route), atlas.snapshot());
  closeChapter();
  el("guide").open = false;
  if (!(wasTitle && (enteringField || atTitle))) closeTitle();
  clearTimeout(noticeTimer);
  el("notice").textContent = "";
  if (route?.level === "garden")
    garden.leave(!opening && !quiet.matches);
  route = next;
  flowerBook.destination(next.city, next.level === "city" && (!previous || previous === "country"));
  hovered = null;
  failed = false;
  setMode(atTitle || enteringField ? "garden" : opening ? "cover" : "map");
  if (!enteringField && !atTitle) {
    if (!garden.departure) garden.root.hidden = true;
    atlas.show(route, {
      restore : restore && !opening ? visits.get(flowHash(route)) : null,
      immediate : opening || turn === 1
    });
    if ((wasTitle || previous === "garden") && !quiet.matches)
      atlas.root.animate(
          [ {opacity:.4, transform:"translateY(-4vh)"}, {opacity:1, transform:"none"} ], {duration : 530, easing : "cubic-bezier(.2,.62,.28,1)"});
    chrome();
    if (opening && route.level === "country") {
      landing.open(focus && turn > 1);
      return;
    }
    if (route.level !== "country" && chapter && !restore && !flowerBook.pendingCity)
      playChapter();
    if (focus && turn > 1)
      (el("chapter").classList.contains("visible") ? el("title") : el("map")).focus({
        preventScroll : true
      });
    return;
  }
  atlas.hide(Boolean(origin));
  chrome();
  el("write").disabled = true;
  if (atTitle) {
    presentTitle(origin);
    void Promise.all([PLACES[route.place].loadCollection(), import("./gardenEvents.js"), prepareGardenPrints(route.city)]).catch(() => {});
    return;
  }
  // A cold deep link can wait on two flower files. Keep the place visible
  // while loading; an explicit arrival route remains a separate, held step.
  const loadingTitle = !wasTitle && setTimeout(() => {
    if (turn !== version) return;
    presentTitle();
    el("arrival").setAttribute("aria-busy","true");
    el("skip").hidden = true;
  }, 200);
  try {
    const [collection, {eventsForPlace}, prints] = await Promise.all([
      PLACES[next.place].loadCollection(), import("./gardenEvents.js"), prepareGardenPrints(next.city), store.ready
    ]);
    if (turn !== version) return;
    clearTimeout(loadingTitle);
    const titleVisible = !el("arrival").hidden;
    atlas.root.hidden = true;
    const directEntry = Boolean(requestedFlower?.write || requestedFlower?.record);
    garden.enter(next.place, collection, eventsForPlace(next.place), prints, titleVisible && !quiet.matches ? 240 : 0,directEntry);
    chrome();
    if (titleVisible) await finishTitle(turn);
    if (turn !== version) return;
    el("write").disabled = false;
    if (!titleVisible) garden.root.focus({preventScroll:true});
    openRequestedFlower();
  } catch {
    if (turn !== version) return;
    failed = true;
    el("arrival").removeAttribute("aria-busy");
    el("skip").hidden = false;
    chrome();
    presentTitle();
    el("skip").focus();
  } finally { clearTimeout(loadingTitle); }
}
el("skip").onclick = () => failed ? void show(route) : advance(true);
el("arrival-back").onclick = () => navigate({...route, level:"place"}, {restore:true});
el("dismiss-chapter").onclick = closeChapter;
el("guide").addEventListener("toggle", () => {
  if (el("guide").open) closeChapter();
  else garden.updateActions();
});
el("replay").onclick = () => {
  el("guide").open = false;
  if (route.level === "country") openLanding();
  else if (route.level === "garden") advance(false);
  else playChapter();
};
document.addEventListener("pointerdown", e => {
  if (!e.target.closest("#guide"))
    el("guide").open = false;
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || garden.invitation.dialog.open || garden.sheet.open || el("flower-book").open || exchange.dialog.open)
    return;
  if (el("guide").open) {
    el("guide").open = false;
    el("guide-toggle").focus();
    return;
  }
  if (!el("city-leaf").hidden) { el("leaf-close").click(); return; }
  if (route.level === "arrival") { advance(false); return; }
  closeChapter();
});
el("enter").onclick = () => {
  if (route.place)
    navigate({...route, level : "arrival"});
};
el("edition").addEventListener("click", e => {
  const a = e.target.closest(".home,.masthead a[href^=\"#\"],#back");
  if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  e.preventDefault();
  if (a.classList.contains("home")) {
    openLanding();
    return;
  }
  const next = readFlowRoute(a.hash);
  if (landing.active)
    landing.enter();
  if ((route.level === "garden" || route.level === "arrival") && history.state?.flowFrom === a.hash) {
    history.back();
    return;
  }
  navigate(next, {restore : true});
});
function changeLanguage() {
  const lang = getLanguage() === "en" ? "zh-CN" : "en";
  try {
    localStorage.setItem(languageKey, lang);
  } catch {
  }
  setLanguage(lang, {persist : false});
  atlas.closeNearby();
  chrome();
  exchange.updateLanguage();
}
for (const id of ["flow-language","sheet-language","invitation-language","book-language"]) el(id).onclick = changeLanguage;
window.addEventListener("popstate", () => {
  void show(readFlowRoute(location.hash), {restore : true, opening : !location.hash});
});
window.addEventListener("hashchange", () => {
  const next = readFlowRoute(location.hash);
  if (flowHash(route) !== flowHash(next))
    void show(next, {restore : true, opening : !location.hash});
});
// Navigation gestures stop at the field. A sheet owns its native scrolling.
document.addEventListener("wheel", event => {
  if (garden.invitation.dialog.open || garden.sheet.open || el("flower-book").open || exchange.dialog.open || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.defaultPrevented) return;
  const target = event.target;
  if (target.closest("#flower-book,#nearby,select,.guide-page,input,audio,video")) return;
  if (landing.active && !target.closest(".toolbar-shell")) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const delta = event.deltaY * unit * (event.ctrlKey ? -1 : 1);
  event.preventDefault();
  const onMap = !landing.active && ["country","city","place"].includes(route.level);
  const inward = delta > 0;
  const mark = onMap && target.closest("#map") ? atlas.targetAt(event).mark : null;
  if (onMap && inward && !mark) return;
  if (!atlas.wheel.consume(delta, event.timeStamp)) return;
  if (onMap) atlas.step(inward,mark);
  else advance(inward);
}, {passive:false});

// These surfaces pan, brush or change levels themselves. A native touch fling
// can otherwise consume the next tap on a flower, a grouped place or the invitation.
for (const id of ["map","arrival","garden","city-leaf"]) {
  el(id).addEventListener("touchmove", event => {
    if (event.cancelable && !event.target.closest("dialog")) event.preventDefault();
  }, {passive:false});
}

function gardenSwipe(surface) {
  let start;
  surface.addEventListener("pointerdown", e => {
    start = e.pointerType === "touch" && e.isPrimary ? {x:e.clientX,y:e.clientY,card:e.target.closest("#garden-invitation")} : null;
  });
  surface.addEventListener("pointercancel", () => { start = null; });
  surface.addEventListener("pointerup", e => {
    if (!start || e.pointerType !== "touch") return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, card = start.card;
    start = null;
    if (card) {
      if (Math.hypot(dx,dy)>16)
        card.addEventListener("click", suppressSwipeClick, {capture:true,once:true,signal:AbortSignal.timeout(380)});
      return;
    }
    if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      surface.addEventListener("click", suppressSwipeClick, {capture:true, once:true, signal:AbortSignal.timeout(380)});
      const from = route;
      requestAnimationFrame(() => { if (route === from) advance(dy < 0); });
    }
  });
}
function suppressSwipeClick(e) { e.preventDefault(); e.stopImmediatePropagation(); }
gardenSwipe(el("garden"));
gardenSwipe(el("arrival"));
gardenSwipe(el("city-leaf"));
document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || landing.active ||
      garden.invitation.dialog.open || garden.sheet.open || e.target.closest("dialog,select,input,textarea,.guide-page") || el("flower-book").open) return;
  if (!["PageDown","PageUp","ArrowDown","ArrowUp"].includes(e.key)) return;
  e.preventDefault();
  const inward = e.key === "PageDown" || e.key === "ArrowDown";
  if (["country","city","place"].includes(route.level)) atlas.step(inward,e.target.closest(".pin")?.mark);
  else advance(inward);
});
void show(readFlowRoute(location.hash), {focus : false, opening : !location.hash});
if (new URLSearchParams(location.search).has("flowers")) void flowerBook.open();

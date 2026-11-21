import "./style.css";
import {CITIES, PLACES, atlasHash, readAtlasRoute} from "../atlas/places.js";
import {getLanguage, placeText, setLanguage, LANGUAGE_STORAGE_KEY} from "../i18n/LanguageController.js";
import {FlowAtlas} from "./atlas.js";
import {paper} from "./FlowBasemap.js";
import {FlowGarden} from "./garden.js";
import {AtlasLanding} from "./landing.js";
import {nationalMarks} from "./overview.js";
import {nextMapLevel} from "./levels.js";
import {FlowerBook} from "./flowerBook.js";
import {plateURL, profileURL} from "./flowerForms.js";

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
let route, version = 0, holdTimer, releaseTitle, skipped = false, failed = false,
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
const remembered = {};
function setMode(mode) {
  el("edition").dataset.tools = mode;
  el("cover-book").hidden = mode !== "cover";
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
  navigate : r => navigate(r),
  step : (inward, mark) => advance(inward, mark),
  gesture : mapGesture,
  read : mark => {
    hovered = mark;
    if (mark)
      closeChapter();
    readout();
  },
  choose : chooseSite,
});
const landing = new AtlasLanding(el("landing"), atlas, () => {
  setMode("map");
  if (route?.level === "country" && !location.hash)
    history.pushState({flowFrom : "opening"}, "", "#atlas");
});
const flowerBook = new FlowerBook(el("flower-book"), open => {
  landing.flowers.obscured = open;
  landing.flowers.wake();
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
const savedMessage = () => local("已留在此处的花园，本次到访可回看。", "Saved in this garden for your visit.");
const garden = new FlowGarden({
  saved : () => {
    el("notice").textContent = savedMessage();
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el("notice").textContent = "", 4200);
  },
  readout : label => readout(label)
});

function advance(inward, mark) {
  if (landing.active) {
    if (inward) el("landing-cue").click();
    return;
  }
  if (route.level === "garden" && inward) {
    if (!el("arrival").hidden) { if (!failed) el("skip").click(); }
    else if (garden.id && !garden.sheet.open) garden.openEditor();
    return;
  }
  const next = nextMapLevel(route, inward, mark, remembered);
  if (!next) return;
  if (next.level === "opening") { openLanding(true); return; }
  navigate(next, {chapter:false, focus:false, restore:!inward});
}

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
}
function navigate(next, opts = {}) {
  if (route && atlasHash(route) === atlasHash(next)) {
    if (next.level !== "garden")
      atlas.recenter();
    return;
  }
  const state = {flowFrom : route ? atlasHash(route) : null};
  history.pushState(state, "", atlasHash(next));
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
    intro.replaceChildren(...["沿着地图走进记忆花园，", "读一段往事，", "也可以留下自己的记忆。"].map(words => {
      const phrase = document.createElement("span");
      phrase.textContent = words;
      return phrase;
    }));
  } else intro.textContent = "Follow the map into a memory garden to read a story or leave one of your own.";
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
  el("flow-language").textContent = el("sheet-language").textContent = local("英文", "Chinese");
  for (const b of [el("flow-language"), el("sheet-language")])
    b.setAttribute("aria-label", local("切换为英文", "Switch to Chinese"));
  flowerBook.updateLanguage(getLanguage() === "zh-CN");
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
  const tip = isGarden ? local("点花读记忆，下滚可留言，上滚回到地点。", "Select a flower to read. Scroll down to write or up to return to the place.") :
      site ? local("划过花丛拨动涟漪。下滚进入花园，上滚返回城市。", "Brush the flowers to stir their ripples. Scroll down into the garden or up to the city.") :
      city ? local("指向想看的地点并下滚，上滚回到全国。", "Point to a place and scroll down to visit. Scroll up for the national map.") :
      local("指向带地名的城市并下滚，上滚回到首页。", "Point to a labelled city and scroll down to explore. Scroll up for Home.");
  el("intro").textContent = site ? placeText(site.introduction) : tip;
  el("guide-tip").textContent = tip;
  const guide = local("地图导览、图例与来源", "Map guide, legend and sources");
  el("guide-toggle").setAttribute("aria-label", guide);
  el("guide-toggle").title = guide;
  el("legend").setAttribute("aria-label", local("图例", "Legend"));
  el("replay").textContent = local("重看题页", "Replay title");
  el("dismiss-chapter").textContent = local("收起题页", "Hide title");
  el("stage").dataset.surface = isGarden ? "garden" : "atlas";
  el("stage").dataset.level = route.level;
  el("enter").hidden = route.level !== "place";
  el("enter").textContent = local("进入花园 ↓", "Enter garden ↓");
  el("write").hidden = !isGarden;
  el("write").textContent = local("＋  留下记忆", "＋  Leave a memory");
  const back = el("back");
  back.hidden = !isGarden;
  if (isGarden) {
    back.href = atlasHash({...route, level : "place"});
    back.textContent = local("↑ 返回地点", "↑ Back to place");
  }
  el("map-tools").hidden = isGarden;
  document.querySelector(".north").hidden = isGarden;
  el("credit-title").textContent = local("地图来源", "Map sources");
  el("natural-credit").textContent = local("自然地球地图数据", "Natural Earth") + " ↗";
  el("free-credit").textContent = local("开放自由地图", "OpenFreeMap") + " ↗";
  el("street-credit").textContent = local("© 开放街图贡献者", "© OpenStreetMap contributors") + " ↗";
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
  clearTimeout(holdTimer);
  releaseTitle?.();
  releaseTitle = null;
  el("arrival").hidden = true;
  el("stage").inert = false;
}
function holdTitle(origin = null, replay = false) {
  el("stage").inert = true;
  el("arrival").hidden = false;
  el("arrival").classList.remove("fading");
  if (!quiet.matches)
    paperFade = el("arrival").animate(
        [ {opacity : 0}, {opacity : 1} ], {duration : 560, easing : "cubic-bezier(.3,0,.28,1)"});
  paintPassage(origin);
  el("arrival-title").focus({preventScroll : true});
  const readingTime = el("arrival-note").textContent.length * (getLanguage() === "en" ? 29 : 88);
  return new Promise(resolve => {
    releaseTitle = resolve;
    holdTimer = setTimeout(resolve, replay ? Math.min(5000, Math.max(2400, readingTime)) : 1240);
  });
}
async function finishTitle(turn) {
  if (turn !== version)
    return;
  if (!quiet.matches && !skipped) {
    el("arrival").classList.add("fading");
    await new Promise(resolve => setTimeout(resolve, 630));
  }
  if (turn === version) {
    closeTitle();
    el("garden").focus({preventScroll : true});
  }
}
async function show(next, {chapter = true, restore = false, focus = true, opening = false} = {}) {
  landing.close();
  const turn = ++version;
  const returning = route?.level === "garden" && next.level !== "garden";
  let origin = null;
  if (next.level === "garden" && route && route.level !== "garden") {
    const pin = atlas.pins.get(next.place);
    if (pin && !pin.hidden) {
      const box = pin.getBoundingClientRect(), host = el("edition").getBoundingClientRect();
      origin = [
        (box.x + box.width / 2 - host.x) / host.width, (box.y + box.height / 2 - host.y) / host.height
      ];
    }
  }
  if (route && route.level !== "garden" && atlas.w && atlasHash(route) !== atlasHash(next)) {
    visits.set(atlasHash(route), atlas.snapshot());
  }
  closeChapter();
  el("guide").open = false;
  closeTitle();
  clearTimeout(noticeTimer);
  el("notice").textContent = "";
  if (route?.level === "garden")
    garden.leave(returning && !opening && !quiet.matches);
  route = next;
  if (route.city) remembered.city = route.city;
  if (route.place) remembered[route.city] = route.place;
  hovered = null;
  skipped = false;
  failed = false;
  setMode(route.level === "garden" ? "garden" : opening ? "cover" : "map");
  if (route.level !== "garden") {
    if (!garden.departure) garden.root.hidden = true;
    atlas.show(route, {
      restore : restore && !opening ? visits.get(atlasHash(route)) : null,
      immediate : opening || turn === 1
    });
    if (returning && !quiet.matches)
      atlas.root.animate(
          [ {opacity:.4, transform:"translateY(-4vh)"}, {opacity:1, transform:"none"} ], {duration : 530, easing : "cubic-bezier(.2,.62,.28,1)"});
    chrome();
    if (opening && route.level === "country") {
      landing.open(focus && turn > 1);
      return;
    }
    if (route.level !== "country" && chapter && !restore)
      playChapter();
    if (focus && turn > 1)
      (el("chapter").classList.contains("visible") ? el("title") : el("map")).focus({
        preventScroll : true
      });
    return;
  }
  atlas.hide(!!origin);
  chrome();
  el("write").disabled = true;
  try {
    const [collection] = await Promise.all([ PLACES[route.place].loadCollection(), holdTitle(origin) ]);
    if (turn !== version)
      return;
    atlas.root.hidden = true;
    garden.enter(route.place, collection, !quiet.matches && !skipped ? 200 : 0);
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
  if (route.level === "country") {
    openLanding();
    return;
  }
  if (route.level !== "garden") {
    playChapter();
    return;
  }
  el("guide").open = false;
  skipped = false;
  const turn = version;
  await holdTitle(null, true);
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
    return;
  }
  closeChapter();
});
el("enter").onclick = () => {
  if (route.place)
    navigate({...route, level : "garden"});
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
  const next = readAtlasRoute(a.hash);
  if (landing.active)
    landing.enter();
  if (route.level === "garden" && next.level === "place" && history.state?.flowFrom === a.hash) {
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
}
el("flow-language").onclick = el("sheet-language").onclick = el("book-language").onclick = changeLanguage;
window.addEventListener("popstate", () => {
  void show(readAtlasRoute(location.hash), {restore : true, opening : !location.hash});
});
window.addEventListener("hashchange", () => {
  const next = readAtlasRoute(location.hash);
  if (atlasHash(route) !== atlasHash(next))
    void show(next, {restore : true, opening : !location.hash});
});
// All five surfaces share the wheel latch, including the arrival and the writing
// card, so inertial events from one gesture cannot carry on into the next room.
document.addEventListener("wheel", event => {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.defaultPrevented) return;
  const target = event.target;
  if (target.closest("#flower-book,#nearby,select,.guide-page,input,audio,video")) return;
  if (landing.active && !target.closest(".toolbar-shell")) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const delta = event.deltaY * unit * (event.ctrlKey ? -1 : 1);
  if (garden.sheet.open) {
    if (target.closest("textarea")?.scrollTop > 0) return;
    if (delta < 0 && garden.sheet.scrollTop <= 0 && atlas.wheel.consume(delta, event.timeStamp)) {
      event.preventDefault();
      garden.sheet.close();
    }
    return;
  }
  event.preventDefault();
  if (!atlas.wheel.consume(delta, event.timeStamp)) return;
  advance(delta > 0, target.closest("#map") ? atlas.destinationAt(event) : undefined);
}, {passive:false});

function gardenSwipe(surface) {
  let start;
  surface.addEventListener("pointerdown", e => {
    start = e.pointerType === "touch" && e.isPrimary ? [e.clientX, e.clientY] : null;
  });
  surface.addEventListener("pointercancel", () => { start = null; });
  surface.addEventListener("pointerup", e => {
    if (!start || e.pointerType !== "touch") return;
    const dx = e.clientX - start[0], dy = e.clientY - start[1];
    start = null;
    if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      surface.addEventListener("click", suppressSwipeClick, {capture:true, once:true, signal:AbortSignal.timeout(380)});
      advance(dy < 0);
    }
  });
}
function suppressSwipeClick(e) { e.preventDefault(); e.stopImmediatePropagation(); }
gardenSwipe(el("garden"));
gardenSwipe(el("arrival"));
// Keep native scrolling and text/media controls in the writing and reading cards.
let sheetTouch;
garden.sheet.addEventListener("touchstart", event => {
  const touch = event.touches[0];
  sheetTouch = event.touches.length === 1 && garden.sheet.scrollTop <= 0 &&
      !event.target.closest("textarea,input,button,audio,video") ? [touch.clientX,touch.clientY] : null;
}, {passive:true});
garden.sheet.addEventListener("touchcancel", () => { sheetTouch = null; });
garden.sheet.addEventListener("touchend", event => {
  if (!sheetTouch) return;
  const touch = event.changedTouches[0], dx = touch.clientX-sheetTouch[0], dy = touch.clientY-sheetTouch[1];
  sheetTouch = null;
  if (garden.sheet.scrollTop <= 0 && dy > 55 && dy > Math.abs(dx)*1.2) garden.sheet.close();
}, {passive:true});
document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || landing.active ||
      e.target.closest("dialog,select,input,textarea,.guide-page") || el("flower-book").open) return;
  if (!["PageDown","PageUp","ArrowDown","ArrowUp"].includes(e.key)) return;
  e.preventDefault();
  advance(e.key === "PageDown" || e.key === "ArrowDown", e.target.closest(".pin")?.mark);
});
void show(readAtlasRoute(location.hash), {focus : false, opening : !location.hash});
if (new URLSearchParams(location.search).has("flowers")) void flowerBook.open();

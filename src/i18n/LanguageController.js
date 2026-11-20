import { recordChineseText } from "../data/placeRecords.js";
import { PLACES } from "../atlas/places.js";

export const LANGUAGES = Object.freeze({
  ENGLISH: "en",
  CHINESE: "zh-CN",
});

export const LANGUAGE_STORAGE_KEY = "memory-garden-language-v1";

const TRANSLATIONS = Object.freeze({
  [LANGUAGES.ENGLISH]: Object.freeze({
    "document.title": "Site of Memory · Memory Atlas",
    "document.description":
      "Explore a memory atlas of five Chinese cities. Discover local places, read their records and leave a memory.",
    "app.aria": "Site of Memory",
    "scene.aria": "Memory field. Touch a flower to read it, drag to grow flowers, or press Enter to discover a memory.",
    "atlas.wordmark": "Site of Memory",
    "atlas.titleFirst": "Site of",
    "atlas.titleSecond": "Memory",
    "atlas.navigation": "Map location",
    "atlas.mapAria": "Interactive geographic map",
    "atlas.china": "China",
    "atlas.nanjing": "Nanjing",
    "atlas.jiangsu": "Jiangsu province",
    "atlas.jiangdongmen": "Jiangdongmen",
    "atlas.jianye": "Jianye District",
    "atlas.countryKicker": "China · A geographic collection",
    "atlas.cityKicker": "Jiangsu · China",
    "atlas.placeKicker": "Jianye · Nanjing",
    "atlas.countryIntro": "Choose a city to explore its gardens, streets and places of remembrance.",
    "atlas.cityIntro": "From the Qinhuai River to Purple Mountain, follow the sites where the city keeps its memories.",
    "atlas.placeIntro": "Among the Zijincao flowers, encounter memories of the memorial hall and of everyday life in Jiangdongmen.",
    "atlas.cities": "Explore a city",
    "atlas.places": "Places in Nanjing",
    "atlas.enter": "Enter the garden",
    "atlas.flower": "Zijincao flower garden",
    "atlas.directory": "Place index",
    "atlas.cityIndex": "City index",
    "atlas.overviewCount": "{cities} cities · {places} places",
    "atlas.placeCount": "{count} places",
    "atlas.cluster": "Zoom into {count} nearby places",
    "atlas.previous": "Previous places",
    "atlas.next": "Next places",
    "memory.mapNote": "MAP NOTE",
    "atlas.placesIn": "Places in {city}",
    "atlas.garden": "Memory garden",
    "atlas.source": "About this place ↗",
    "atlas.locations": "{count} open gardens",
    "atlas.at": "At this location",
    "atlas.legend": "Location with an open garden",
    "atlas.credits": "Map sources",
    "atlas.zoomIn": "Zoom in",
    "atlas.zoomOut": "Zoom out",
    "atlas.fit": "Recenter map on this location",
    "garden.aria": "Jiangdongmen memory garden",
    "garden.location": "NANJING · JIANGDONGMEN",
    "garden.back": "Back to map",
    "garden.write": "Leave a memory",
    "garden.memoryFormats": "Text · Image · Audio · Video",
    "garden.loading": "Opening the garden…",
    "garden.title": "Memory Garden",
    "garden.skip": "Skip introduction",
    "brand.eyebrow": "INTERACTIVE MEMORY GARDEN",
    "brand.title": "SITE OF MEMORY",
    "brand.subtitle": "MEMORY BLOOMS",
    "status.aria": "System status",
    "status.flowerLoading": "FLOWER ASSET · LOADING",
    "status.inputWaiting": "GAZE INPUT · WAITING",
    "status.inputReady": "GAZE INPUT · READY",
    "status.inputActive": "GAZE INPUT · READY",
    "status.flowerLimit": "FLOWER LIMIT · REACHED",
    "audio.controlsAria": "Sound controls",
    "audio.soundOff": "SOUND OFF",
    "audio.soundOn": "SOUND ON",
    "audio.ambience": "AMBIENCE",
    "audio.ambienceAria": "Ambience volume",
    "audio.ambienceValue": "Ambience {percent}%",
    "guide.main": "Touch a flower to read its memory. Drag to grow more.",
    "field.aria": "Field data",
    "field.memories": "MEMORIES",
    "field.render": "RENDER",
    "field.asset": "ASSET",
    "field.renderMode": "INSTANCED",
    "field.assetLoading": "LOADING",
    "field.assetMode": "PNG · 5 VARIANTS",
    "field.reset": "RESET FIELD",
    "entry.index": "NANJING · JIANGDONGMEN",
    "entry.title": "What do you remember of this place?",
    "entry.descriptionLine1":
      "A visit to the memorial hall, a familiar street, or an ordinary afternoon in Jiangdongmen.",
    "entry.descriptionLine2":
      "Text and attachments stay here for this visit and clear on reload.",
    "entry.inputLabel": "Write your memory",
    "entry.placeholder":
      "I remember…",
    "entry.cancel": "Return to the garden",
    "entry.submit": "Leave this memory in the field",
    "entry.save": "Save for this visit",
    "entry.placeTitle": "What do you remember of {place}?",
    "entry.saved": "Your memory is saved here for this visit.",
    "attachment.add": "Add an attachment",
    "attachment.replace": "Replace attachment",
    "attachment.hint": "Choose one · Words are optional",
    "attachment.action": "Choose {kind} file",
    "attachment.replaceAction": "Replace {kind} file",
    "attachment.image": "Image",
    "attachment.audio": "Audio",
    "attachment.video": "Video",
    "attachment.text": "Text",
    "attachment.remove": "Remove",
    "attachment.loading": "Opening {name}…",
    "attachment.invalid": "This file doesn’t match the {kind} option.",
    "attachment.unreadable": "This file couldn’t be opened. Try another file.",
    "attachment.visit": "Your memories here ({count})",
    "attachment.back": "Back to writing",
    "memory.heritage": "SHARED HERITAGE",
    "memory.prompt": "PERSONAL MEMORY · WRITING PROMPT",
    "fatal.title": "THE FIELD COULD NOT OPEN",
    "fatal.description":
      "Check that this browser supports WebGL, then refresh the page.",
    "language.switchLabel": "中文",
    "language.switchAria": "Switch to Chinese",
    "memory.your": "YOUR MEMORY",
    "memory.historical": "HISTORICAL RECORD",
    "memory.public": "PUBLIC REMEMBRANCE",
    "memory.example": "ILLUSTRATIVE MEMORY",
    "memory.visitor": "VISITOR MEMORY",
    "memory.echo": "MEMORY · {number}",
    "memory.archiveImage": "ARCHIVE IMAGE · {number}",
    "memory.archiveVoice": "ARCHIVE VOICE",
    "memory.verified": "VERIFIED MEMORY · {number}",
    "memory.default": "MEMORY",
    "memory.unavailable": "MEMORY UNAVAILABLE",
    "memory.imageUnavailable": "IMAGE UNAVAILABLE",
    "memory.archiveImageAlt": "Archive image",
    "memory.location": "LOCATION",
    "memory.date": "DATE",
    "memory.source": "SOURCE",
    "memory.imageSource": "IMAGE SOURCE",
    "memory.audioSource": "AUDIO SOURCE",
    "memory.audio": "AUDIO",
    "memory.duration": "DURATION",
    "memory.archiveAudioAria": "Archive audio: {label}",
  }),
  [LANGUAGES.CHINESE]: Object.freeze({
    "document.title": "记忆之场 · 记忆地图",
    "document.description": "从五座城市进入记忆地图，发现当地的街巷、园林和纪念场所，留下自己的记忆。",
    "app.aria": "记忆之场",
    "scene.aria": "触碰花簇可阅读记忆，拖动可让更多花朵生长，也可以按回车键探索记忆。",
    "atlas.wordmark": "记忆之场",
    "atlas.titleFirst": "记忆",
    "atlas.titleSecond": "之场",
    "atlas.navigation": "地图位置",
    "atlas.mapAria": "可缩放的地理地图",
    "atlas.china": "中国",
    "atlas.nanjing": "南京",
    "atlas.jiangsu": "江苏省",
    "atlas.jiangdongmen": "江东门",
    "atlas.jianye": "建邺区",
    "atlas.countryKicker": "中国 · 地点图集",
    "atlas.cityKicker": "中国 · 江苏",
    "atlas.placeKicker": "南京 · 建邺",
    "atlas.countryIntro": "选择一座城市，循着地图走进它的街巷、园林与纪念之地。",
    "atlas.cityIntro": "从秦淮河畔到紫金山麓，走进南京留下记忆的地方。",
    "atlas.placeIntro": "走进紫金草花丛，读一段与纪念馆有关的往事，也听听人们在江东门生活的记忆。",
    "atlas.cities": "选择城市",
    "atlas.places": "南京的记忆地点",
    "atlas.enter": "进入花园",
    "atlas.flower": "紫金草记忆花园",
    "atlas.directory": "地点索引",
    "atlas.cityIndex": "城市索引",
    "atlas.overviewCount": "{cities} 座城市 · {places} 处地点",
    "atlas.placeCount": "{count} 处地点",
    "atlas.cluster": "放大查看附近 {count} 处地点",
    "atlas.previous": "上一组地点",
    "atlas.next": "下一组地点",
    "memory.mapNote": "地理坐标",
    "atlas.placesIn": "{city}的记忆地点",
    "atlas.garden": "地点记忆花园",
    "atlas.source": "地点资料出处 ↗",
    "atlas.locations": "{count} 处开放花园",
    "atlas.at": "此处坐标",
    "atlas.legend": "已开放花园的地点",
    "atlas.credits": "地图来源",
    "atlas.zoomIn": "放大地图",
    "atlas.zoomOut": "缩小地图",
    "atlas.fit": "将地图移回当前位置",
    "garden.aria": "江东门记忆花园",
    "garden.location": "南京 · 江东门",
    "garden.back": "返回地图",
    "garden.write": "留下记忆",
    "garden.memoryFormats": "文字 · 图片 · 音频 · 视频",
    "garden.loading": "正在打开花园…",
    "garden.title": "记忆花园",
    "garden.skip": "跳过过场",
    "brand.eyebrow": "互动记忆花园",
    "brand.title": "记忆之场",
    "brand.subtitle": "记忆绽放",
    "status.aria": "系统状态",
    "status.flowerLoading": "花朵素材 · 加载中",
    "status.inputWaiting": "凝视输入 · 等待中",
    "status.inputReady": "凝视输入 · 已就绪",
    "status.inputActive": "凝视输入 · 已就绪",
    "status.flowerLimit": "花田容量 · 已满",
    "audio.controlsAria": "声音控制",
    "audio.soundOff": "声音 · 关闭",
    "audio.soundOn": "声音 · 开启",
    "audio.ambience": "环境声",
    "audio.ambienceAria": "环境声音量",
    "audio.ambienceValue": "环境声 {percent}%",
    "guide.main": "轻触花簇阅读记忆，拖动让更多花朵生长。",
    "field.aria": "花田数据",
    "field.memories": "记忆",
    "field.render": "渲染",
    "field.asset": "素材",
    "field.renderMode": "实例化",
    "field.assetLoading": "加载中",
    "field.assetMode": "PNG · 5 种",
    "field.reset": "重置花田",
    "entry.index": "南京 · 江东门",
    "entry.title": "关于江东门，你记得什么？",
    "entry.descriptionLine1": "可以是一次参观纪念馆的经历、一条熟悉的街，或是在江东门度过的一个寻常午后。",
    "entry.descriptionLine2": "文字和附件仅在本次访问中可见，刷新后清除。",
    "entry.inputLabel": "写下你的记忆",
    "entry.placeholder":
      "我记得……",
    "entry.cancel": "回到花园",
    "entry.submit": "将这段记忆留在花田",
    "entry.save": "保存本次留言",
    "entry.placeTitle": "关于{place}，\n你记得什么？",
    "entry.saved": "这段记忆已留在这里，本次访问可见。",
    "attachment.add": "添加附件",
    "attachment.replace": "更换附件",
    "attachment.hint": "任选一种，也可不写文字",
    "attachment.action": "选择{kind}文件",
    "attachment.replaceAction": "更换{kind}文件",
    "attachment.image": "图片",
    "attachment.audio": "音频",
    "attachment.video": "视频",
    "attachment.text": "文字",
    "attachment.remove": "移除",
    "attachment.loading": "正在打开「{name}」……",
    "attachment.invalid": "请选择一个{kind}文件。",
    "attachment.unreadable": "未能打开这份文件，请换一份再试。",
    "attachment.visit": "我在这里留下的记忆（{count}）",
    "attachment.back": "返回书写",
    "memory.heritage": "公共记忆",
    "memory.prompt": "个人记忆 · 书写提示",
    "fatal.title": "花田暂时无法打开",
    "fatal.description": "请确认浏览器支持 WebGL，然后刷新页面。",
    "language.switchLabel": "EN",
    "language.switchAria": "切换至英文",
    "memory.your": "你的记忆",
    "memory.historical": "历史资料",
    "memory.public": "公共纪念",
    "memory.example": "示例留言",
    "memory.visitor": "访客记忆",
    "memory.echo": "记忆 · {number}",
    "memory.archiveImage": "档案图像 · {number}",
    "memory.archiveVoice": "档案声音",
    "memory.verified": "已核实记忆 · {number}",
    "memory.default": "记忆",
    "memory.unavailable": "记忆暂不可用",
    "memory.imageUnavailable": "图像暂不可用",
    "memory.archiveImageAlt": "档案图像",
    "memory.location": "地点",
    "memory.date": "日期",
    "memory.source": "来源",
    "memory.imageSource": "图像来源",
    "memory.audioSource": "声音来源",
    "memory.audio": "声音",
    "memory.duration": "时长",
    "memory.archiveAudioAria": "档案声音：{label}",
  }),
});

const MEMORY_TEXT_TRANSLATIONS = Object.freeze({
  ...recordChineseText,
  ...Object.fromEntries(Object.entries(PLACES).filter(([,p]) => Array.isArray(p.prompt)).map(([id,p]) => [id + "-prompt", p.prompt[0]])),
  "jiangdongmen-opening": "1985年8月15日，位于江东门的侵华日军南京大屠杀遇难同胞纪念馆向公众开放。",
  "jiangdongmen-documents": "联合国教科文组织《世界记忆名录》收录的南京大屠杀档案，既有1937至1938年的记录，也有战后调查与审判的文件。",
  "prototype-rain":
    "纪念馆外的石阶上落着雨。我们走在其中，每一步似乎都慢了下来。",
  "prototype-wind":
    "离开展厅时，一阵风从城墙方向吹来，翻动了我手中的书页。",
  "prototype-classroom":
    "我第一次听见“江东门”这个名字，是在一间安静的历史教室里。",
  "prototype-silence":
    "那天我们没有说太多。离开之前，我记得自己又回头看了一次。",
});

let currentLanguage = LANGUAGES.ENGLISH;
const listeners = new Set();

function normalizeLanguage(language) {
  return language === LANGUAGES.CHINESE || language === "zh"
    ? LANGUAGES.CHINESE
    : LANGUAGES.ENGLISH;
}

function replaceParameters(message, parameters) {
  return Object.entries(parameters).reduce(
    (resolved, [name, value]) =>
      resolved.replaceAll(`{${name}}`, String(value)),
    message,
  );
}

export function translate(
  key,
  parameters = {},
  language = currentLanguage,
) {
  const normalizedLanguage = normalizeLanguage(language);
  const message =
    TRANSLATIONS[normalizedLanguage]?.[key] ??
    TRANSLATIONS[LANGUAGES.ENGLISH]?.[key] ??
    key;
  return replaceParameters(message, parameters);
}

export const t = translate;

// Place catalogue copy is held beside its coordinates. Interface keys use the normal registry.
export function placeText(value, language = currentLanguage) {
  return Array.isArray(value) ? value[normalizeLanguage(language) === LANGUAGES.CHINESE ? 0 : 1] : translate(value, {}, language);
}

export function getLanguage() {
  return currentLanguage;
}

export function getLocalizedMemoryText(memory, language = currentLanguage) {
  if (normalizeLanguage(language) !== LANGUAGES.CHINESE) {
    return memory?.text ?? memory?.caption ?? translate(
      "memory.unavailable",
      {},
      language,
    );
  }
  return (
    MEMORY_TEXT_TRANSLATIONS[memory?.id] ??
    memory?.text ??
    memory?.caption ??
    translate("memory.unavailable", {}, language)
  );
}

function queryLocalizedElements(root, attribute) {
  const elements = [];
  if (root?.matches?.(`[${attribute}]`)) {
    elements.push(root);
  }
  root?.querySelectorAll?.(`[${attribute}]`).forEach((element) => {
    elements.push(element);
  });
  return elements;
}

export function localizeDocument(root = globalThis.document) {
  if (!root) {
    return;
  }

  queryLocalizedElements(root, "data-i18n").forEach((element) => {
    element.textContent = translate(element.dataset.i18n);
  });
  for (const [attribute, targetAttribute] of [
    ["data-i18n-aria-label", "aria-label"],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-content", "content"],
  ]) {
    queryLocalizedElements(root, attribute).forEach((element) => {
      const key = element.getAttribute(attribute);
      element.setAttribute(targetAttribute, translate(key));
    });
  }

  const documentRef = root.nodeType === 9 ? root : root.ownerDocument;
  if (documentRef?.documentElement) {
    documentRef.documentElement.lang = currentLanguage;
    documentRef.body?.setAttribute("data-language", currentLanguage);
  }
}

export function setLanguage(language, { persist = true } = {}) {
  currentLanguage = normalizeLanguage(language);
  localizeDocument();

  if (persist) {
    try {
      globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch {
      // Language persistence is optional; switching still works for this page.
    }
  }

  listeners.forEach((listener) => listener(currentLanguage));
  return currentLanguage;
}

export function subscribeLanguage(listener, { immediate = false } = {}) {
  listeners.add(listener);
  if (immediate) {
    listener(currentLanguage);
  }
  return () => listeners.delete(listener);
}

function readStoredLanguage() {
  try {
    return globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function createLanguageController({
  button = globalThis.document?.querySelector?.("#language-toggle") ?? null,
} = {}) {
  const handleToggle = () => {
    setLanguage(
      currentLanguage === LANGUAGES.ENGLISH
        ? LANGUAGES.CHINESE
        : LANGUAGES.ENGLISH,
    );
  };

  return Object.freeze({
    start() {
      button?.addEventListener("click", handleToggle);
      setLanguage(readStoredLanguage() ?? LANGUAGES.ENGLISH, {
        persist: false,
      });
      return this;
    },
    destroy() {
      button?.removeEventListener("click", handleToggle);
    },
    setLanguage,
    get language() {
      return currentLanguage;
    },
  });
}

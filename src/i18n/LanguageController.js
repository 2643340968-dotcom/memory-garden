export const LANGUAGES = Object.freeze({
  ENGLISH: "en",
  CHINESE: "zh-CN",
});

export const LANGUAGE_STORAGE_KEY = "memory-garden-language-v1";

const TRANSLATIONS = Object.freeze({
  [LANGUAGES.ENGLISH]: Object.freeze({
    "document.title": "Site of Memory · Memory Blooms",
    "document.description":
      "An interactive site where attention lets flowers and memories bloom.",
    "app.aria": "Site of Memory interactive garden",
    "scene.aria": "Interactive Three.js memory field",
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
    "guide.main": "GAZE TO LET MEMORIES BLOOM",
    "field.aria": "Field data",
    "field.memories": "MEMORIES",
    "field.render": "RENDER",
    "field.asset": "ASSET",
    "field.renderMode": "INSTANCED",
    "field.assetLoading": "LOADING",
    "field.assetMode": "PNG · 5 VARIANTS",
    "field.reset": "RESET FIELD",
    "entry.index": "MEMORY ARCHIVE · 001",
    "entry.title": "Leave a memory you wish to preserve",
    "entry.descriptionLine1":
      "A memory of the Nanjing Massacre, Jiangdongmen,",
    "entry.descriptionLine2":
      "or a moment that connects you to this place.",
    "entry.inputLabel": "Write your memory",
    "entry.placeholder":
      "It can be a sentence, a place,\na sound, or the moment you first encountered this history.",
    "entry.submit": "Leave this memory in the field",
    "fatal.title": "THE FIELD COULD NOT OPEN",
    "fatal.description":
      "Check that this browser supports WebGL, then refresh the page.",
    "language.switchLabel": "中文",
    "language.switchAria": "Switch to Chinese",
    "memory.your": "YOUR MEMORY",
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
    "document.title": "记忆之场 · 记忆绽放",
    "document.description": "一个让记忆与紫金草在凝视中生长的互动空间。",
    "app.aria": "记忆之场互动花园",
    "scene.aria": "Three.js 互动记忆花田",
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
    "guide.main": "凝视，让记忆在此绽放",
    "field.aria": "花田数据",
    "field.memories": "记忆",
    "field.render": "渲染",
    "field.asset": "素材",
    "field.renderMode": "实例化",
    "field.assetLoading": "加载中",
    "field.assetMode": "PNG · 5 种",
    "field.reset": "重置花田",
    "entry.index": "记忆档案 · 001",
    "entry.title": "留下一段你愿意保存的记忆",
    "entry.descriptionLine1": "关于南京大屠杀、江东门的一段记忆，",
    "entry.descriptionLine2": "或一个让你与这里产生联系的时刻。",
    "entry.inputLabel": "写下你的记忆",
    "entry.placeholder":
      "可以是一句话、一个地点、\n一种声音，或你初次遇见这段历史的时刻。",
    "entry.submit": "将这段记忆留在花田",
    "fatal.title": "花田暂时无法打开",
    "fatal.description": "请确认浏览器支持 WebGL，然后刷新页面。",
    "language.switchLabel": "EN",
    "language.switchAria": "切换至英文",
    "memory.your": "你的记忆",
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

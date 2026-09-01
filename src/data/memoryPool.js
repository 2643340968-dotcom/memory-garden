export const MEMORY_TYPES = Object.freeze({
  TEXT: "text",
  IMAGE: "image",
});

export const MEMORY_SELECTION_CONFIG = Object.freeze({
  AUDIO_MEMORY_COOLDOWN_EVENTS: 2,
  AUDIO_MEMORY_SELECTION_PROBABILITY: 0.18,
});

export const MEMORY_ITEM_SCHEMA_FIELDS = Object.freeze([
  "id",
  "type",
  "kind",
  "label",
  "text",
  "image",
  "caption",
  "date",
  "location",
  "source",
  "sourceUrl",
  "audio",
  "audioId",
  "audioType",
  "audioCaption",
  "audioSource",
  "audioSourceUrl",
  "isQuote",
  "verified",
  "isPrototype",
]);

export function hasMemoryAudio(memory) {
  return Boolean(memory?.audio);
}

export function createMemoryItem({
  id,
  type = null,
  kind = "prototype",
  label = "GARDEN MEMORY · PROTOTYPE",
  text = null,
  image = null,
  caption = null,
  date = null,
  location = null,
  source = null,
  sourceUrl = null,
  audio = null,
  audioId = null,
  audioType = null,
  audioCaption = null,
  audioSource = null,
  audioSourceUrl = null,
  isQuote = false,
  verified = false,
  isPrototype = kind === "prototype",
}) {
  const resolvedType = type ?? (image ? MEMORY_TYPES.IMAGE : MEMORY_TYPES.TEXT);
  if (!Object.values(MEMORY_TYPES).includes(resolvedType)) {
    throw new TypeError(`Unsupported memory type: ${resolvedType}`);
  }
  if (verified && isPrototype) {
    throw new TypeError("A memory cannot be both verified and a prototype.");
  }

  return Object.freeze({
    id,
    type: resolvedType,
    kind,
    label,
    text,
    image,
    caption,
    date,
    location,
    source,
    sourceUrl,
    audio,
    audioId,
    audioType,
    audioCaption,
    audioSource,
    audioSourceUrl,
    isQuote: Boolean(isQuote),
    verified: Boolean(verified),
    isPrototype: Boolean(isPrototype),
  });
}

const PROTOTYPE_MEMORIES = Object.freeze([
  createMemoryItem({
    id: "prototype-rain",
    text: "雨落在纪念馆外的石阶上，周围的脚步声慢了下来。",
    isQuote: true,
  }),
  createMemoryItem({
    id: "prototype-wind",
    text: "走出展厅时，风从城墙的方向吹来，手里的纸页轻轻作响。",
    isQuote: true,
  }),
  createMemoryItem({
    id: "prototype-classroom",
    text: "第一次听见“江东门”这个名字，是在一堂安静的历史课上。",
    isQuote: true,
  }),
  createMemoryItem({
    id: "prototype-silence",
    text: "那天没有说很多话，只记得离开前又回头看了一次。",
    isQuote: true,
  }),
  createMemoryItem({
    id: "prototype-archive-jiangdongmen",
    type: MEMORY_TYPES.IMAGE,
    image: "./assets/memories/archive-placeholder-01.svg",
    caption: "江东门影像档案 · 待补充",
    location: "南京 · 江东门",
    source: "ARCHIVE PLACEHOLDER",
  }),
  createMemoryItem({
    id: "prototype-archive-memorial",
    type: MEMORY_TYPES.IMAGE,
    image: "./assets/memories/archive-placeholder-02.svg",
    caption: "纪念空间影像档案 · 待补充",
    location: "南京",
    source: "ARCHIVE PLACEHOLDER",
  }),
]);

function clampRandom(random) {
  return Math.max(0, Math.min(0.999999, random()));
}

function selectFromCandidates(candidates, random) {
  if (candidates.length === 0) {
    return null;
  }
  return candidates[Math.floor(clampRandom(random) * candidates.length)] ?? null;
}

export function createMemoryPool({
  prototypeMemories = PROTOTYPE_MEMORIES,
  selectionConfig = MEMORY_SELECTION_CONFIG,
} = {}) {
  const sessionMemories = [];
  const sourceMemories = Object.freeze([...prototypeMemories]);
  let sessionMemorySequence = 0;
  let lastSelectedId = null;
  let audioCooldownRemaining = 0;

  function addSessionMemory(rawText) {
    const text = String(rawText ?? "").trim();
    if (!text) {
      throw new TypeError("A memory cannot be empty.");
    }

    sessionMemorySequence += 1;
    const memory = createMemoryItem({
      id: `session-memory-${sessionMemorySequence}`,
      type: MEMORY_TYPES.TEXT,
      kind: "session",
      label: "YOUR MEMORY",
      text,
      isQuote: true,
      isPrototype: false,
    });
    sessionMemories.push(memory);
    return memory;
  }

  function getById(memoryId) {
    return (
      sessionMemories.find((memory) => memory.id === memoryId) ??
      sourceMemories.find((memory) => memory.id === memoryId) ??
      null
    );
  }

  function selectEcho(random = Math.random) {
    const allMemories = [...sessionMemories, ...sourceMemories];
    const candidates =
      allMemories.length > 1
        ? allMemories.filter((memory) => memory.id !== lastSelectedId)
        : allMemories;
    const audioCandidates = candidates.filter(hasMemoryAudio);
    const silentCandidates = candidates.filter((memory) => !hasMemoryAudio(memory));

    let eligibleCandidates = candidates;
    if (audioCooldownRemaining > 0) {
      eligibleCandidates = silentCandidates;
    } else if (audioCandidates.length > 0 && silentCandidates.length > 0) {
      const chooseAudio =
        clampRandom(random) < selectionConfig.AUDIO_MEMORY_SELECTION_PROBABILITY;
      eligibleCandidates = chooseAudio ? audioCandidates : silentCandidates;
    }

    const selected = selectFromCandidates(eligibleCandidates, random);
    if (!selected) {
      return null;
    }

    if (hasMemoryAudio(selected)) {
      audioCooldownRemaining = selectionConfig.AUDIO_MEMORY_COOLDOWN_EVENTS;
    } else {
      audioCooldownRemaining = Math.max(0, audioCooldownRemaining - 1);
    }
    lastSelectedId = selected.id;
    return selected;
  }

  function resetSelection() {
    lastSelectedId = null;
    audioCooldownRemaining = 0;
  }

  return Object.freeze({
    sessionMemories,
    prototypeMemories: sourceMemories,
    addSessionMemory,
    getById,
    selectEcho,
    resetSelection,
    get selectionState() {
      return Object.freeze({ lastSelectedId, audioCooldownRemaining });
    },
  });
}

export { PROTOTYPE_MEMORIES };

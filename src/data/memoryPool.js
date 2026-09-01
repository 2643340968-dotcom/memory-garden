export const MEMORY_TYPES = Object.freeze({
  TEXT: "text",
  IMAGE: "image",
  AUDIO: "audio",
});

export const MEMORY_KINDS = Object.freeze({
  TEXT_MEMORY: "TEXT_MEMORY",
  IMAGE_ARCHIVE: "IMAGE_ARCHIVE",
  AUDIO_ARCHIVE: "AUDIO_ARCHIVE",
  PAIRED_MEMORY: "PAIRED_MEMORY",
});

export const MEMORY_RELATIONSHIPS = Object.freeze({
  INDEPENDENT: "independent",
  VERIFIED_PAIR: "verified-pair",
});

export const MEMORY_SELECTION_CONFIG = Object.freeze({
  AUDIO_ARCHIVE_PROBABILITY: 0.12,
  AUDIO_ARCHIVE_COOLDOWN_EVENTS: 2,
  MIN_EVENTS_BETWEEN_AUDIO: 2,
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
  "relationship",
]);

export function hasMemoryAudio(memory) {
  return Boolean(memory?.audio);
}

export function isAudioPresentation(memory) {
  return (
    memory?.kind === MEMORY_KINDS.AUDIO_ARCHIVE ||
    (memory?.kind === MEMORY_KINDS.PAIRED_MEMORY && hasMemoryAudio(memory))
  );
}

function inferIndependentKind({ text, image, audio }) {
  const populatedMedia = [text, image, audio].filter(Boolean).length;
  if (populatedMedia > 1) {
    throw new TypeError(
      "Multiple media fields require an explicit verified PAIRED_MEMORY relationship.",
    );
  }
  if (image) {
    return MEMORY_KINDS.IMAGE_ARCHIVE;
  }
  if (audio) {
    return MEMORY_KINDS.AUDIO_ARCHIVE;
  }
  return MEMORY_KINDS.TEXT_MEMORY;
}

function getTypeForKind(kind, { text, image }) {
  if (kind === MEMORY_KINDS.IMAGE_ARCHIVE) {
    return MEMORY_TYPES.IMAGE;
  }
  if (kind === MEMORY_KINDS.AUDIO_ARCHIVE) {
    return MEMORY_TYPES.AUDIO;
  }
  if (kind === MEMORY_KINDS.PAIRED_MEMORY) {
    return image
      ? MEMORY_TYPES.IMAGE
      : text
        ? MEMORY_TYPES.TEXT
        : MEMORY_TYPES.AUDIO;
  }
  return MEMORY_TYPES.TEXT;
}

function getDefaultLabel(kind, isPrototype) {
  const suffix = isPrototype ? " · PROTOTYPE" : "";
  if (kind === MEMORY_KINDS.IMAGE_ARCHIVE) {
    return `ARCHIVE IMAGE${suffix}`;
  }
  if (kind === MEMORY_KINDS.AUDIO_ARCHIVE) {
    return `ARCHIVE VOICE${suffix}`;
  }
  if (kind === MEMORY_KINDS.PAIRED_MEMORY) {
    return "VERIFIED MEMORY";
  }
  return `GARDEN MEMORY${suffix}`;
}

function validateIndependentMedia(kind, { text, image, audio }) {
  if (kind === MEMORY_KINDS.TEXT_MEMORY && (image || audio)) {
    throw new TypeError("TEXT_MEMORY cannot contain image or audio media.");
  }
  if (kind === MEMORY_KINDS.IMAGE_ARCHIVE && audio) {
    throw new TypeError("IMAGE_ARCHIVE cannot contain unrelated audio media.");
  }
  if (kind === MEMORY_KINDS.AUDIO_ARCHIVE && (image || text)) {
    throw new TypeError("AUDIO_ARCHIVE cannot contain unrelated image or text media.");
  }
}

export function createMemoryItem({
  id,
  type = null,
  kind = null,
  label = null,
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
  isPrototype = true,
  relationship = null,
}) {
  const resolvedKind = kind ?? inferIndependentKind({ text, image, audio });
  if (!Object.values(MEMORY_KINDS).includes(resolvedKind)) {
    throw new TypeError(`Unsupported memory kind: ${resolvedKind}`);
  }

  const isPaired = resolvedKind === MEMORY_KINDS.PAIRED_MEMORY;
  const resolvedRelationship = relationship ??
    (isPaired ? null : MEMORY_RELATIONSHIPS.INDEPENDENT);
  if (isPaired) {
    const mediaCount = [text, image, audio].filter(Boolean).length;
    if (
      resolvedRelationship !== MEMORY_RELATIONSHIPS.VERIFIED_PAIR ||
      !verified ||
      mediaCount < 2
    ) {
      throw new TypeError(
        "PAIRED_MEMORY requires verified media and an explicit verified-pair relationship.",
      );
    }
  } else {
    if (resolvedRelationship !== MEMORY_RELATIONSHIPS.INDEPENDENT) {
      throw new TypeError(
        "Only PAIRED_MEMORY can use the verified-pair relationship.",
      );
    }
    validateIndependentMedia(resolvedKind, { text, image, audio });
  }

  if (verified && isPrototype) {
    throw new TypeError("A memory cannot be both verified and a prototype.");
  }

  const resolvedType = getTypeForKind(resolvedKind, { text, image });
  if (type && type !== resolvedType) {
    throw new TypeError(
      `Memory type ${type} does not match ${resolvedKind} (${resolvedType}).`,
    );
  }

  return Object.freeze({
    id,
    type: resolvedType,
    kind: resolvedKind,
    label: label ?? getDefaultLabel(resolvedKind, isPrototype),
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
    relationship: resolvedRelationship,
  });
}

const PROTOTYPE_MEMORIES = Object.freeze([
  createMemoryItem({
    id: "prototype-rain",
    kind: MEMORY_KINDS.TEXT_MEMORY,
    text: "雨落在纪念馆外的石阶上，周围的脚步声慢了下来。",
    isQuote: true,
  }),
  createMemoryItem({
    id: "prototype-wind",
    kind: MEMORY_KINDS.TEXT_MEMORY,
    text: "走出展厅时，风从城墙的方向吹来，手里的纸页轻轻作响。",
    isQuote: true,
  }),
  createMemoryItem({
    id: "prototype-classroom",
    kind: MEMORY_KINDS.TEXT_MEMORY,
    text: "第一次听见“江东门”这个名字，是在一堂安静的历史课上。",
    isQuote: true,
  }),
  createMemoryItem({
    id: "prototype-silence",
    kind: MEMORY_KINDS.TEXT_MEMORY,
    text: "那天没有说很多话，只记得离开前又回头看了一次。",
    isQuote: true,
  }),
  createMemoryItem({
    id: "prototype-archive-jiangdongmen",
    kind: MEMORY_KINDS.IMAGE_ARCHIVE,
    image: "./assets/memories/archive-placeholder-01.svg",
    caption: "江东门影像档案 · 待补充",
    location: "南京 · 江东门",
    source: "ARCHIVE PLACEHOLDER",
  }),
  createMemoryItem({
    id: "prototype-archive-memorial",
    kind: MEMORY_KINDS.IMAGE_ARCHIVE,
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
      kind: MEMORY_KINDS.TEXT_MEMORY,
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
    const audioCandidates = candidates.filter(isAudioPresentation);
    const nonAudioCandidates = candidates.filter(
      (memory) => !isAudioPresentation(memory),
    );

    let eligibleCandidates = candidates;
    if (audioCooldownRemaining > 0) {
      eligibleCandidates = nonAudioCandidates;
    } else if (audioCandidates.length > 0 && nonAudioCandidates.length > 0) {
      const chooseAudio =
        clampRandom(random) < selectionConfig.AUDIO_ARCHIVE_PROBABILITY;
      eligibleCandidates = chooseAudio ? audioCandidates : nonAudioCandidates;
    }

    const selected = selectFromCandidates(eligibleCandidates, random);
    if (!selected) {
      return null;
    }

    if (isAudioPresentation(selected)) {
      audioCooldownRemaining = Math.max(
        selectionConfig.AUDIO_ARCHIVE_COOLDOWN_EVENTS,
        selectionConfig.MIN_EVENTS_BETWEEN_AUDIO,
      );
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

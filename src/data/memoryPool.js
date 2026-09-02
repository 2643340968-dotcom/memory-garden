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
  CATEGORY_SHUFFLE_BAG: Object.freeze([
    MEMORY_TYPES.TEXT,
    MEMORY_TYPES.IMAGE,
    MEMORY_TYPES.AUDIO,
  ]),
  TEXT_SOURCE_WEIGHTS: Object.freeze({
    BUILT_IN: 0.7,
    VISITOR: 0.3,
  }),
  RECENT_ITEM_HISTORY_SIZE: 1,
  AVOID_CATEGORY_REPEAT_AT_BAG_BOUNDARY: true,
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

export const BUILT_IN_TEXT_MEMORIES = Object.freeze([
  createMemoryItem({
    id: "prototype-rain",
    text: "Rain fell on the stone steps outside the Memorial Hall. Around us, every footstep seemed to slow.",
    isQuote: false,
    isPrototype: true,
  }),
  createMemoryItem({
    id: "prototype-wind",
    text: "As I left the exhibition hall, a wind came from the city wall and stirred the pages in my hands.",
    isQuote: false,
    isPrototype: true,
  }),
  createMemoryItem({
    id: "prototype-classroom",
    text: "I first heard the name Jiangdongmen in a quiet history classroom.",
    isQuote: false,
    isPrototype: true,
  }),
  createMemoryItem({
    id: "prototype-silence",
    text: "We did not say much that day. Before leaving, I remember turning back once more.",
    isQuote: false,
    isPrototype: true,
  }),
]);

const IMAGE_ARCHIVE_SEQUENCE = Object.freeze([
  "283",
  "284",
  "285",
  "286",
  "287",
  "288",
  "289",
  "290",
  "291",
  "292",
  "293",
  "294",
  "295",
  "296",
  "297",
  "298",
  "299",
  "300",
  "301",
  "302",
  "303",
]);

export const IMAGE_ARCHIVE_MEMORIES = Object.freeze(
  IMAGE_ARCHIVE_SEQUENCE.map((sequence, index) =>
    createMemoryItem({
      id: `nanjing-memory-image-${sequence}`,
      kind: MEMORY_KINDS.IMAGE_ARCHIVE,
      label: `ARCHIVE IMAGE · ${String(index + 1).padStart(2, "0")}`,
      image: `./assets/memories/images/nanjing-memory-${sequence}.jpg`,
      verified: false,
      isPrototype: false,
      relationship: MEMORY_RELATIONSHIPS.INDEPENDENT,
    }),
  ),
);

const AUDIO_ARCHIVE_SEQUENCE = Object.freeze([
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
]);

export const AUDIO_ARCHIVE_MEMORIES = Object.freeze(
  AUDIO_ARCHIVE_SEQUENCE.map((sequence) =>
    createMemoryItem({
      id: `archive-voice-${sequence}`,
      kind: MEMORY_KINDS.AUDIO_ARCHIVE,
      label: "ARCHIVE VOICE",
      audio: `./assets/memories/audio-normalized/archive-voice-${sequence}.mp3`,
      audioId: `archive-voice-${sequence}`,
      audioType: "audio/mpeg",
      verified: false,
      isPrototype: false,
      relationship: MEMORY_RELATIONSHIPS.INDEPENDENT,
    }),
  ),
);

const PROTOTYPE_MEMORIES = Object.freeze([
  ...BUILT_IN_TEXT_MEMORIES,
  ...IMAGE_ARCHIVE_MEMORIES,
  ...AUDIO_ARCHIVE_MEMORIES,
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

function getScheduleType(memory) {
  return isAudioPresentation(memory) ? MEMORY_TYPES.AUDIO : memory.type;
}

function shuffleCategoryTypes(types, random, lastSelectedType, avoidRepeat) {
  const shuffled = [...types];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(clampRandom(random) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  if (
    avoidRepeat &&
    shuffled.length > 1 &&
    shuffled[0] === lastSelectedType
  ) {
    const swapIndex = shuffled.findIndex((type) => type !== lastSelectedType);
    if (swapIndex > 0) {
      [shuffled[0], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[0],
      ];
    }
  }
  return shuffled;
}

export function createMemoryPool({
  prototypeMemories = PROTOTYPE_MEMORIES,
  selectionConfig = MEMORY_SELECTION_CONFIG,
} = {}) {
  const sessionMemories = [];
  const sourceMemories = Object.freeze([...prototypeMemories]);
  let sessionMemorySequence = 0;
  let lastSelectedId = null;
  let lastSelectedType = null;
  let categoryBag = [];
  const recentIdsByType = new Map();

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

  function getEligibleCandidates(candidates, recentIds) {
    const withoutRecent = candidates.filter(
      (memory) => !recentIds.includes(memory.id),
    );
    const recentSafe = withoutRecent.length > 0 ? withoutRecent : candidates;
    const withoutImmediateRepeat = recentSafe.filter(
      (memory) => memory.id !== lastSelectedId,
    );
    return withoutImmediateRepeat.length > 0
      ? withoutImmediateRepeat
      : recentSafe;
  }

  function selectTextEcho(random, recentIds) {
    const builtInCandidates = sourceMemories.filter(
      (memory) => getScheduleType(memory) === MEMORY_TYPES.TEXT,
    );
    const visitorCandidates = sessionMemories.filter(
      (memory) => getScheduleType(memory) === MEMORY_TYPES.TEXT,
    );
    const isEligible = (memory) =>
      !recentIds.includes(memory.id) && memory.id !== lastSelectedId;
    const eligibleBuiltIns = builtInCandidates.filter(isEligible);
    const eligibleVisitors = visitorCandidates.filter(isEligible);
    const builtInWeight = Math.max(
      0,
      selectionConfig.TEXT_SOURCE_WEIGHTS?.BUILT_IN ?? 0.7,
    );
    const visitorWeight = Math.max(
      0,
      selectionConfig.TEXT_SOURCE_WEIGHTS?.VISITOR ?? 0.3,
    );
    const totalWeight = builtInWeight + visitorWeight;
    const builtInRatio = totalWeight > 0 ? builtInWeight / totalWeight : 0.7;
    const preferBuiltIn = clampRandom(random) < builtInRatio;
    const preferred = preferBuiltIn ? eligibleBuiltIns : eligibleVisitors;
    const alternate = preferBuiltIn ? eligibleVisitors : eligibleBuiltIns;
    const candidates = preferred.length > 0 ? preferred : alternate;

    if (candidates.length > 0) {
      return selectFromCandidates(candidates, random);
    }

    return selectFromCandidates(
      [...builtInCandidates, ...visitorCandidates],
      random,
    );
  }

  function selectEcho(random = Math.random, { audioAvailable = true } = {}) {
    const allMemories = [...sessionMemories, ...sourceMemories];
    const availableTypes = selectionConfig.CATEGORY_SHUFFLE_BAG.filter((type) =>
      allMemories.some((memory) => getScheduleType(memory) === type),
    );
    if (availableTypes.length === 0) {
      return null;
    }

    categoryBag = categoryBag.filter((type) => availableTypes.includes(type));
    if (categoryBag.length === 0) {
      categoryBag = shuffleCategoryTypes(
        availableTypes,
        random,
        lastSelectedType,
        selectionConfig.AVOID_CATEGORY_REPEAT_AT_BAG_BOUNDARY,
      );
    }

    const allowedTypes = audioAvailable
      ? availableTypes
      : availableTypes.filter((type) => type !== MEMORY_TYPES.AUDIO);
    if (allowedTypes.length === 0) {
      return null;
    }

    const scheduledIndex = categoryBag.findIndex((type) =>
      allowedTypes.includes(type),
    );
    const selectedType = scheduledIndex >= 0
      ? categoryBag.splice(scheduledIndex, 1)[0]
      : selectFromCandidates(
          allowedTypes.filter((type) => type !== lastSelectedType).length > 0
            ? allowedTypes.filter((type) => type !== lastSelectedType)
            : allowedTypes,
          random,
        );
    const recentIds = recentIdsByType.get(selectedType) ?? [];
    const selected = selectedType === MEMORY_TYPES.TEXT
      ? selectTextEcho(random, recentIds)
      : selectFromCandidates(
          getEligibleCandidates(
            allMemories.filter(
              (memory) => getScheduleType(memory) === selectedType,
            ),
            recentIds,
          ),
          random,
        );
    if (!selected) {
      return null;
    }

    lastSelectedId = selected.id;
    lastSelectedType = selectedType;
    recentIdsByType.set(
      selectedType,
      [selected.id, ...recentIds]
        .slice(0, selectionConfig.RECENT_ITEM_HISTORY_SIZE),
    );
    return selected;
  }

  function resetSelection() {
    lastSelectedId = null;
    lastSelectedType = null;
    categoryBag = [];
    recentIdsByType.clear();
  }

  return Object.freeze({
    sessionMemories,
    prototypeMemories: sourceMemories,
    builtInTextMemories: Object.freeze(
      sourceMemories.filter(
        (memory) => getScheduleType(memory) === MEMORY_TYPES.TEXT,
      ),
    ),
    addSessionMemory,
    getById,
    selectEcho,
    resetSelection,
    get selectionState() {
      return Object.freeze({
        lastSelectedId,
        lastSelectedType,
        categoryBag: Object.freeze([...categoryBag]),
        recentIdsByType: Object.freeze(
          Object.fromEntries(
            [...recentIdsByType].map(([type, ids]) => [type, [...ids]]),
          ),
        ),
      });
    },
  });
}

export { PROTOTYPE_MEMORIES };

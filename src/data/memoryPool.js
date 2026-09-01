export const MEMORY_TYPES = Object.freeze({
  TEXT: "text",
  IMAGE: "image",
});

export const MEMORY_ITEM_SCHEMA_FIELDS = Object.freeze([
  "id",
  "type",
  "kind",
  "label",
  "text",
  "image",
  "caption",
  "source",
  "date",
  "location",
  "audio",
  "audioId",
]);

function createMemoryItem({
  id,
  type = MEMORY_TYPES.TEXT,
  kind = "prototype",
  label = "GARDEN MEMORY · PROTOTYPE",
  text = null,
  image = null,
  caption = null,
  source = null,
  date = null,
  location = null,
  audio = null,
  audioId = null,
}) {
  if (!Object.values(MEMORY_TYPES).includes(type)) {
    throw new TypeError(`Unsupported memory type: ${type}`);
  }

  return Object.freeze({
    id,
    type,
    kind,
    label,
    text,
    image,
    caption,
    source,
    date,
    location,
    audio,
    audioId,
  });
}

const PROTOTYPE_MEMORIES = Object.freeze([
  createMemoryItem({
    id: "prototype-rain",
    text: "雨落在纪念馆外的石阶上，周围的脚步声慢了下来。",
  }),
  createMemoryItem({
    id: "prototype-wind",
    text: "走出展厅时，风从城墙的方向吹来，手里的纸页轻轻作响。",
  }),
  createMemoryItem({
    id: "prototype-classroom",
    text: "第一次听见“江东门”这个名字，是在一堂安静的历史课上。",
  }),
  createMemoryItem({
    id: "prototype-silence",
    text: "那天没有说很多话，只记得离开前又回头看了一次。",
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

export function createMemoryPool() {
  const sessionMemories = [];
  let sessionMemorySequence = 0;
  let lastSelectedId = null;

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
    });
    sessionMemories.push(memory);
    return memory;
  }

  function getById(memoryId) {
    return (
      sessionMemories.find((memory) => memory.id === memoryId) ??
      PROTOTYPE_MEMORIES.find((memory) => memory.id === memoryId) ??
      null
    );
  }

  function selectEcho(random = Math.random) {
    const allMemories = [...sessionMemories, ...PROTOTYPE_MEMORIES];
    const candidates =
      allMemories.length > 1
        ? allMemories.filter((memory) => memory.id !== lastSelectedId)
        : allMemories;
    const index = Math.min(
      candidates.length - 1,
      Math.floor(Math.max(0, Math.min(0.999999, random())) * candidates.length),
    );
    const selected = candidates[index] ?? null;
    lastSelectedId = selected?.id ?? null;
    return selected;
  }

  return Object.freeze({
    sessionMemories,
    prototypeMemories: PROTOTYPE_MEMORIES,
    addSessionMemory,
    getById,
    selectEcho,
  });
}

export { PROTOTYPE_MEMORIES, createMemoryItem };

const PROTOTYPE_MEMORIES = Object.freeze([
  Object.freeze({
    id: "prototype-rain",
    text: "雨落在纪念馆外的石阶上，周围的脚步声慢了下来。",
    label: "GARDEN MEMORY · PROTOTYPE",
    kind: "prototype",
  }),
  Object.freeze({
    id: "prototype-wind",
    text: "走出展厅时，风从城墙的方向吹来，手里的纸页轻轻作响。",
    label: "GARDEN MEMORY · PROTOTYPE",
    kind: "prototype",
  }),
  Object.freeze({
    id: "prototype-classroom",
    text: "第一次听见“江东门”这个名字，是在一堂安静的历史课上。",
    label: "GARDEN MEMORY · PROTOTYPE",
    kind: "prototype",
  }),
  Object.freeze({
    id: "prototype-silence",
    text: "那天没有说很多话，只记得离开前又回头看了一次。",
    label: "GARDEN MEMORY · PROTOTYPE",
    kind: "prototype",
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
    const memory = Object.freeze({
      id: `session-memory-${sessionMemorySequence}`,
      text,
      label: "YOUR MEMORY",
      kind: "session",
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

export { PROTOTYPE_MEMORIES };

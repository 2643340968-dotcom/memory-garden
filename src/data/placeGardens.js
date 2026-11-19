import { PLACES } from "../atlas/places.js";
import { createMemoryItem } from "./memoryPool.js";
import { PLACE_RECORDS } from "./placeRecords.js";

function makeGarden(placeId, records) {
  const [historical, publicMemory] = records.map(({ id, en, source, sourceUrl }) =>
    createMemoryItem({ id, text: en, source, sourceUrl, verified: true, isPrototype: false }));
  const prompt = createMemoryItem({
    id: placeId + "-prompt", label: "writing-prompt", text: PLACES[placeId].prompt[1], isPrototype: false,
  });
  return {
    memories: [historical, publicMemory, prompt],
    initialBlooms: [
      { memory: historical, x: 0.30, y: 0.69, reveal: false },
      { memory: prompt, x: 0.74, y: 0.73, reveal: false, useLastVisitor: true },
      { memory: publicMemory, x: 0.52, y: 0.63, reveal: true },
    ],
    featuredLabels: { [historical.id]: "memory.historical",
      [publicMemory.id]: publicMemory.id.endsWith("-position") ? "memory.mapNote" : "memory.heritage" },
  };
}

const gardens = new Map();
export function getGarden(id) {
  if (!gardens.has(id)) gardens.set(id, makeGarden(id, PLACE_RECORDS[id]));
  return gardens.get(id);
}

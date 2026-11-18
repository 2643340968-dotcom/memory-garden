import { BUILT_IN_TEXT_MEMORIES, createMemoryItem, PROTOTYPE_MEMORIES } from "./memoryPool.js";

// Editorial summaries with public sources. Supplied photographs and voices have
// independent records and are never attached to either of these texts.
const publicOpening = createMemoryItem({
  id: "jiangdongmen-opening",
  text: "On 15 August 1985, the memorial hall at Jiangdongmen opened its doors to the public to commemorate the victims of the Nanjing Massacre.",
  source: "Visit Nanjing",
  sourceUrl: "https://visitnanjing.net/venues-detail/6",
  verified: true,
  isPrototype: false,
});
const historicalRecord = createMemoryItem({
  id: "jiangdongmen-documents",
  text: "The Nanjing Massacre documents on UNESCO’s Memory of the World Register include records from 1937–1938 and files from postwar investigations and trials.",
  source: "UNESCO",
  sourceUrl: "https://www.unesco.org/en/memory-world/documents-nanjing-massacre",
  verified: true,
  isPrototype: false,
});

export const JIANGDONGMEN = Object.freeze({
  memories: Object.freeze([publicOpening, historicalRecord, ...PROTOTYPE_MEMORIES]),
  initialBlooms: [
    { memory: historicalRecord, x: 0.28, y: 0.70, reveal: false },
    { memory: BUILT_IN_TEXT_MEMORIES[0], x: 0.76, y: 0.73, reveal: false, useLastVisitor: true },
    { memory: publicOpening, x: 0.52, y: 0.64, reveal: true },
  ],
  featuredLabels: Object.freeze({
    [publicOpening.id]: "memory.public",
    [historicalRecord.id]: "memory.historical",
  }),
});

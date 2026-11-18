import { test } from "node:test";
import assert from "node:assert/strict";
import { atlasHash, readAtlasRoute } from "../src/atlas/places.js";
import { JIANGDONGMEN } from "../src/data/jiangdongmen.js";
import { createMemoryPool } from "../src/data/memoryPool.js";
import { getMemoryEchoLabel } from "../src/memory/MemoryExperience.js";
import { getLocalizedMemoryText } from "../src/i18n/LanguageController.js";

test("map and garden routes round trip only for catalogued places in their city", () => {
  for (const route of [
    { level: "country" },
    { level: "city", city: "nanjing" },
    { level: "place", city: "nanjing", place: "jiangdongmen" },
    { level: "garden", city: "nanjing", place: "jiangdongmen" },
  ]) {
    assert.deepEqual(readAtlasRoute(atlasHash(route)), route);
  }
  for (const hash of ["", "#garden", "#garden/nanjing/missing", "#garden/beijing/jiangdongmen",
    "#atlas/toString", "#atlas/nanjing/jiangdongmen/extra"]) {
    assert.deepEqual(readAtlasRoute(hash), { level: "country" });
  }
});

test("Jiangdongmen can be explored before writing, with sourced text distinct from visitor words", () => {
  const pool = createMemoryPool({ prototypeMemories: JIANGDONGMEN.memories });
  assert.equal(pool.sessionMemories.length, 0);
  for (const { memory } of JIANGDONGMEN.initialBlooms) assert.equal(pool.getById(memory.id), memory);
  for (const [id, key] of Object.entries(JIANGDONGMEN.featuredLabels)) {
    const entry = pool.getById(id);
    assert.ok(entry.verified && entry.source && entry.sourceUrl);
    assert.equal(entry.image, null);
    assert.equal(entry.audio, null);
    assert.equal(entry.isQuote, false);
    assert.notEqual(getLocalizedMemoryText(entry, "zh-CN"), entry.text);
    assert.equal(getMemoryEchoLabel(entry, "001", "zh-CN", JIANGDONGMEN.featuredLabels), key === "memory.public" ? "公共纪念" : "历史资料");
  }
  const raw = "  A visit\nwith my family.  ";
  const visitor = pool.addSessionMemory(raw);
  pool.resetSelection();
  assert.equal(getLocalizedMemoryText(pool.getById(visitor.id), "zh-CN"), raw);
  assert.equal(getMemoryEchoLabel(visitor, "002", "zh-CN"), "访客记忆");
});

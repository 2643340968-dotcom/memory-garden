import { test } from "node:test";
import assert from "node:assert/strict";
import { atlasHash, CITIES, PLACES, readAtlasRoute } from "../src/atlas/places.js";
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

test("every mapped city opens its own sites through the garden and writing stages", async () => {
  const catalogued = Object.values(CITIES).flatMap((city) => city.places);
  assert.deepEqual([...catalogued].sort(), Object.keys(PLACES).sort());
  const autoBlooms = [];
  const editorIds = new Set();
  for (const [city, { places }] of Object.entries(CITIES)) {
    assert.deepEqual(readAtlasRoute("#atlas/" + city), { level: "city", city });
    for (const place of places) {
      const site = PLACES[place];
      assert.equal(site.city, city);
      for (const level of ["place", "garden"]) {
        const route = { level, city, place };
        assert.deepEqual(readAtlasRoute(atlasHash(route)), route);
      }
      if (site.bloomOnSubmit) autoBlooms.push(place);
      const collection = await site.loadCollection();
      assert.equal(await site.loadCollection(), collection);
      assert.equal(collection.initialBlooms.length, 3);
      assert.ok(collection.memories.some((memory) => memory.sourceUrl === site.sourceUrl));
      for (const { memory } of collection.initialBlooms) {
        assert.ok(collection.memories.includes(memory));
        assert.ok(!editorIds.has(memory.id));
        editorIds.add(memory.id);
      }
    }
  }
  assert.deepEqual(autoBlooms, ["jiangdongmen"]);
});

test("local gardens have bilingual source records, writing prompts and separate visitor collections", async () => {
  const copies = [];
  for (const [id, place] of Object.entries(PLACES)) {
    const records = (await place.loadCollection()).memories;
    const pool = createMemoryPool({ prototypeMemories: records });
    copies.push(pool);
    if (id === "jiangdongmen") continue;
    assert.equal(records.filter((record) => record.verified).length, 2);
    for (const record of records) {
      assert.ok(!record.isQuote && !record.image && !record.audio);
      assert.notEqual(getLocalizedMemoryText(record, "zh-CN"), getLocalizedMemoryText(record, "en"));
      if (record.verified) assert.ok(record.source && record.sourceUrl?.startsWith("https://"));
      else {
        assert.equal(record.label, "writing-prompt");
        assert.equal(getLocalizedMemoryText(record, "zh-CN"), place.prompt[0]);
      }
    }
  }
  const written = copies[1].addSessionMemory("  一起登景山。\n  ");
  for (const [index, pool] of copies.entries()) {
    assert.equal(pool.getById(written.id), index === 1 ? written : null);
  }
});

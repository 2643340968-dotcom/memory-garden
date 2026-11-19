import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { atlasHash, CITIES, PLACES, readAtlasRoute } from "../src/atlas/places.js";
import { groupMarkers } from "../src/atlas/markerLayout.js";
import { JIANGDONGMEN } from "../src/data/jiangdongmen.js";
import { createMemoryPool } from "../src/data/memoryPool.js";
import { getMemoryEchoLabel } from "../src/memory/MemoryExperience.js";
import { getLocalizedMemoryText } from "../src/i18n/LanguageController.js";

test("each of the 85 places has a local chart covering its coordinate", () => {
  const mapRoot = new URL("../src/atlas/maps/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("place-bounds.json", mapRoot), "utf8"));
  const chartIds = [];
  for (const [path, { level, city, bounds }] of Object.entries(manifest)) {
    if (level === "region" || level === "city") continue;
    const place = PLACES[level];
    assert.equal(place.city, city, level);
    const [lon, lat] = place.center;
    const [west, south, east, north] = bounds;
    assert.ok(west < lon && lon < east && south < lat && lat < north, level);
    const header = readFileSync(new URL(path + ".webp", mapRoot)).subarray(0, 12).toString("latin1");
    assert.equal(header.slice(0, 4), "RIFF", path);
    assert.equal(header.slice(8), "WEBP", path);
    chartIds.push(level);
  }
  assert.deepEqual(chartIds.sort(), Object.keys(PLACES).sort());
  assert.deepEqual(Object.fromEntries(Object.entries(CITIES).map(([id, city]) => [id, city.places.length])),
    { nanjing: 21, beijing: 22, dunhuang: 8, chengdu: 18, quanzhou: 16 });
  assert.equal(new Set(Object.values(CITIES).map(city => city.ink)).size, 5);
});

test("nearby pins share a true location at city scale and separate at street scale", () => {
  const sites = [
    { id: "a", city: "nanjing", x: 100, y: 100 },
    { id: "b", city: "nanjing", x: 113, y: 104 },
    { id: "c", city: "nanjing", x: 145, y: 120 },
    { id: "d", city: "beijing", x: 102, y: 104 },
  ];
  const groups = groupMarkers(sites, 19);
  assert.deepEqual(groups.map(group => group.members), [["a", "b"], ["c"], ["d"]]);
  assert.deepEqual([groups[0].x, groups[0].y], [sites[0].x, sites[0].y]);
  assert.deepEqual(groupMarkers(sites, 0).map(group => group.members), [["a"], ["b"], ["c"], ["d"]]);
  assert.ok(sites.every(site => !("members" in site)));
});

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

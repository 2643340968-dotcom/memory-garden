import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import vectorIndex from "../src/atlas/maps/vector-index.json" with { type: "json" };
import { indexedTile } from "../src/atlas/VectorBasemap.js";
import { atlasHash, CITIES, PLACES, readAtlasRoute } from "../src/atlas/places.js";
import { groupMarkers } from "../src/atlas/markerLayout.js";
import { routeAtZoom } from "../src/atlas/zoomRoute.js";
import { JIANGDONGMEN } from "../src/data/jiangdongmen.js";
import { createMemoryPool } from "../src/data/memoryPool.js";
import { getMemoryEchoLabel } from "../src/memory/MemoryExperience.js";
import { getLocalizedMemoryText } from "../src/i18n/LanguageController.js";

test("zooming out leaves the place and city layers, including a pinch across both at once", () => {
  const fit = route => route.level === "place" ? 0.08 : 1.2;
  for (const [cityId, city] of Object.entries(CITIES)) {
    const id = city.places[0];
    const point = PLACES[id].center;
    const place = { level: "place", city: cityId, place: id };
    const cityRoute = { level: "city", city: cityId };
    const country = { level: "country" };
    assert.equal(routeAtZoom(place, 0.105, true, point, fit), place);
    assert.deepEqual(routeAtZoom(place, 0.13, true, point, fit), cityRoute);
    assert.equal(routeAtZoom(cityRoute, 6.4, true, point, fit), cityRoute);
    assert.deepEqual(routeAtZoom(cityRoute, 8, true, point, fit), country);
    assert.deepEqual(routeAtZoom(place, 75, true, point, fit), country);
    assert.equal(routeAtZoom(country, 75, true, point, fit), country);
  }
});

test("zooming in follows the geographic focus and tolerates small reversals at layer boundaries", () => {
  const fit = route => route.level === "place" ? 0.075 : 0.55;
  const country = { level: "country" };
  const city = { level: "city", city: "beijing" };
  const point = PLACES.wanchunting.center;
  assert.equal(routeAtZoom(country, 0.9, false, [85, 34], fit), country);
  assert.equal(routeAtZoom(country, 5.3, false, point, fit), country);
  assert.deepEqual(routeAtZoom(country, 4.7, false, point, fit), city);
  assert.equal(routeAtZoom(city, 5.3, true, point, fit), city);
  assert.equal(routeAtZoom(city, 0.075, false, point, fit), city);
  assert.deepEqual(routeAtZoom(city, 0.052, false, point, fit), { ...city, level: "place", place: "wanchunting" });
  const nanjing = { level: "city", city: "nanjing" };
  const lake = PLACES.p31332.center;
  assert.deepEqual(routeAtZoom(country, 0.052, false, lake, fit), { ...nanjing, level: "place", place: "p31332" });
  assert.equal(routeAtZoom(nanjing, 0.052, false, [120, 36], fit), nanjing);
});

const vectorRoot = new URL("../public/assets/atlas-vectors/", import.meta.url);

test("the published atlas packs match their digests and tile masks, including the national relief", () => {
  function unpack(file) {
    const zipped = readFileSync(new URL(file, vectorRoot));
    assert.equal(createHash("sha256").update(zipped).digest("hex").slice(0, 12), file.split(".")[1]);
    return JSON.parse(gunzipSync(zipped));
  }
  const national = unpack(vectorIndex.national);
  for (const name of ["land", "focus", "province", "river", "ridge"]) assert.match(national[name], /^M/);
  assert.match(vectorIndex.overview.focus, /^M/);
  for (const [mask, file] of Object.values(vectorIndex.packs)) {
    const slots = Object.keys(unpack(file)).map(Number);
    assert.equal(slots.reduce((bits, n) => bits | 1 << n, 0), mask, file);
  }
});

test("each of the 85 site coordinates has independently drawable approach, street and building-scale geometry", () => {
  const mapRoot = new URL("../src/atlas/maps/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("place-bounds.json", mapRoot), "utf8"));
  const chartIds = [];
  const cache = new Map();
  for (const { level, city, bounds } of Object.values(manifest)) {
    if (level === "region" || level === "city") continue;
    const place = PLACES[level];
    assert.equal(place.city, city, level);
    const [lon, lat] = place.center;
    const [west, south, east, north] = bounds;
    assert.ok(west < lon && lon < east && south < lat && lat < north, level);
    const mercator = Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI;
    for (const z of [6, 10, 12, 13, 14]) {
      const x = Math.floor((lon + 180) / 360 * 2 ** z), y = Math.floor((1 - mercator) / 2 * 2 ** z);
      const tile = indexedTile(z, x, y);
      assert.ok(tile, level + " zoom " + z);
      if (!cache.has(tile.file)) cache.set(tile.file, JSON.parse(gunzipSync(readFileSync(new URL(tile.file, vectorRoot)))));
      const chart = cache.get(tile.file)[tile.slot];
      assert.equal(typeof chart, "object");
      if (level === "jiangdongmen" && z === 14) {
        assert.match(chart.building, /^M/);
        assert.match(chart.lane, /^M/);
        assert.ok(chart.labels.length);
      }
    }
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

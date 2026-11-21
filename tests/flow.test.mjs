import test from "node:test";
import {readFileSync} from "node:fs";
import {markFlower} from "../src/flow/atlas.js";
import assert from "node:assert/strict";
import {project, under, mercator, latitude, blend, cameraProgress, coversView, framePlacement} from "../src/flow/geometry.js";
import {FlowBasemap, NavigationChart} from "../src/flow/FlowBasemap.js";
import {AFTERGLOW, envelope, releaseWave, RippleField} from "../src/flow/ripples.js";
import {openingPose} from "../src/flow/landing.js";
import {flowerFront, frontsAt, openingFlowers} from "../src/flow/coverFlowers.js";
import {WetPaper} from "../src/flow/wetPaper.js";
import {PetalCurrent} from "../src/flow/petalCurrent.js";
import {nationalMarks} from "../src/flow/overview.js";
import {cityFlowers} from "../src/flow/cityFlowers.js";
import {allForms, flowerKey, forms, plateURL} from "../src/flow/flowerForms.js";
import {chartLabelInLanguage, nextMapLevel, WheelGesture} from "../src/flow/levels.js";
import {CITIES, PLACES} from "../src/atlas/places.js";

test("cover flower fronts grow continuously, overlap in time and dissolve before restarting", () => {
  const active = [.015, .8, 2, 3.5, 5, 6.5, 7.7].map(flowerFront);
  assert.ok(active[0].radius < .04);
  assert.ok(active.every(wave => wave.opacity > 0));
  assert.ok(active.every((wave, i) => i === 0 || wave.radius > active[i - 1].radius));
  assert.ok(active[0].opacity < active[2].opacity && active.at(-1).opacity < .01);
  assert.equal(flowerFront(-1), null);
  assert.ok(active.slice(2).every((wave, i) => wave.opacity < active[i + 1].opacity));
  assert.equal(flowerFront(7.8), null);
  const bloom = {delay:0, angle:0};
  const train = frontsAt(bloom, 6.2);
  assert.equal(train.length, 3);
  assert.ok(train[0].radius > train[1].radius && train[1].radius > train[2].radius);
});

test("the top-down opening has staggered, different-sized flowers on both sides at phone and desktop widths", () => {
  for (const [w, h] of [[390, 540], [1440, 550]]) {
    const bed = openingFlowers(w, h);
    const left = bed.filter(b => b.x < w / 2), right = bed.filter(b => b.x > w / 2);
    assert.ok(Math.abs(Math.min(...left.map(b => b.delay)) - Math.min(...right.map(b => b.delay))) < .15);
    for (const side of [left, right]) {
      const inward = side.slice().sort((a,b) => Math.abs(w/2-b.x) - Math.abs(w/2-a.x));
      assert.ok(inward.slice(1).every((b,i) => b.delay >= inward[i].delay));
      assert.ok(frontsAt(inward[0], 1.6).length && !frontsAt(inward.at(-1), 1.6).length);
      assert.ok(new Set(side.map(b => b.type)).size >= 5);
      assert.ok(Math.max(...side.map(b => b.radius)) > 2 * Math.min(...side.map(b => b.radius)));
      assert.ok(Math.max(...side.map(b => b.delay)) - Math.min(...side.map(b => b.delay)) > 1);
      assert.ok(side.every(b => b.y >= 0 && b.y < h));
    }
  }
});

test("all eighteen national marks have their own sourced bilingual flower, distinct drawing and opening", () => {
  const ids=nationalMarks.map(mark=>mark.id).sort();
  assert.deepEqual(Object.keys(forms).sort(),ids);
  assert.deepEqual(Object.keys(cityFlowers).sort(),ids);
  assert.deepEqual(openingFlowers(1280,760).map(b=>b.type).sort(),ids);
  for (const flower of Object.values(cityFlowers)) {
    for (const pair of [flower.name,flower.reason,flower.source]) {
      assert.match(pair[0],/\p{Script=Han}/u); assert.doesNotMatch(pair[1],/\p{Script=Han}/u);
      assert.ok(pair[1].trim().length);
    }
    assert.equal(new URL(flower.url).protocol,"https:");
  }
  assert.equal(new Set(ids.map(id=>cityFlowers[id].name[0])).size,18);
  assert.equal(new Set(ids.map(id=>JSON.stringify([forms[id].whorls,forms[id].florets]))).size,18);
  assert.equal(cityFlowers.nanjing.name[0],"紫金草");
  for (const [city, counts] of Object.entries({
    nanjing: [4], dunhuang: [8, 8], xining: [3, 3], lhasa: [8],
    wuhan: [5], haikou: [3], harbin: [4], kunming: [5],
  })) {
    assert.deepEqual(forms[city].whorls.map(layer => layer.petals), counts, city);
  }
  for (const city of ["quanzhou", "harbin", "kunming"]) assert.ok(forms[city].florets.length > 1, city);
});

test("a drag displaces pigment in petal coordinates and adds stronger waves near its path", () => {
  const blooms = [0, 90, 400].map(x => ({x, y: 0, radius: 85, angle: Math.PI / 2, delay: 0}));
  const fast = new PetalCurrent(blooms), slow = new PetalCurrent(blooms);
  assert.ok(fast.hover({x: 29, y: 0}, 1));
  assert.ok(fast.states[0].targetY < 0 && fast.states[0].energy === 0);
  assert.deepEqual(fast.fronts(0, 1), []);
  for (const [current, seconds] of [[fast, .06], [slow, .8]]) {
    current.pull({x: -25, y: 8}, {x: 42, y: 8}, seconds, 1);
    current.advance(.12, 1.12);
  }
  const [near, beside, far] = fast.states;
  assert.ok(near.y < -.25, "a rightward pull moves along the rotated flower's negative local y axis");
  assert.ok(near.energy > beside.energy && beside.energy > 0 && far.energy === 0);
  assert.ok(fast.fronts(0, 1.4)[0].opacity > slow.fronts(0, 1.4)[0].opacity);
  assert.ok(fast.fronts(1, 1.4)[0].radius < fast.fronts(0, 1.4)[0].radius);
  assert.deepEqual(fast.fronts(2, 1.4), []);
  const crossing = new PetalCurrent(blooms);
  crossing.pull({x: -250, y: 0}, {x: 250, y: 0}, .05, 2);
  assert.ok(crossing.fronts(0, 2.4).length && crossing.states[0].targetX === 0);
});

test("a released gradient and its travelling fronts settle independently before a new stroke", () => {
  const current = new PetalCurrent([{x: 0, y: 0, radius: 85, angle: 0}]);
  const state = current.states[0];
  current.pull({x: -12, y: 6}, {x: 38, y: 6}, .08, 1);
  current.advance(.25, 1.25);
  const held = state.x;
  current.release();
  current.advance(.2, 1.45);
  assert.ok(held > state.x && state.x > 0);
  assert.ok(current.fronts(0, 1.65)[0].radius > current.fronts(0, 1.45)[0].radius);
  for (let i = 0; i < 120; i++) current.advance(.05, 1.5 + .05 * i);
  assert.ok(Math.hypot(state.x, state.y) < .001 && state.energy < .001);
  assert.deepEqual(state.waves, []);
  current.pull({x: 12, y: 0}, {x: -38, y: 0}, .08, 8);
  current.advance(.2, 8.2);
  assert.ok(state.x < 0 && current.fronts(0, 8.3).length === 1);
});

// Synthetic circular plates keep the water solver test independent of Canvas.
const maskSize=32;
const testPlate={outline:new Float32Array(128).fill(.84),reserve:Uint8Array.from({length:maskSize**2},(_,i)=>{
  const r=Math.hypot((i%maskSize+.5)*2/maskSize-1,(Math.floor(i/maskSize)+.5)*2/maskSize-1);
  return r<.67 ? 255 : 0;
})};
const testPlates={nanjing:testPlate, xining:testPlate};
test("wet dye builds only where different flowers meet, then diffuses and dries gradually", () => {
  const a = {x:58, y:82, radius:62, type:"nanjing", angle:0};
  const b = {x:143, y:82, radius:62, type:"xining", angle:Math.PI};
  const paper = new WetPaper(200, 160, [a, b], testPlates);
  const reversed = new WetPaper(200, 160, [b, a], testPlates);
  const touching = [.85, .9, 1.0].map(radius => ({radius, progress:.4, wetness:1}));
  const distant = [{radius:.03, progress:.01, wetness:1}];
  const amount = field => field.wet.reduce((total, value, i) => total + (i % 4 === 3 ? value : 0), 0);
  for (let n = 0; n < 10; n++) paper.step([touching, []], .05);
  for (let n = 0; n < 10; n++) paper.step([distant, distant], .05);
  assert.equal(amount(paper), 0);
  paper.step([touching, touching], .05);
  const first = amount(paper);
  assert.ok(first > 0);
  for (let n = 1; n < 20; n++) paper.step([touching, touching], .05);
  const pool = amount(paper);
  assert.ok(pool > first * 4);
  assert.ok(paper.erosion.some((v,i)=>i%4===3 && v>30));
  assert.ok(paper.pixels.every((v,i)=>i%4!==3 || paper.free[i>>2]>0 || v===0));
  assert.ok(paper.erosion.every((v,i)=>i%4!==3 || (paper.free[i>>2]>0 && paper.rim[i>>2]>0) || v===0));
  for (let n = 0; n < 20; n++) reversed.step([touching, touching], .05);
  const channelError = paper.pixels.reduce((max, value, i) => Math.max(max, Math.abs(value - reversed.pixels[i])), 0);
  assert.ok(channelError <= 1);
  const fresh = paper.wet.slice();
  for (let n = 0; n < 12; n++) paper.step([[], []], .05);
  const tail = amount(paper);
  assert.ok(tail > pool * .4 && tail < pool);
  assert.ok(paper.wet.some((v, i) => i % 4 === 3 && v > fresh[i] + .001));
  paper.clear();
  assert.equal(amount(paper), 0);
});

test("Flow advances only through the pointed city and its places and retreats exactly one level", () => {
  const country = {level: "country"};
  assert.equal(nextMapLevel(country, true), null);
  assert.equal(nextMapLevel(country, false), null);
  for (const mark of nationalMarks) {
    const city = nextMapLevel(country, true, mark);
    if (!mark.city) { assert.equal(city, null); continue; }
    assert.deepEqual(city, {level: "city", city: mark.city});
    assert.deepEqual(nextMapLevel(city, false), country);
    assert.equal(nextMapLevel(city, true, mark), null);
    assert.equal(nextMapLevel(city, true), null);
    for (const [id, data] of Object.entries(PLACES)) {
      const place = nextMapLevel(city, true, {site: id});
      if (data.city !== city.city) { assert.equal(place, null); continue; }
      assert.deepEqual(place, {level: "place", city: city.city, place: id});
      assert.equal(nextMapLevel(place, true, {site: id}), null);
      assert.deepEqual(nextMapLevel(place, false), city);
    }
  }
});

test("a sustained trackpad tail takes one step and a deliberate reversal can interrupt it", () => {
  const wheel = new WheelGesture();
  assert.equal(wheel.consume(2, 0), false);
  assert.equal(wheel.consume(8, 12), true);
  for (let now = 25; now < 800; now += 30) assert.equal(wheel.consume(4, now), false);
  assert.equal(wheel.consume(-100, 802), true);
  assert.equal(wheel.consume(-42, 828), false);
  assert.equal(wheel.consume(-26, 1100), true);
  assert.equal(wheel.consume(100, 1110), true);
});

test("street labels stay in the chosen language even when a vector tile lacks a translation", () => {
  assert.equal(chartLabelInLanguage("水西门大街", "en"), false);
  assert.equal(chartLabelInLanguage("Shuiximen Avenue", "en"), true);
  assert.equal(chartLabelInLanguage("水西门大街", "zh-CN"), true);
  assert.equal(chartLabelInLanguage("Shuiximen Avenue", "zh-CN"), false);
  for (const language of ["en", "zh-CN"])
    assert.equal(chartLabelInLanguage("水西门 Shuiximen", language), false);
});

test(
    "scrolling the cover in either direction recovers the same title, paper and map registration", () => {
      const start = openingPose(0), middle = openingPose(.46), end = openingPose(1);
      assert.equal(start.title, 1);
      assert.equal(start.wash, 1);
      assert.ok(start.scale < .6 && start.scale < middle.scale && middle.scale < end.scale);
      assert.ok(middle.title > 0 && middle.title < 1 && middle.drift < start.drift);
      assert.equal(end.title, 0);
      assert.equal(end.wash, 0);
      assert.equal(end.drift, 0);
      assert.equal(end.scale, 1);
      assert.deepEqual(openingPose(-1), start);
      assert.deepEqual(openingPose(2), end);
      for (const p of [0, .25, .5, .75, 1]) {
        const still = openingPose(p, true);
        assert.equal(still.title, openingPose(p).title);
        assert.equal(still.lift, 0);
        assert.equal(still.drift, 0);
        assert.equal(still.scale, 1);
      }
    });

test("the national sheet holds eighteen geographic dots and only its five collection cities open a route", () => {
  assert.equal(nationalMarks.length, 18);
  assert.equal(new Set(nationalMarks.map(mark => mark.id)).size, 18);
  const destinations = nationalMarks.filter(mark => mark.city);
  assert.deepEqual(destinations.map(mark => mark.id).sort(), Object.keys(CITIES).sort());
  for (const mark of destinations) assert.deepEqual(mark.center, PLACES[mark.site].center);
  const labels = nationalMarks.filter(mark => !mark.city);
  assert.ok(labels.every(mark => mark.name.length === 2 && !mark.site && !mark.members.length));
  const x = labels.map(mark => mark.center[0]), y = labels.map(mark => mark.center[1]);
  assert.ok(Math.max(...x) - Math.min(...x) > 45 && Math.max(...y) - Math.min(...y) > 24);
});

test("flow atlas keeps geographic anchors registered through zoom and its reverse", () => {
  const country = {x : 104.8, y : mercator(36), span : 90};
  const site = {x : 118.733, y : mercator(32.031), span : .055};
  const point = [ 118.731, 32.032 ];
  for (const [w, h] of [[ 1440, 800 ], [ 390, 740 ]]) {
    for (const t of [0, .2, .5, .8, 1]) {
      const camera = blend(country, site, t);
      const forward = project(camera, w, h, point);
      const reverse = project(blend(site, country, 1 - t), w, h, point);
      const [lon, my] = under(camera, w, h, ...forward);
      assert.ok(Math.abs(forward[0] - reverse[0]) < 1e-6 && Math.abs(forward[1] - reverse[1]) < 1e-6);
      assert.ok(Math.abs(lon - point[0]) < 1e-9 && Math.abs(latitude(my) - point[1]) < 1e-9);
    }
  }
});

test(
    "a stalled high-resolution chart never leaves uncovered ground during a flight or a pinch reversal",
    () => {
      const overview = Object.create(NavigationChart.prototype);
      overview.canvas = {style : {}};
      overview.ctx = {setTransform() {}};
      overview.map = {draw : () => ({level : 6, labels : []})};
      const city = {x : 118.73, y : mercator(32), span : .78},
            nation = {x : 104.8, y : mercator(36), span : 90};
      for (const [w, h] of [[ 1280, 800 ], [ 390, 740 ]]) {
        const k = w / city.span,
              detailed = {camera : city, width : w * 1.2, height : h * 1.2, k, level : 11, labels : []};
        for (const t of [0, .05, .2, .6, 1, .72, .3, .02, 0]) {
          const view = blend(city, nation, t), at = framePlacement(detailed, view, w, h);
          const original = {frame : detailed, scale : at.s, x : at.x, y : at.y};
          const shot = overview.select(original, view, w, h, "zh-CN");
          assert.ok(coversView(shot.frame, {s : shot.scale, x : shot.x, y : shot.y}, w, h));
          assert.ok(Array.isArray(shot.frame.labels));
          if (t > .2)
            assert.notEqual(shot.frame, detailed);
          if (!t)
            assert.equal(shot.frame, detailed);
        }
      }
    });

test("each hovered location leaves its own fading water front while the next is active", () => {
  const first = {key : "nanjing", start : 0, left : null};
  const next = {key : "beijing", start : 520, left : null};
  const waves = [ first, next ];
  releaseWave(waves, "nanjing", 520);
  releaseWave(waves, "nanjing", 620);
  assert.equal(first.left, 520);
  assert.equal(next.left, null);
  assert.equal(envelope(first, 520), 1);
  assert.ok(envelope(first, 1520) > envelope(first, 2520));
  assert.ok(envelope(first, 2520) > 0);
  assert.equal(envelope(next, 2520), 1);
  assert.equal(envelope(first, 520 + AFTERGLOW), 0);
  assert.equal(envelope(next, 520, true), 1);
});

function recordingPaper() {
  return {
    fills : new Map(),
    lines : new Map(),
    saves : 0,
    save() {
      this.saves++;
    },
    restore() {
      this.saves--;
    },
    translate() {},
    scale() {},
    fillRect() {
      this.fills.set("background", this.fillStyle);
    },
    fill(feature) {
      this.fills.set(feature, this.fillStyle);
    },
    stroke(feature) {
      this.lines.set(feature, this.strokeStyle);
    }
  };
}
function assertPale(fills) {
  for (const hex of fills.values()) {
    const rgb = [ 1, 3, 5 ].map(at => parseInt(hex.slice(at, at + 2), 16));
    assert.ok(Math.min(...rgb) >= 220 && Math.max(...rgb) - Math.min(...rgb) <= 24, hex);
  }
}

test("both the national overview and its detailed contours draw on the original light paper", () => {
  const paths = Object.fromEntries([ "land", "focus", "province", "river" ].map(name => [name, name]));
  const map = Object.create(FlowBasemap.prototype);
  map.overview = {paths : {land : "land", focus : "focus"}};
  map.resource = () => ({});
  map.paths = () => ({paths});
  for (const generalize of [false, true]) {
    map.generalizeNational = generalize;
    const ctx = recordingPaper();
    map.drawNational(ctx, {x : 105, y : 38}, 900, 600, 11, true);
    assertPale(ctx.fills);
    assert.equal(ctx.fills.get("focus"), "#faf8f0");
    assert.equal(ctx.fills.get("background"), "#f3f5f2");
    assert.ok(ctx.lines.has("focus"));
    assert.equal(ctx.lines.has("river"), !generalize);
    assert.equal(ctx.saves, 0);
  }
});

test("city, street and building tiles share the same feature fills in both zoom directions", () => {
  const names = [
    "built", "sand", "farm", "park", "wood", "water", "building", "path", "lane", "road", "artery", "rail"
  ];
  const paths = Object.fromEntries(names.map(name => [name, name]));
  let prior;
  for (const level of [6, 10, 13, 14, 13, 10, 6]) {
    const ctx = recordingPaper();
    FlowBasemap.prototype.drawTile(ctx, paths, .16, 655, level);
    assertPale(ctx.fills);
    for (const [feature, color] of Object.entries(
             {water : "#e2f0ef", park : "#f1f5e6", building : "#f2eef2", background : "#faf8f0"}))
      assert.equal(ctx.fills.get(feature), color);
    if (prior)
      assert.deepEqual(ctx.fills, prior);
    prior = ctx.fills;
    assert.ok(ctx.lines.has("road") && ctx.lines.has("artery"));
    assert.equal(ctx.lines.has("building"), level >= 13);
  }
});

test("a geographic flower has the matching finished plate at every scale", () => {
  const keys = new Set();
  for (const mark of nationalMarks) {
    assert.equal(markFlower(mark), mark.id);
    keys.add(mark.id);
  }
  for (const [id, place] of Object.entries(PLACES)) {
    const mark = {site:id, city:place.city, members:[id]};
    assert.equal(markFlower(mark), flowerKey(place.study));
    assert.equal(markFlower({...mark, members:[id,"neighbour"]}), place.city);
    keys.add(markFlower(mark));
  }
  assert.equal(keys.size, 28);
  for (const key of keys) {
    assert.ok(allForms[key]);
    const source = readFileSync(new URL("../public/" + plateURL(key), import.meta.url), "utf8");
    assert.match(source, /viewBox=/);
    assert.match(source, /<radialGradient/);
    assert.match(source, /<g id="blossom">/);
    assert.doesNotMatch(source, /NaN|undefined|<image[ >]/);
  }
});

test("attending two flowers draws each species' own outward fronts and releases them separately", () => {
  const drawn = [], centres = [];
  const field = Object.assign(Object.create(RippleField.prototype), {
    width: 600, height: 400, dpr: 1, canvas: {dataset: {}}, motion: {matches:false}, project: p => p,
    ctx: {setTransform(){}, clearRect(){}, save(){}, restore(){}, translate(x,y){centres.push([x,y]);},
          drawImage(ring,x,y,w){drawn.push({ring,width:w,alpha:this.globalAlpha});}}
  });
  field.waves = [[200,200],[234,206]].map((center,i) => {
    const bloom = {type:i ? "wuhan" : "nanjing", radius:46, angle:0, delay:-2.75};
    return {key:bloom.type, center, start:0, left:i ? null : 900, bloom, pin:{isConnected:false},
            current:new PetalCurrent([bloom]), plate:{ring:bloom.type}};
  });
  field.draw(1450, true);
  assert.deepEqual(centres, [[200,200],[234,206]]);
  assert.deepEqual(new Set(drawn.map(d => d.ring)), new Set(["wuhan","nanjing"]));
  assert.ok(drawn.every(d => d.width > 80 && d.alpha > 0 && d.alpha <= 1));
  field.draw(900 + AFTERGLOW, true);
  assert.deepEqual(field.waves.map(w => w.key), ["wuhan"]);
  releaseWave(field.waves, "wuhan", 5000);
  field.draw(5000 + AFTERGLOW, true);
  assert.equal(field.canvas.dataset.waves, "0");
});

test("camera landings ease in both directions and carry velocity into a new wheel target", () => {
  const dt = .0001;
  for (const t of [0, .13, .46, .78, 1])
    assert.ok(Math.abs(cameraProgress(t) + cameraProgress(1 - t) - 1) < 1e-9);
  for (const slope of [0, .8, 2.4]) {
    assert.ok(Math.abs(cameraProgress(dt, slope) / dt - slope) < .001);
    assert.ok(1 - cameraProgress(1 - dt, slope) < 1e-8);
    for (let t = 0; t < .99; t += .01)
      assert.ok(cameraProgress(t + .01, slope) >= cameraProgress(t, slope));
  }
});

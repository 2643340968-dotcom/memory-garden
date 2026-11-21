import test from "node:test";
import assert from "node:assert/strict";
import {project, under, mercator, latitude, blend, cameraProgress, coversView, framePlacement} from "../src/flow/geometry.js";
import {FlowBasemap, NavigationChart} from "../src/flow/FlowBasemap.js";
import {AFTERGLOW, envelope, releaseWave, RippleField} from "../src/flow/ripples.js";
import {openingPose} from "../src/flow/landing.js";
import {nationalMarks} from "../src/flow/overview.js";
import {CITIES, PLACES} from "../src/atlas/places.js";

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

test("overlapping map ripples add only fine neutral outlines and clear after release", () => {
  const field = Object.create(RippleField.prototype), strokes = [], centres = [];
  field.ctx = {
    setTransform() {},
    clearRect() {},
    save() {},
    restore() {},
    rotate() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    translate(x, y) {
      centres.push([ x, y ]);
    },
    stroke() {
      strokes.push([ this.strokeStyle, this.globalAlpha, this.lineWidth ]);
    }
  };
  Object.assign(field, {
    width : 600,
    height : 400,
    dpr : 1,
    canvas : {dataset : {}},
    motion : {matches : false},
    project : p => p
  });
  field.waves = [ [ 200, 200 ], [ 235, 205 ] ].map((center, i) => ({
                                                     key : String(i),
                                                     center,
                                                     depth : "city",
                                                     start : 0,
                                                     left : 600,
                                                     seed : i + .3,
                                                     ux : 1,
                                                     uy : 0,
                                                     tx : 1,
                                                     ty : 0
                                                   }));
  field.draw(1400, true);
  assert.deepEqual(centres, [ [ 200, 200 ], [ 235, 205 ] ]);
  assert.equal(strokes.length, 6);
  assert.ok(strokes.every(
      ([ color, alpha, width ]) => color === "#899d9e" && alpha > 0 && alpha < .5 && width <= 1));
  field.draw(600 + AFTERGLOW, true);
  assert.equal(strokes.length, 6);
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

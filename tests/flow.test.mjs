import test from "node:test";
import assert from "node:assert/strict";
import {project, under, mercator, latitude, blend, cameraProgress, coversView, framePlacement} from "../src/flow/geometry.js";
import {NavigationChart} from "../src/flow/FlowBasemap.js";
import {AFTERGLOW, envelope, releaseWave, displaceGrain} from "../src/flow/ripples.js";
import {buildImpression, printScale} from "../src/flow/print.js";

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
      overview.map = {draw : () => ({dots : new Float32Array([ 2, 4, 1, 0 ]), labels : []})};
      const city = {x : 118.73, y : mercator(32), span : .78},
            nation = {x : 104.8, y : mercator(36), span : 90};
      for (const [w, h] of [[ 1280, 800 ], [ 390, 740 ]]) {
        const k = w / city.span,
              detailed = {camera : city, width : w * 1.2, height : h * 1.2, k, dots : [ 2, 4, 1, 0 ]};
        for (const t of [0, .05, .2, .6, 1, .72, .3, .02, 0]) {
          const view = blend(city, nation, t), at = framePlacement(detailed, view, w, h);
          const original = {frame : detailed, scale : at.s, x : at.x, y : at.y};
          const shot = overview.select(original, view, w, h, "zh-CN");
          assert.ok(coversView(shot.frame, {s : shot.scale, x : shot.x, y : shot.y}, w, h));
          assert.ok(shot.frame.dots.length);
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

test("the same geographic stencil governs live print grains from country to building scale", () => {
  const width = 240, height = 160;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width / 2; x++) {
      data.set([ 245, 36, 20, 255 ], (y * width + x) * 4);
    }
  for (const k of [14, 96, 2200, 29000, 235000]) {
    const {dots, offsets} = buildImpression(
        {x : 118.733, y : mercator(32.03), span : width / k}, width, height, {data, width, height});
    assert.equal(offsets.at(-1), dots.length / 4);
    assert.ok(dots.length > 500);
    let water = 0;
    for (let i = 0; i < dots.length; i += 4) {
      assert.ok(dots[i] < width / 2 && dots[i + 2] > .25);
      if (dots[i + 3] === 0)
        water++;
    }
    assert.ok(water > dots.length / 12);
  }
});

test("print screens subdivide continuously and remain registered when the viewport pans", () => {
  const k = 2 ** 16 * 5.6 / 360, before = printScale(k * (1 - 1e-8)), after = printScale(k * (1 + 1e-8));
  assert.ok(
      Math.abs(before.step / 2 - after.step) < 1e-12 && before.split > .9999 && after.split < .0001);
  const width = 240, height = 150,
        mask = {width, height, data : new Uint8ClampedArray(width * height * 4).fill(255)};
  const camera = {x : 118.732, y : mercator(32.031), span : width / k};
  const {dots : a} = buildImpression(camera, width, height, mask);
  const {dots : b} = buildImpression({...camera, x : camera.x + 8 / k}, width, height, mask);
  const key = (x, y, ink) => [x.toFixed(2), y.toFixed(2), ink].join("/");
  const moved = new Map();
  for (let i = 0; i < b.length; i += 4)
    moved.set(key(b[i], b[i + 1], b[i + 3]), b[i + 2]);
  let shared = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] < 18 || a[i] > width - 18)
      continue;
    const r = moved.get(key(a[i] - 8, a[i + 1], a[i + 3]));
    if (r != null) {
      shared++;
      assert.ok(Math.abs(r - a[i + 2]) < .002);
    }
  }
  assert.ok(shared > a.length * .17);
});

test("water moves existing grains continuously and combines velocities where fronts meet", () => {
  const a = {x : 40, y : 42, r : 70, ux : .6, uy : .8, alpha : 1, phase : 1.3, seed : .5};
  const b = {...a, x : 78, ux : -.6, phase : 3.2};
  const single = displaceGrain(58, 50, [ a ]), next = displaceGrain(58, 50, [ b ]);
  const both = displaceGrain(58, 50, [ a, b ]);
  assert.ok(Math.hypot(...single) > 1);
  for (const i of [0, 1])
    assert.ok(Math.abs(both[i] - single[i] - next[i]) < 1e-9);
  assert.deepEqual(displaceGrain(160, 150, [ a, b ]), [ 0, 0 ]);
  assert.deepEqual(displaceGrain(58, 50, [ {...a, alpha : 0} ]), [ 0, 0 ]);
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

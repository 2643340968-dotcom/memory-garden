import test from "node:test";
import assert from "node:assert/strict";
import {project, under, mercator, latitude, blend} from "../src/flow/geometry.js";
import {AFTERGLOW, envelope, releaseWave} from "../src/flow/ripples.js";

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

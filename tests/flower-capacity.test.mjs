import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { CONFIG } from "../src/config.js";
import { FlowerSystem } from "../src/flowers/FlowerSystem.js";
import { GroundRaycaster } from "../src/interaction/GroundRaycaster.js";

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;

function createHarness() {
  const camera = new THREE.PerspectiveCamera(
    CONFIG.CAMERA_FOV,
    VIEWPORT_WIDTH / VIEWPORT_HEIGHT,
    CONFIG.CAMERA_NEAR,
    CONFIG.CAMERA_FAR,
  );
  camera.position.set(
    CONFIG.CAMERA_POSITION.x,
    CONFIG.CAMERA_POSITION.y,
    CONFIG.CAMERA_POSITION.z,
  );
  camera.lookAt(
    CONFIG.CAMERA_LOOK_AT.x,
    CONFIG.CAMERA_LOOK_AT.y,
    CONFIG.CAMERA_LOOK_AT.z,
  );
  camera.updateMatrixWorld(true);

  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(0.25, 1, 0.25);
  const meshes = Array.from({ length: 2 }, () => {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial(),
      CONFIG.MAX_FLOWERS,
    );
    mesh.count = 0;
    mesh.userData.instanceCapacity = CONFIG.MAX_FLOWERS;
    return mesh;
  });
  const groundRaycaster = new GroundRaycaster(camera, CONFIG.GROUND_SIZE);
  const viewport = {
    clientWidth: VIEWPORT_WIDTH,
    clientHeight: VIEWPORT_HEIGHT,
  };
  const flowerSystem = new FlowerSystem(
    scene,
    camera,
    { meshes, normalizationScale: CONFIG.FLOWER_BASE_HEIGHT / 0.998046875 },
    groundRaycaster,
    viewport,
  );

  return { flowerSystem, groundRaycaster, meshes };
}

function groundPointAt(groundRaycaster, pixelX, pixelY) {
  const point = new THREE.Vector3();
  assert.equal(
    groundRaycaster.getGroundPointFromPixel(
      pixelX,
      pixelY,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      point,
    ),
    true,
  );
  return point;
}

test("plants blooms across the visible field without occupancy exclusion", () => {
  const { flowerSystem, groundRaycaster, meshes } = createHarness();
  const samples = [
    [180, 430],
    [640, 430],
    [1100, 430],
    [640, 650],
    [640, 500],
    [640, 330],
  ];

  for (const [pixelX, pixelY] of samples) {
    const countBefore = flowerSystem.count;
    flowerSystem.createBloom(groundPointAt(groundRaycaster, pixelX, pixelY), 0);
    assert.ok(flowerSystem.count > countBefore);
  }

  const repeatedPoint = groundPointAt(groundRaycaster, 640, 430);
  const countBeforeOverlap = flowerSystem.count;
  flowerSystem.createBloom(repeatedPoint, 0.2);
  flowerSystem.createBloom(repeatedPoint, 0.4);
  assert.ok(flowerSystem.count > countBeforeOverlap);
  assert.equal(meshes.every((mesh) => mesh.isInstancedMesh), true);

  flowerSystem.update(10);
  const firstBatchMatrix = new THREE.Matrix4();
  const secondBatchMatrix = new THREE.Matrix4();
  meshes[0].getMatrixAt(0, firstBatchMatrix);
  meshes[1].getMatrixAt(0, secondBatchMatrix);
  assert.deepEqual(firstBatchMatrix.elements, secondBatchMatrix.elements);
  assert.ok(flowerSystem.rotationsY[0] >= 0);
  assert.ok(flowerSystem.rotationsY[0] <= Math.PI * 2);
  assert.ok(Math.abs(flowerSystem.tiltsX[0]) <= CONFIG.FLOWER_TILT_MAX);
  assert.ok(Math.abs(flowerSystem.tiltsZ[0]) <= CONFIG.FLOWER_TILT_MAX);
});

test("fills exactly 20,000 slots, logs once, and resets cleanly", () => {
  const { flowerSystem, groundRaycaster, meshes } = createHarness();
  const center = groundPointAt(groundRaycaster, 640, 430);
  const originalInfo = console.info;
  const capacityLogs = [];
  console.info = (...parts) => capacityLogs.push(parts.join(" "));

  try {
    let bloomIndex = 0;
    while (!flowerSystem.isFull() && bloomIndex < 1000) {
      flowerSystem.createBloom(center, bloomIndex * 0.02);
      bloomIndex += 1;
    }

    assert.equal(flowerSystem.count, 20000);
    assert.equal(flowerSystem.isFull(), true);
    assert.deepEqual(meshes.map((mesh) => mesh.count), [20000, 20000]);
    assert.deepEqual(capacityLogs, ["Flower capacity reached: 20000"]);
    assert.equal(flowerSystem.createBloom(center, 100), null);
    assert.deepEqual(capacityLogs, ["Flower capacity reached: 20000"]);

    flowerSystem.update(200);
    assert.equal(flowerSystem.activeFlowerCount, 0);
    flowerSystem.update(201);

    flowerSystem.reset();
    assert.equal(flowerSystem.count, 0);
    assert.equal(flowerSystem.blooms.length, 0);
    assert.equal(flowerSystem.activeFlowerCount, 0);
    assert.deepEqual(meshes.map((mesh) => mesh.count), [0, 0]);
    assert.ok(flowerSystem.createBloom(center, 202));
    assert.ok(flowerSystem.count > 0);
  } finally {
    console.info = originalInfo;
  }
});

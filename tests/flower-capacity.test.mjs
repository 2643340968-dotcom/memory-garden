import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { CONFIG } from "../src/config.js";
import { FlowerSystem } from "../src/flowers/FlowerSystem.js";
import { BloomPatchSystem } from "../src/flowers/BloomPatchSystem.js";
import { BLOOM_PATCH_CONFIG } from "../src/flowers/BloomPatchConfig.js";
import { PNGFlowerRenderer } from "../src/flowers/renderers/PNGFlowerRenderer.js";
import { sampleFlowerImageData } from "../src/flowers/renderers/PNGFlowerParticleSampler.js";
import {
  PNG_FLOWER_CONFIG,
  PNG_SCENE_CONFIG,
} from "../src/flowers/renderers/PNGFlowerConfig.js";
import { GroundRaycaster } from "../src/interaction/GroundRaycaster.js";
import { createGrass } from "../src/scene/createGrass.js";
import { createLights } from "../src/scene/createLights.js";
import { createMemoryPool } from "../src/data/memoryPool.js";
import { MEMORY_UI_CONFIG } from "../src/memory/MemoryExperience.js";

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;

function createHarness(flowerRendererOverrides = {}) {
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
  const flowerRenderer = {
    assetMode: "TEST · 2 BATCH",
    maxFlowers: CONFIG.MAX_FLOWERS,
    normalizationScale: CONFIG.FLOWER_BASE_HEIGHT / 0.998046875,
    addToScene(targetScene) {
      targetScene.add(...meshes);
    },
    setCount(count) {
      meshes.forEach((mesh) => {
        mesh.count = count;
      });
    },
    setMatrixAt(index, matrix) {
      meshes.forEach((mesh) => mesh.setMatrixAt(index, matrix));
    },
    commit() {
      meshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
      });
    },
    reset() {
      this.setCount(0);
      this.commit();
    },
    dispose() {},
    ...flowerRendererOverrides,
  };
  const groundRaycaster = new GroundRaycaster(camera, CONFIG.GROUND_SIZE);
  const viewport = {
    clientWidth: VIEWPORT_WIDTH,
    clientHeight: VIEWPORT_HEIGHT,
  };
  const flowerSystem = new FlowerSystem(
    scene,
    camera,
    flowerRenderer,
    groundRaycaster,
    viewport,
  );

  return { flowerSystem, flowerRenderer, groundRaycaster, meshes };
}

function createPNGTextureRecords(disposeCounts) {
  return PNG_FLOWER_CONFIG.PNG_FLOWER_PATHS.map((path, index) => {
    const texture = new THREE.Texture();
    texture.addEventListener("dispose", () => {
      disposeCounts[index] += 1;
    });
    return {
      path,
      texture,
      textureWidth: 887,
      textureHeight: 1774,
    };
  });
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

test("PNG renderer uses five bottom-anchored batches and keeps textures on reset", () => {
  const disposeCounts = Array(5).fill(0);
  const pngRenderer = new PNGFlowerRenderer(
    createPNGTextureRecords(disposeCounts),
  );
  const matrix = new THREE.Matrix4();
  let seed = 0x7f4a7c15;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  assert.equal(pngRenderer.summary.variantCount, 5);
  assert.equal(pngRenderer.summary.batchCount, 5);
  assert.equal(pngRenderer.summary.drawCalls, 5);
  assert.equal(pngRenderer.summary.cardMode, "single");
  assert.equal(pngRenderer.particleSampleSets.length, 5);
  assert.equal(
    pngRenderer.particleSampleSets.every(
      (sampleSet) => sampleSet.source === "fallback",
    ),
    true,
  );
  assert.equal(pngRenderer.fieldConfig.maxFlowers, PNG_FLOWER_CONFIG.MAX_FLOWERS);
  assert.equal(
    pngRenderer.fieldConfig.flowersPerBloomMin,
    PNG_FLOWER_CONFIG.FLOWERS_PER_BLOOM_MIN,
  );
  assert.equal(
    pngRenderer.fieldConfig.flowersPerBloomMax,
    PNG_FLOWER_CONFIG.FLOWERS_PER_BLOOM_MAX,
  );
  assert.equal(pngRenderer.meshes.every((mesh) => mesh.isInstancedMesh), true);
  assert.equal(pngRenderer.materials.every((material) => material.transparent), true);
  assert.equal(
    pngRenderer.materials.every(
      (material) => material.alphaTest === PNG_FLOWER_CONFIG.FLOWER_ALPHA_TEST,
    ),
    true,
  );
  assert.equal(
    pngRenderer.materials.every(
      (material) => material.color.getHex() === PNG_FLOWER_CONFIG.FLOWER_TINT,
    ),
    true,
  );

  pngRenderer.geometries.forEach((geometry) => {
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(Math.abs(geometry.boundingBox.min.y) < 1e-7);
    assert.ok(
      Math.abs(geometry.boundingBox.max.y - PNG_FLOWER_CONFIG.FLOWER_CARD_HEIGHT) <
        1e-7,
    );
    assert.ok(Math.abs(size.x / size.y - 0.5) < 1e-7);
  });

  for (let index = 0; index < 1000; index += 1) {
    pngRenderer.allocateInstance(index, random);
    pngRenderer.setMatrixAt(index, matrix);
    pngRenderer.setCount(index + 1);
  }
  assert.equal(
    pngRenderer.batchCounts.reduce((sum, count) => sum + count, 0),
    1000,
  );
  assert.equal(pngRenderer.batchCounts.every((count) => count > 0), true);
  assert.deepEqual(
    pngRenderer.meshes.map((mesh) => mesh.count),
    [...pngRenderer.batchCounts],
  );

  const translatedMatrix = new THREE.Matrix4().makeTranslation(2, 3, 4);
  const retrievedMatrix = new THREE.Matrix4();
  pngRenderer.setMatrixAt(0, translatedMatrix);
  assert.equal(pngRenderer.getMatrixAt(0, retrievedMatrix), true);
  assert.deepEqual(retrievedMatrix.elements, translatedMatrix.elements);
  assert.ok(pngRenderer.getVariantIndex(0) >= 0);
  assert.ok(
    pngRenderer.getParticleSampleSet(pngRenderer.getVariantIndex(0)).samples
      .length > 0,
  );

  const visualColor = new THREE.Color();
  const visualVariant = pngRenderer.variantAssignments[0];
  const visualLocalIndex = pngRenderer.localIndices[0];
  const visualMesh = pngRenderer.variantBatches[visualVariant].meshes[0];
  const visualOpacity = visualMesh.geometry.getAttribute("instanceOpacity");
  pngRenderer.setVitalityAt(0, 1, 0.04, 0.05, 0);
  assert.ok(visualOpacity.getX(visualLocalIndex) < 0.01);
  pngRenderer.setVitalityAt(0, 1, 1, 1.5, 0);
  assert.ok(visualOpacity.getX(visualLocalIndex) > 0.99);
  visualMesh.getColorAt(visualLocalIndex, visualColor);
  assert.ok(visualColor.r > 0.95);
  pngRenderer.setVitalityAt(0, 0.26, 1);
  assert.ok(
    visualOpacity.getX(visualLocalIndex) >= 0.05 &&
      visualOpacity.getX(visualLocalIndex) <= 0.1,
  );

  const releasedVariant = pngRenderer.variantAssignments[0];
  const releasedLocalIndex = pngRenderer.localIndices[0];
  assert.equal(pngRenderer.releaseInstance(0), true);
  const selectReleasedVariant = () =>
    (releasedVariant + 0.25) / pngRenderer.variantBatches.length;
  pngRenderer.allocateInstance(1001, selectReleasedVariant);
  assert.equal(pngRenderer.variantAssignments[1001], releasedVariant);
  assert.equal(pngRenderer.localIndices[1001], releasedLocalIndex);
  assert.equal(pngRenderer.releaseInstance(0), false);

  pngRenderer.reset();
  assert.equal(pngRenderer.globalCount, 0);
  assert.deepEqual([...pngRenderer.batchCounts], [0, 0, 0, 0, 0]);
  assert.deepEqual(pngRenderer.meshes.map((mesh) => mesh.count), [0, 0, 0, 0, 0]);
  assert.deepEqual(disposeCounts, [0, 0, 0, 0, 0]);

  pngRenderer.dispose();
  assert.deepEqual(disposeCounts, [1, 1, 1, 1, 1]);
});

test("PNG alpha sampling keeps flower-body particles inside the visible silhouette", () => {
  const width = 9;
  const height = 9;
  const data = new Uint8ClampedArray(width * height * 4);
  const visiblePixels = new Set();
  const paint = (x, y, red, green, blue, alpha = 255) => {
    const offset = (y * width + x) * 4;
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = alpha;
    visiblePixels.add(`${x},${y}`);
  };

  for (let y = 1; y <= 7; y += 1) {
    paint(4, y, 152, 116, 229);
  }
  for (let x = 1; x <= 7; x += 1) {
    paint(x, 3, 166, 130, 238);
  }
  paint(4, 3, 236, 222, 92);

  let seed = 0x514f2a17;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const sampleSet = sampleFlowerImageData(
    { data, width, height },
    { sampleCount: 80, cardWidth: 0.5, cardHeight: 1, random },
  );

  assert.equal(sampleSet.source, "png-alpha");
  assert.equal(sampleSet.samples.length, 80);
  assert.equal(sampleSet.visiblePixelCount, visiblePixels.size);
  assert.equal(
    sampleSet.samples.every((sample) => {
      const x = Math.floor(sample.u * width);
      const y = Math.floor(sample.v * height);
      return visiblePixels.has(`${x},${y}`);
    }),
    true,
  );
  assert.equal(Math.floor(sampleSet.center.u * width), 4);
  assert.equal(Math.floor(sampleSet.center.v * height), 3);
  assert.ok(sampleSet.samples.some((sample) => sample.edge > 0.18));
  assert.ok(sampleSet.samples.every((sample) => sample.alpha >= 0.16));
  assert.ok(sampleSet.samples.every((sample) => sample.color.length === 3));
  assert.ok(sampleSet.center.center > 0.5);
});

test("flower-body particle quality and performance controls remain centralized", () => {
  assert.equal(BLOOM_PATCH_CONFIG.PARTICLE_POOL_CAPACITY, 12288);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_SAMPLE_LIBRARY_SIZE, 512);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_SAMPLE_COUNT, 40);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_ACTIVE_RATIO, 0.9);
  assert.equal(BLOOM_PATCH_CONFIG.ACTIVE_PATCH_ENHANCED_RATIO, 0.48);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_CENTER_EMPHASIS, 1.6);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_IDLE_OPACITY, 0.16);
  assert.ok(BLOOM_PATCH_CONFIG.PATCH_GLOW_INTENSITY < 0.05);
  assert.equal("BLOOM_PARTICLE_COUNT" in BLOOM_PATCH_CONFIG, false);
});

test("camera-facing cards keep their root fixed and limit yaw and tilt", () => {
  const transformConfig = {
    orientationMode: "camera-facing",
    scaleMin: PNG_FLOWER_CONFIG.FLOWER_SCALE_MIN,
    scaleMax: PNG_FLOWER_CONFIG.FLOWER_SCALE_MAX,
    yawMax: PNG_FLOWER_CONFIG.FLOWER_YAW_MAX,
    tiltMax: PNG_FLOWER_CONFIG.FLOWER_TILT_MAX,
    mirrorProbability: 0,
    startYOffset: 0,
  };
  const { flowerSystem, meshes } = createHarness({ transformConfig });
  const centeredRandom = () => 0.5;

  assert.equal(
    flowerSystem.spawnFlower(0, 0, 0, 1, 0, centeredRandom),
    true,
  );
  flowerSystem.update(0);

  assert.ok(Math.abs(flowerSystem.rotationsY[0]) <= transformConfig.yawMax);
  assert.ok(Math.abs(flowerSystem.tiltsX[0]) <= transformConfig.tiltMax);
  assert.ok(Math.abs(flowerSystem.tiltsZ[0]) <= transformConfig.tiltMax);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  meshes[0].getMatrixAt(0, matrix);
  matrix.decompose(position, quaternion, scale);
  assert.ok(Math.abs(position.y - 0.012) < 1e-7);
});

test("PNG visual tuning remains isolated from the model defaults", () => {
  assert.deepEqual(
    [PNG_FLOWER_CONFIG.FLOWERS_PER_BLOOM_MIN, PNG_FLOWER_CONFIG.FLOWERS_PER_BLOOM_MAX],
    [22, 34],
  );
  assert.deepEqual(
    [CONFIG.FLOWERS_PER_BLOOM_MIN, CONFIG.FLOWERS_PER_BLOOM_MAX],
    [32, 48],
  );

  const pngSceneConfig = {
    ...CONFIG,
    ...PNG_SCENE_CONFIG,
    FOG: { ...CONFIG.FOG, ...PNG_SCENE_CONFIG.FOG },
  };
  const pngScene = new THREE.Scene();
  const pngGrass = createGrass(pngScene, pngSceneConfig);
  const modelScene = new THREE.Scene();
  const modelGrass = createGrass(modelScene);
  const pngLights = createLights(pngScene, pngSceneConfig);
  const modelLights = createLights(modelScene);

  assert.equal(pngGrass.count, PNG_SCENE_CONFIG.GRASS_COUNT);
  assert.equal(pngGrass.geometry.getAttribute("position").count, 5);
  assert.equal(pngGrass.material.opacity, PNG_SCENE_CONFIG.GRASS_OPACITY);
  assert.equal(modelGrass.count, CONFIG.GRASS_COUNT);
  assert.equal(modelGrass.geometry.getAttribute("position").count, 4);
  assert.equal(modelGrass.material.opacity, 1);
  assert.equal(pngLights.overheadGlow.isSpotLight, true);
  assert.equal(pngLights.overheadGlow.castShadow, false);
  assert.equal(
    pngLights.overheadGlow.intensity,
    PNG_SCENE_CONFIG.LIGHTING.overheadGlow.intensity,
  );
  assert.equal(modelLights.overheadGlow, null);
  assert.equal(modelLights.hemisphere.intensity, 2.45);
  assert.equal(modelLights.sunlight.intensity, 2.2);

  pngGrass.geometry.dispose();
  pngGrass.material.dispose();
  modelGrass.geometry.dispose();
  modelGrass.material.dispose();
});

test("BloomEvents can carry a memory id and notify one lightweight listener", () => {
  const { flowerSystem, groundRaycaster } = createHarness();
  const center = groundPointAt(groundRaycaster, 640, 430);
  const observed = [];
  const unsubscribe = flowerSystem.onBloomCreated((bloomEvent) => {
    observed.push(bloomEvent);
  });

  const bloomEvent = flowerSystem.createBloom(center, 0, {
    memoryId: "session-memory-1",
  });
  assert.equal(bloomEvent.memoryId, "session-memory-1");
  assert.equal(bloomEvent.flowerIndices.length, bloomEvent.flowerCount);
  assert.equal(bloomEvent.flowerIndices[0], bloomEvent.firstFlowerIndex);
  assert.deepEqual(observed, [bloomEvent]);

  unsubscribe();
  flowerSystem.createBloom(center, 1);
  assert.equal(observed.length, 1);
});

test("BloomPatch lifecycle respects minimum age and recycles released flower slots", () => {
  const releasedIndices = [];
  const { flowerSystem, flowerRenderer, groundRaycaster } = createHarness({
    releaseInstance(index) {
      releasedIndices.push(index);
      return true;
    },
  });
  const particleEvents = { births: 0, decays: 0, updates: 0 };
  const particleSystem = {
    activeParticleCount: 0,
    spawnBirth() {
      particleEvents.births += 1;
    },
    spawnDecay() {
      particleEvents.decays += 1;
    },
    update() {
      particleEvents.updates += 1;
    },
    setPixelRatio() {},
    reset() {},
    dispose() {},
  };
  const lifecycleConfig = {
    ...BLOOM_PATCH_CONFIG,
    ATTENTION_DECAY_RATE: 1,
    ATTENTION_GRACE_DURATION: 1,
    DECAY_DURATION: 2,
  };
  const patchSystem = new BloomPatchSystem({
    scene: flowerSystem.scene,
    renderer: flowerRenderer,
    flowerSystem,
    config: lifecycleConfig,
    particleSystem,
  });
  const center = groundPointAt(groundRaycaster, 640, 430);
  const firstBloom = flowerSystem.createBloom(center, 0);
  const originalIndices = new Set(firstBloom.flowerIndices);

  assert.equal(patchSystem.patches.length, 1);
  assert.equal(patchSystem.patches[0].state, "growing");
  assert.equal(particleEvents.births, 1);

  patchSystem.update(BLOOM_PATCH_CONFIG.MIN_PATCH_LIFETIME - 0.1, 1, null);
  assert.notEqual(patchSystem.patches[0].state, "decaying");

  patchSystem.update(BLOOM_PATCH_CONFIG.MIN_PATCH_LIFETIME + 0.1, 1, null);
  assert.equal(patchSystem.patches[0].state, "decaying");
  assert.equal(particleEvents.decays, 1);

  patchSystem.update(
    BLOOM_PATCH_CONFIG.MIN_PATCH_LIFETIME + lifecycleConfig.DECAY_DURATION + 0.2,
    lifecycleConfig.DECAY_DURATION,
    null,
  );
  assert.equal(patchSystem.patches.length, 0);
  assert.equal(flowerSystem.count, 0);
  assert.equal(flowerSystem.blooms.length, 0);
  assert.equal(releasedIndices.length, firstBloom.flowerCount);

  const secondBloom = flowerSystem.createBloom(center, 20);
  assert.ok(secondBloom.flowerIndices.some((index) => originalIndices.has(index)));
  assert.ok(particleEvents.updates >= 3);
  patchSystem.dispose();
});

test("soft cursor attention keeps an old BloomPatch alive", () => {
  const { flowerSystem, flowerRenderer, groundRaycaster } = createHarness({
    releaseInstance() {
      return true;
    },
  });
  const particleSystem = {
    activeParticleCount: 0,
    spawnBirth() {},
    spawnDecay() {
      assert.fail("An attended patch should not begin decay.");
    },
    update() {},
    setPixelRatio() {},
    reset() {},
    dispose() {},
  };
  const patchSystem = new BloomPatchSystem({
    scene: flowerSystem.scene,
    renderer: flowerRenderer,
    flowerSystem,
    config: {
      ...BLOOM_PATCH_CONFIG,
      ATTENTION_DECAY_RATE: 1,
      ATTENTION_GRACE_DURATION: 1,
    },
    particleSystem,
  });
  const center = groundPointAt(groundRaycaster, 640, 430);
  flowerSystem.createBloom(center, 0);

  patchSystem.update(20, 20, center.clone().add(new THREE.Vector3(0.5, 0, 0)));
  assert.equal(patchSystem.patches[0].state, "alive");
  assert.equal(patchSystem.patches[0].attention, 1);
  assert.equal(patchSystem.patches[0].lastAttentionTime, 20);
  patchSystem.dispose();
});

test("memory pool stores session input and avoids immediate echo repetition", () => {
  const memoryPool = createMemoryPool();
  const visitorMemory = memoryPool.addSessionMemory("  一段被保留的记忆。  ");

  assert.equal(visitorMemory.text, "一段被保留的记忆。");
  assert.equal(visitorMemory.label, "YOUR MEMORY");
  assert.deepEqual(memoryPool.sessionMemories, [visitorMemory]);
  assert.equal(memoryPool.getById(visitorMemory.id), visitorMemory);

  const firstEcho = memoryPool.selectEcho(() => 0);
  const secondEcho = memoryPool.selectEcho(() => 0);
  assert.notEqual(secondEcho.id, firstEcho.id);
});

test("memory gesture rhythm keeps its public tuning limits centralized", () => {
  assert.equal(MEMORY_UI_CONFIG.MAX_MEMORIES_PER_GESTURE, 3);
  assert.equal(MEMORY_UI_CONFIG.MAX_ACTIVE_MEMORY_CARDS, 3);
  assert.deepEqual(
    [
      MEMORY_UI_CONFIG.FIRST_MEMORY_ECHO_BLOOMS_MIN,
      MEMORY_UI_CONFIG.FIRST_MEMORY_ECHO_BLOOMS_MAX,
    ],
    [1, 1],
  );
  assert.deepEqual(
    [
      MEMORY_UI_CONFIG.MEMORY_ECHO_BLOOMS_MIN,
      MEMORY_UI_CONFIG.MEMORY_ECHO_BLOOMS_MAX,
    ],
    [2, 3],
  );
  assert.equal(MEMORY_UI_CONFIG.MEMORY_CARD_VISIBLE_DURATION, 4200);
  assert.equal(MEMORY_UI_CONFIG.MEMORY_CARD_FADE_DURATION, 700);
});

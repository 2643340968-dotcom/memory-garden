import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
import {
  createMemoryItem,
  createMemoryPool,
  AUDIO_ARCHIVE_MEMORIES,
  IMAGE_ARCHIVE_MEMORIES,
  isAudioPresentation,
  MEMORY_ITEM_SCHEMA_FIELDS,
  MEMORY_KINDS,
  MEMORY_RELATIONSHIPS,
  MEMORY_SELECTION_CONFIG,
  MEMORY_TYPES,
  TEXT_PROTOTYPE_DRAFTS_REQUIRING_TRANSLATION,
} from "../src/data/memoryPool.js";
import {
  MEMORY_UI_CONFIG,
  getMemoryEchoLabel,
  getMemoryCardUpperBand,
} from "../src/memory/MemoryExperience.js";
import {
  createMemoryCardElement,
  formatAudioDuration,
  getMemoryCardViewModel,
} from "../src/memory/MemoryCardRenderer.js";
import {
  getMemoryImageUrls,
  MemoryImagePreloader,
} from "../src/memory/MemoryAssetPreloader.js";
import { BloomParticleSystem } from "../src/effects/BloomParticleSystem.js";
import { estimatePNGBloomWork } from "../src/effects/PNGBloomPipeline.js";
import {
  AirborneFlowerSystem,
  AIRBORNE_FLOWER_CONFIG,
  getAirborneParticleBudget,
} from "../src/effects/AirborneFlowerSystem.js";
import {
  AUDIO_CONFIG,
  getBGMTargetVolume,
  getVoiceCardVisibleDuration,
} from "../src/audio/AudioConfig.js";

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

function createParticleHarness(particleConfigOverrides = {}) {
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
  const disposeCounts = Array(5).fill(0);
  const flowerRenderer = new PNGFlowerRenderer(
    createPNGTextureRecords(disposeCounts),
  );
  const groundRaycaster = new GroundRaycaster(camera, CONFIG.GROUND_SIZE);
  const flowerSystem = new FlowerSystem(
    scene,
    camera,
    flowerRenderer,
    groundRaycaster,
    { clientWidth: VIEWPORT_WIDTH, clientHeight: VIEWPORT_HEIGHT },
  );
  const particleSystem = new BloomParticleSystem(
    scene,
    { getPixelRatio: () => 1 },
    flowerSystem,
    {
      ...BLOOM_PATCH_CONFIG,
      PARTICLE_POOL_CAPACITY: 8192,
      FLOWER_PARTICLE_SAMPLE_COUNT: 16,
      FLOWER_PARTICLE_ACTIVE_RATIO: 1,
      ...particleConfigOverrides,
    },
  );

  return {
    camera,
    scene,
    flowerRenderer,
    flowerSystem,
    groundRaycaster,
    particleSystem,
    dispose() {
      particleSystem.dispose();
      flowerRenderer.dispose();
    },
  };
}

function createPatchFromBloom(bloomEvent, id = "particle-test-patch") {
  return {
    id,
    center: bloomEvent.anchorPosition.clone(),
    flowerIndices: bloomEvent.flowerIndices,
    birthTime: bloomEvent.startTime,
    attention: 1,
    attended: false,
    state: "alive",
    decayStartTime: null,
    bloomEvent,
  };
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
  assert.ok(
    visualOpacity.getX(visualLocalIndex) >= 0.1 &&
      visualOpacity.getX(visualLocalIndex) <= 0.12,
  );
  visualMesh.getColorAt(visualLocalIndex, visualColor);
  assert.ok(visualColor.r > 0.95);
  pngRenderer.setVitalityAt(0, 0.26, 1);
  assert.ok(
    visualOpacity.getX(visualLocalIndex) > 0 &&
      visualOpacity.getX(visualLocalIndex) < 0.01,
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
  const stableSamplesPerFlower = Math.round(
    BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_SAMPLE_COUNT *
      BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_ACTIVE_RATIO,
  );
  const largestPatchSlotDemand =
    PNG_FLOWER_CONFIG.FLOWERS_PER_BLOOM_MAX *
      (stableSamplesPerFlower + 1) +
    1;

  assert.equal(BLOOM_PATCH_CONFIG.PARTICLE_POOL_CAPACITY, 262144);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_SAMPLE_LIBRARY_SIZE, 1024);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_SAMPLE_COUNT, 128);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_ACTIVE_RATIO, 0.88);
  assert.equal(BLOOM_PATCH_CONFIG.ACTIVE_PATCH_ENHANCED_RATIO, 1);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_CENTER_EMPHASIS, 1.8);
  assert.equal(BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_IDLE_OPACITY, 0.76);
  assert.equal(stableSamplesPerFlower, 113);
  assert.ok(
    BLOOM_PATCH_CONFIG.PARTICLE_POOL_CAPACITY > largestPatchSlotDemand * 32,
  );
  assert.ok(BLOOM_PATCH_CONFIG.FLOWER_CARD_MAX_VISIBILITY <= 0.12);
  assert.ok(BLOOM_PATCH_CONFIG.PATCH_GLOW_INTENSITY < 0.01);
  assert.ok(BLOOM_PATCH_CONFIG.BLOOM_THRESHOLD > 1);
  assert.equal("BLOOM_PARTICLE_COUNT" in BLOOM_PATCH_CONFIG, false);
});

test("flower particles animate analytically without per-particle CPU frame updates", () => {
  const harness = createParticleHarness();
  const {
    flowerSystem,
    groundRaycaster,
    particleSystem,
  } = harness;

  try {
    const center = groundPointAt(groundRaycaster, 640, 430);
    const bloomEvent = flowerSystem.createBloom(center, 0);
    flowerSystem.update(1);
    const patch = createPatchFromBloom(bloomEvent);

    particleSystem.spawnBirth(patch);
    particleSystem.resetFrameDiagnostics();
    particleSystem.syncPatch(patch, flowerSystem, 1);
    particleSystem.update(1);

    const effect = particleSystem.effects.get(patch.id);
    const expectedPointCount =
      bloomEvent.flowerCount * (effect.samplesPerFlower + 1);
    assert.equal(particleSystem.activeParticleCount, expectedPointCount);
    assert.equal(
      effect.slots.every(
        (slot) => {
          const pointKind = particleSystem.identityData[slot * 4];
          return pointKind === 0 || pointKind === 1;
        },
      ),
      true,
    );
    assert.equal(
      particleSystem.points.userData.motion,
      "analytic-vertex-shader",
    );
    assert.equal(
      particleSystem.points.userData.patchAura,
      "distributed-center-bloom",
    );
    assert.match(particleSystem.material.vertexShader, /uFlowerMatrices/);
    assert.match(particleSystem.material.vertexShader, /uPatchStates/);
    assert.match(particleSystem.material.vertexShader, /aDecayPosition/);
    assert.ok(particleSystem.staticAttributes.length <= 8);
    assert.equal(particleSystem.geometry.getAttribute("aAlpha"), undefined);
    assert.equal(particleSystem.geometry.getAttribute("aSize"), undefined);

    const staticVersions = new Map(
      particleSystem.staticAttributes.map(({ name, attribute }) => [
        name,
        attribute.version,
      ]),
    );
    particleSystem.resetFrameDiagnostics();
    patch.attention = 0.62;
    patch.attended = true;
    particleSystem.syncPatch(patch, flowerSystem, 2);
    particleSystem.update(2);

    assert.equal(particleSystem.material.uniforms.uTime.value, 2);
    assert.equal(
      particleSystem.diagnostics.particleCpuUpdatesPerFrame,
      0,
    );
    assert.equal(
      particleSystem.diagnostics.flowerMatrixUpdatesPerFrame,
      bloomEvent.flowerCount,
    );
    assert.equal(particleSystem.diagnostics.patchStateUpdatesPerFrame, 1);
    particleSystem.staticAttributes.forEach(({ name, attribute }) => {
      assert.equal(attribute.version, staticVersions.get(name));
    });

    patch.state = "decaying";
    patch.decayStartTime = 3;
    particleSystem.spawnDecay(patch, flowerSystem, 3);
    particleSystem.update(3);
    const decayVersion = particleSystem.geometry.getAttribute(
      "aDecayPosition",
    ).version;
    particleSystem.resetFrameDiagnostics();
    particleSystem.syncPatch(patch, flowerSystem, 3.5);
    particleSystem.update(3.5);
    assert.equal(
      particleSystem.geometry.getAttribute("aDecayPosition").version,
      decayVersion,
    );

    const previousSlots = new Set(effect.slots);
    const previousGenerations = new Map(
      effect.slots.map((slot) => [slot, particleSystem.slotGenerations[slot]]),
    );
    particleSystem.releasePatch(patch.id);
    particleSystem.update(4);
    assert.equal(particleSystem.activeParticleCount, 0);

    const reusedPatch = createPatchFromBloom(
      bloomEvent,
      "particle-test-patch-reused",
    );
    reusedPatch.birthTime = 5;
    particleSystem.spawnBirth(reusedPatch);
    const reusedEffect = particleSystem.effects.get(reusedPatch.id);
    const reusedSlots = reusedEffect.slots.filter((slot) =>
      previousSlots.has(slot),
    );
    assert.ok(reusedSlots.length > 0);
    assert.equal(
      reusedSlots.every(
        (slot) =>
          particleSystem.slotGenerations[slot] >
          previousGenerations.get(slot),
      ),
      true,
    );
  } finally {
    harness.dispose();
  }
});

test("PNG bloom budget exposes the full-scene HDR cost and viewport gate", () => {
  const desktopBudget = estimatePNGBloomWork(1280, 720, 1);
  assert.equal(desktopBudget.eligible, true);
  assert.equal(desktopBudget.levels.length, 5);
  assert.equal(desktopBudget.fullscreenDraws, 12);
  assert.ok(desktopBudget.internalBytes > 0);
  assert.ok(desktopBudget.deepestMinimumDimension >= 16);

  const tinyBudget = estimatePNGBloomWork(20, 20, 1);
  assert.equal(tinyBudget.eligible, false);
  assert.ok(tinyBudget.deepestMinimumDimension < 16);
});

test("airborne flower fragments are empty initially and respond only to memory events", () => {
  const budget = getAirborneParticleBudget();
  assert.equal(AIRBORNE_FLOWER_CONFIG.particleCapacity, 512);
  assert.equal(budget.particleCapacity, 512);
  assert.equal(budget.drawCalls, 1);
  assert.equal(budget.motionMode, "analytic-event-driven");
  assert.equal(budget.initialActiveParticleCount, 0);
  assert.deepEqual(budget.triggerTypes, ["bloom", "memory", "decay"]);
  assert.equal(budget.maximumParticlesPerEvent, 44);

  const harness = createParticleHarness();
  let decayListener = null;
  const fragmentSystem = new AirborneFlowerSystem({
    scene: harness.scene,
    camera: harness.camera,
    renderer: { getPixelRatio: () => 1 },
    flowerRenderer: harness.flowerRenderer,
    flowerSystem: harness.flowerSystem,
    bloomPatchSystem: {
      onPatchDecay(listener) {
        decayListener = listener;
        return () => {
          decayListener = null;
        };
      },
    },
  });

  try {
    assert.equal(fragmentSystem.points.visible, false);
    assert.equal(fragmentSystem.diagnostics.particleCount, 0);
    assert.deepEqual(fragmentSystem.diagnostics.eventCounts, {
      bloom: 0,
      memory: 0,
      decay: 0,
    });

    const center = groundPointAt(harness.groundRaycaster, 640, 430);
    harness.flowerSystem.createBloom(center, 1);
    fragmentSystem.update(1.1);
    assert.ok(fragmentSystem.diagnostics.particleCount > 0);
    assert.equal(fragmentSystem.diagnostics.eventCounts.bloom, 1);

    fragmentSystem.emitMemory(center, 1.2, { horizontalBias: 0.5 });
    decayListener({ center }, 1.3);
    assert.equal(fragmentSystem.diagnostics.eventCounts.memory, 1);
    assert.equal(fragmentSystem.diagnostics.eventCounts.decay, 1);
    assert.equal(fragmentSystem.points.userData.decorative, false);
    assert.equal(fragmentSystem.material.depthTest, true);
    assert.equal(fragmentSystem.material.depthWrite, false);

    fragmentSystem.update(20);
    assert.equal(fragmentSystem.points.visible, false);
    assert.equal(fragmentSystem.diagnostics.particleCount, 0);
    fragmentSystem.reset();
    assert.equal(fragmentSystem.diagnostics.particleCount, 0);
  } finally {
    fragmentSystem.dispose();
    harness.dispose();
  }
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
  assert.equal(visitorMemory.type, MEMORY_TYPES.TEXT);
  assert.equal(visitorMemory.label, "YOUR MEMORY");
  assert.equal(visitorMemory.audio, null);
  assert.equal(visitorMemory.audioId, null);
  assert.equal(visitorMemory.audioType, null);
  assert.equal(visitorMemory.audioCaption, null);
  assert.equal(visitorMemory.verified, false);
  assert.equal(visitorMemory.isPrototype, false);
  assert.deepEqual(memoryPool.sessionMemories, [visitorMemory]);
  assert.equal(memoryPool.getById(visitorMemory.id), visitorMemory);

  const firstEcho = memoryPool.selectEcho(() => 0);
  const secondEcho = memoryPool.selectEcho(() => 0);
  assert.notEqual(secondEcho.id, firstEcho.id);
});

test("memory schema keeps independent archives separate and permits verified pairs", () => {
  const memoryPool = createMemoryPool();
  const prototypeTypes = new Set(
    memoryPool.prototypeMemories.map((memory) => memory.type),
  );
  assert.deepEqual(
    [...prototypeTypes].sort(),
    [MEMORY_TYPES.AUDIO, MEMORY_TYPES.IMAGE].sort(),
  );
  assert.equal(TEXT_PROTOTYPE_DRAFTS_REQUIRING_TRANSLATION.length, 4);
  TEXT_PROTOTYPE_DRAFTS_REQUIRING_TRANSLATION.forEach((draft) => {
    assert.equal(draft.originalLanguage, "zh-CN");
    assert.equal(
      draft.translationStatus,
      "requires-verified-English-translation",
    );
    assert.match(draft.originalText, /[\u3400-\u9fff]/u);
  });
  assert.deepEqual(MEMORY_ITEM_SCHEMA_FIELDS, [
    "id",
    "type",
    "kind",
    "label",
    "text",
    "image",
    "caption",
    "date",
    "location",
    "source",
    "sourceUrl",
    "audio",
    "audioId",
    "audioType",
    "audioCaption",
    "audioSource",
    "audioSourceUrl",
    "isQuote",
    "verified",
    "isPrototype",
    "relationship",
  ]);

  const imageMemory = memoryPool.prototypeMemories.find(
    (memory) => memory.type === MEMORY_TYPES.IMAGE,
  );
  const imageViewModel = getMemoryCardViewModel(
    imageMemory,
    "MEMORY · 007",
  );
  assert.equal(imageViewModel.type, MEMORY_TYPES.IMAGE);
  assert.match(imageViewModel.image, /nanjing-memory-\d+\.jpg$/);
  assert.equal(imageViewModel.caption, "");
  assert.equal(imageViewModel.metadata, "");
  assert.equal(imageViewModel.sourceLabel, "");
  assert.equal(imageViewModel.label, "MEMORY · 007");
  assert.equal(imageViewModel.verified, false);
  assert.equal(imageViewModel.isPrototype, false);
  assert.equal(imageViewModel.kind, MEMORY_KINDS.IMAGE_ARCHIVE);
  assert.equal(
    imageViewModel.relationship,
    MEMORY_RELATIONSHIPS.INDEPENDENT,
  );
  assert.equal(imageViewModel.hasAudio, false);

  const textMemory = memoryPool.addSessionMemory("一段文字记忆。");
  const textViewModel = getMemoryCardViewModel(textMemory);
  assert.equal(textViewModel.type, MEMORY_TYPES.TEXT);
  assert.equal(textViewModel.kind, MEMORY_KINDS.TEXT_MEMORY);
  assert.equal(textViewModel.text, "一段文字记忆。");
  assert.equal(textViewModel.image, "");
  assert.equal(
    textViewModel.relationship,
    MEMORY_RELATIONSHIPS.INDEPENDENT,
  );
  const defaultSelections = Array.from({ length: 3 }, () =>
    memoryPool.selectEcho(() => 0),
  );
  assert.deepEqual(
    [...new Set(defaultSelections.map((memory) => memory.type))].sort(),
    [MEMORY_TYPES.AUDIO, MEMORY_TYPES.IMAGE, MEMORY_TYPES.TEXT].sort(),
  );

  assert.equal(IMAGE_ARCHIVE_MEMORIES.length, 21);
  assert.equal(AUDIO_ARCHIVE_MEMORIES.length, 10);
  IMAGE_ARCHIVE_MEMORIES.forEach((memory) => {
    assert.equal(memory.kind, MEMORY_KINDS.IMAGE_ARCHIVE);
    assert.equal(memory.relationship, MEMORY_RELATIONSHIPS.INDEPENDENT);
    assert.equal(memory.audio, null);
    assert.equal(memory.caption, null);
    assert.equal(memory.source, null);
    assert.equal(memory.verified, false);
    assert.equal(memory.isPrototype, false);
    assert.equal(
      existsSync(
        new URL(`../public/${memory.image.replace("./", "")}`, import.meta.url),
      ),
      true,
    );
  });
  AUDIO_ARCHIVE_MEMORIES.forEach((memory) => {
    assert.equal(memory.kind, MEMORY_KINDS.AUDIO_ARCHIVE);
    assert.equal(memory.relationship, MEMORY_RELATIONSHIPS.INDEPENDENT);
    assert.equal(memory.image, null);
    assert.equal(memory.text, null);
    assert.equal(memory.audioCaption, null);
    assert.equal(memory.audioSource, null);
    assert.equal(memory.verified, false);
    assert.equal(memory.isPrototype, false);
    assert.equal(
      existsSync(
        new URL(`../public/${memory.audio.replace("./", "")}`, import.meta.url),
      ),
      true,
    );
  });

  const independentAudio = createMemoryItem({
    id: "independent-audio-fixture",
    kind: MEMORY_KINDS.AUDIO_ARCHIVE,
    audio: "./assets/memories/audio/voice_001.mp3",
    audioId: "voice_001",
    audioType: "voice",
    audioCaption: "Archive excerpt",
    audioSource: "Verified audio archive",
    audioSourceUrl: "https://archive.example/audio/001",
    verified: true,
    isPrototype: false,
  });
  const audioViewModel = getMemoryCardViewModel(independentAudio);
  assert.equal(audioViewModel.type, MEMORY_TYPES.AUDIO);
  assert.equal(audioViewModel.isAudioOnly, true);
  assert.equal(audioViewModel.image, "");
  assert.equal(audioViewModel.text, "");
  assert.equal(
    audioViewModel.sourceLabel,
    "AUDIO SOURCE · Verified audio archive",
  );
  assert.equal(audioViewModel.relationship, MEMORY_RELATIONSHIPS.INDEPENDENT);
  assert.equal(isAudioPresentation(independentAudio), true);
  assert.equal(getMemoryEchoLabel(independentAudio, "007"), "ARCHIVE VOICE");
  assert.equal(formatAudioDuration(8120), "00:08");

  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.className = "";
      this.dataset = {};
      this.children = [];
      this.attributes = {};
      this.textContent = "";
      this.classList = {
        add: (...names) => {
          const values = new Set(this.className.split(/\s+/).filter(Boolean));
          names.forEach((name) => values.add(name));
          this.className = [...values].join(" ");
        },
      };
    }

    append(...children) {
      this.children.push(...children);
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  }
  const audioIndicator = createMemoryCardElement(
    independentAudio,
    "ARCHIVE VOICE",
    { createElement: (tagName) => new FakeElement(tagName) },
  );
  assert.match(audioIndicator.className, /memory-echo-card--audio-only/);
  assert.equal(audioIndicator.dataset.memoryType, MEMORY_TYPES.AUDIO);
  assert.equal(
    audioIndicator.dataset.memoryRelationship,
    MEMORY_RELATIONSHIPS.INDEPENDENT,
  );
  assert.equal(audioIndicator.children[0].textContent, "ARCHIVE VOICE");
  assert.equal(
    audioIndicator.children[1].children.at(-1).textContent,
    "DURATION · --:--",
  );

  const verifiedImageAudio = createMemoryItem({
    id: "verified-image-audio-fixture",
    kind: MEMORY_KINDS.PAIRED_MEMORY,
    image: "./assets/memories/images/memory_001.jpg",
    caption: "Verified fixture caption",
    date: "Verified fixture date",
    location: "Verified fixture location",
    source: "Verified image source",
    sourceUrl: "https://archive.example/image/001",
    audio: "./assets/memories/audio/memory_001.mp3",
    audioId: "memory_001_voice",
    audioType: "voice",
    audioCaption: "Verified voice excerpt",
    audioSource: "Verified audio source",
    audioSourceUrl: "https://archive.example/audio/001",
    verified: true,
    isPrototype: false,
    relationship: MEMORY_RELATIONSHIPS.VERIFIED_PAIR,
  });
  const imageAudioViewModel = getMemoryCardViewModel(verifiedImageAudio);
  assert.equal(imageAudioViewModel.type, MEMORY_TYPES.IMAGE);
  assert.equal(imageAudioViewModel.hasAudio, true);
  assert.equal(imageAudioViewModel.audioType, "voice");
  assert.equal(imageAudioViewModel.audioLabel, "AUDIO · Verified voice excerpt");
  assert.equal(
    imageAudioViewModel.metadata,
    "LOCATION · Verified fixture location   DATE · Verified fixture date",
  );
  assert.equal(
    imageAudioViewModel.sourceLabel,
    "IMAGE SOURCE · Verified image source",
  );
  assert.equal(
    imageAudioViewModel.audioSourceLabel,
    "AUDIO SOURCE · Verified audio source",
  );
  assert.equal(imageAudioViewModel.verified, true);
  assert.equal(imageAudioViewModel.isPrototype, false);
  assert.equal(imageAudioViewModel.isVerifiedPair, true);
  assert.equal(
    imageAudioViewModel.relationship,
    MEMORY_RELATIONSHIPS.VERIFIED_PAIR,
  );

  const verifiedTextAudio = createMemoryItem({
    id: "verified-text-audio-fixture",
    kind: MEMORY_KINDS.PAIRED_MEMORY,
    text: "Verified fixture transcript summary",
    source: "Verified text source",
    audio: "./assets/memories/audio/memory_002.mp3",
    audioCaption: "Verified related recording",
    verified: true,
    isPrototype: false,
    relationship: MEMORY_RELATIONSHIPS.VERIFIED_PAIR,
  });
  const textAudioViewModel = getMemoryCardViewModel(verifiedTextAudio);
  assert.equal(textAudioViewModel.type, MEMORY_TYPES.TEXT);
  assert.equal(textAudioViewModel.hasAudio, true);
  assert.equal(textAudioViewModel.text, verifiedTextAudio.text);
  assert.equal(textAudioViewModel.isVerifiedPair, true);
  assert.throws(
    () =>
      createMemoryItem({
        id: "unsafe-image-audio",
        kind: MEMORY_KINDS.IMAGE_ARCHIVE,
        image: "image.jpg",
        audio: "voice.mp3",
      }),
    /cannot contain unrelated audio/,
  );
  assert.throws(
    () =>
      createMemoryItem({
        id: "unverified-pair",
        kind: MEMORY_KINDS.PAIRED_MEMORY,
        image: "image.jpg",
        audio: "voice.mp3",
        relationship: MEMORY_RELATIONSHIPS.VERIFIED_PAIR,
      }),
    /requires verified media/,
  );
  assert.throws(
    () => createMemoryItem({ id: "unsafe", verified: true, isPrototype: true }),
    /both verified and a prototype/,
  );
});

test("memory shuffle bag balances text, image, and audio without exact repeats", () => {
  const textEntries = ["one", "two"].map((id) =>
    createMemoryItem({ id: `text-${id}`, text: id }),
  );
  const imageEntries = ["one", "two"].map((id) =>
    createMemoryItem({
      id: `image-${id}`,
      kind: MEMORY_KINDS.IMAGE_ARCHIVE,
      image: `./assets/memories/images/${id}.jpg`,
      verified: true,
      isPrototype: false,
    }),
  );
  const audioEntries = ["one", "two"].map((id) =>
    createMemoryItem({
      id: `audio-${id}`,
      kind: MEMORY_KINDS.AUDIO_ARCHIVE,
      audio: `./assets/memories/audio/${id}.mp3`,
      verified: true,
      isPrototype: false,
    }),
  );
  const memoryPool = createMemoryPool({
    prototypeMemories: [...textEntries, ...imageEntries, ...audioEntries],
  });
  const selections = Array.from({ length: 6 }, () =>
    memoryPool.selectEcho(() => 0),
  );

  for (const cycle of [selections.slice(0, 3), selections.slice(3, 6)]) {
    assert.deepEqual(
      [...new Set(cycle.map((memory) => memory.type))].sort(),
      [MEMORY_TYPES.TEXT, MEMORY_TYPES.IMAGE, MEMORY_TYPES.AUDIO].sort(),
    );
  }
  assert.notEqual(selections[2].type, selections[3].type);
  for (const type of Object.values(MEMORY_TYPES)) {
    const ids = selections
      .filter((memory) => memory.type === type)
      .map((memory) => memory.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  assert.deepEqual(MEMORY_SELECTION_CONFIG.CATEGORY_SHUFFLE_BAG, [
    MEMORY_TYPES.TEXT,
    MEMORY_TYPES.IMAGE,
    MEMORY_TYPES.AUDIO,
  ]);
  assert.equal(MEMORY_SELECTION_CONFIG.RECENT_ITEM_HISTORY_SIZE, 1);
  assert.equal(memoryPool.selectionState.categoryBag.length, 0);
  memoryPool.resetSelection();
  assert.equal(memoryPool.selectionState.lastSelectedId, null);
  assert.deepEqual(memoryPool.selectionState.categoryBag, []);
  assert.deepEqual(memoryPool.selectionState.recentIdsByType, {});
});

test("memory shuffle bag uses only available categories and defers busy audio", () => {
  const text = createMemoryItem({ id: "text-only", text: "text" });
  const image = createMemoryItem({
    id: "image-only",
    kind: MEMORY_KINDS.IMAGE_ARCHIVE,
    image: "./assets/memories/images/one.jpg",
    verified: true,
    isPrototype: false,
  });
  const audio = createMemoryItem({
    id: "audio-only",
    kind: MEMORY_KINDS.AUDIO_ARCHIVE,
    audio: "./assets/memories/audio/one.mp3",
    verified: true,
    isPrototype: false,
  });
  const noAudioPool = createMemoryPool({ prototypeMemories: [text, image] });
  const availableSelections = Array.from({ length: 4 }, () =>
    noAudioPool.selectEcho(() => 0),
  );
  assert.equal(
    availableSelections.filter((memory) => memory.type === MEMORY_TYPES.TEXT).length,
    2,
  );
  assert.equal(
    availableSelections.filter((memory) => memory.type === MEMORY_TYPES.IMAGE).length,
    2,
  );

  const busyAudioPool = createMemoryPool({
    prototypeMemories: [text, image, audio],
  });
  assert.equal(busyAudioPool.selectEcho(() => 0).type, MEMORY_TYPES.IMAGE);
  const whileBusy = busyAudioPool.selectEcho(() => 0, {
    audioAvailable: false,
  });
  assert.equal(whileBusy.type, MEMORY_TYPES.TEXT);
  assert.ok(busyAudioPool.selectionState.categoryBag.includes(MEMORY_TYPES.AUDIO));
  assert.equal(
    busyAudioPool.selectEcho(() => 0, { audioAvailable: true }).type,
    MEMORY_TYPES.AUDIO,
  );
});

test("memory images warm lazily without blocking or duplicate loads", async () => {
  let constructedImages = 0;
  class FakeImage {
    constructor() {
      constructedImages += 1;
    }

    set src(value) {
      this.currentSrc = value;
      queueMicrotask(() => this.onload?.());
    }
  }
  const scheduled = [];
  const preloader = new MemoryImagePreloader({
    ImageCtor: FakeImage,
    windowRef: {
      requestIdleCallback(callback) {
        scheduled.push(callback);
      },
    },
  });
  const memories = [1, 2, 3].map((id) => ({
    image: `./assets/memories/images/memory_00${id}.jpg`,
  }));

  assert.deepEqual(getMemoryImageUrls([...memories, memories[0]]), [
    "./assets/memories/images/memory_001.jpg",
    "./assets/memories/images/memory_002.jpg",
    "./assets/memories/images/memory_003.jpg",
  ]);
  assert.deepEqual(preloader.scheduleInitial(memories), [
    "./assets/memories/images/memory_001.jpg",
    "./assets/memories/images/memory_002.jpg",
  ]);
  assert.equal(constructedImages, 0);
  scheduled[0]();
  await Promise.all(preloader.cache.values());
  assert.equal(constructedImages, 2);
  await preloader.preload(memories[0].image);
  assert.equal(constructedImages, 2);

  for (const directory of [
    "images",
    "audio",
    "audio-normalized",
    "bgm",
    "bgm-normalized",
  ]) {
    assert.equal(
      existsSync(
        new URL(`../public/assets/memories/${directory}/`, import.meta.url),
      ),
      true,
    );
  }
});

test("audio configuration centralizes restrained mixing and card timing", () => {
  assert.equal(
    AUDIO_CONFIG.BGM_URL,
    "./assets/memories/bgm-normalized/bgm.mp3",
  );
  assert.equal(
    existsSync(
      new URL(
        "../public/assets/memories/bgm-normalized/bgm.mp3",
        import.meta.url,
      ),
    ),
    true,
  );
  assert.equal(AUDIO_CONFIG.BGM_VOLUME, 0.52);
  assert.equal(AUDIO_CONFIG.BGM_MAX_VOLUME, 0.64);
  assert.equal(AUDIO_CONFIG.BGM_DUCK_RATIO, 0.72);
  assert.equal(getBGMTargetVolume(false), 0.52);
  assert.equal(getBGMTargetVolume(true), 0.52 * 0.72);
  assert.equal(getBGMTargetVolume(false, 0.17), 0.17);
  assert.equal(getBGMTargetVolume(true, 0.17), 0.17 * 0.72);
  assert.equal(AUDIO_CONFIG.ARCHIVE_VOICE_GAIN, 0.38);
  assert.equal(AUDIO_CONFIG.VOICE_FADE_IN_DURATION, 0.65);
  assert.equal(AUDIO_CONFIG.VOICE_FADE_OUT_DURATION, 0.75);
  assert.equal(AUDIO_CONFIG.MASTER_LIMITER_THRESHOLD_DB, -18);
  assert.equal(AUDIO_CONFIG.MASTER_LIMITER_KNEE_DB, 6);
  assert.equal(AUDIO_CONFIG.MASTER_LIMITER_RATIO, 4);
  assert.equal(AUDIO_CONFIG.MASTER_OUTPUT_GAIN, 0.82);
  assert.equal(getVoiceCardVisibleDuration(9000, 4200), 9900);
  assert.equal(getVoiceCardVisibleDuration(30000, 4200), 24000);
  assert.equal("BLOOM_SFX_VOLUME" in AUDIO_CONFIG, false);
  assert.equal("BLOOM_SFX_COOLDOWN" in AUDIO_CONFIG, false);
  assert.equal("BLOOM_SFX_PROBABILITY" in AUDIO_CONFIG, false);
  assert.equal("MEMORY_SFX_VOLUME" in AUDIO_CONFIG, false);

  const audioManagerSource = readFileSync(
    new URL("../src/audio/AudioManager.js", import.meta.url),
    "utf8",
  );
  const memoryExperienceSource = readFileSync(
    new URL("../src/memory/MemoryExperience.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(audioManagerSource, /playBloomSfx|playMemorySfx|createOscillator/);
  assert.match(audioManagerSource, /createDynamicsCompressor/);
  assert.match(audioManagerSource, /scheduleVoiceEnvelope/);
  assert.match(audioManagerSource, /BGM_SESSION_STORAGE_KEY/);
  assert.doesNotMatch(memoryExperienceSource, /playBloomSfx|playMemorySfx/);

  const voiceLoudnessReport = JSON.parse(
    readFileSync(
      new URL(
        "../public/assets/memories/audio-normalized/loudness-report.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    voiceLoudnessReport.files.length,
    AUDIO_ARCHIVE_MEMORIES.length,
  );
  assert.equal(voiceLoudnessReport.target.integratedLufs, -23);
  assert.equal(voiceLoudnessReport.target.truePeakDbtp, -3);
  voiceLoudnessReport.files.forEach((entry) => {
    assert.ok(Math.abs(entry.after.integratedLufs + 23) < 1);
    assert.ok(entry.after.truePeakDbtp <= -3);
    assert.notEqual(entry.sourceSha256, entry.outputSha256);
  });

  const bgmLoudnessReport = JSON.parse(
    readFileSync(
      new URL(
        "../public/assets/memories/bgm-normalized/loudness-report.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(bgmLoudnessReport.target.integratedLufs, -25);
  assert.equal(bgmLoudnessReport.target.truePeakDbtp, -3);
  assert.ok(Math.abs(bgmLoudnessReport.after.integratedLufs + 25) < 1);
  assert.ok(bgmLoudnessReport.after.truePeakDbtp <= -3);
  assert.equal(bgmLoudnessReport.after.loudnessRangeLu, 7.9);
  assert.notEqual(
    bgmLoudnessReport.sourceSha256,
    bgmLoudnessReport.outputSha256,
  );

  const gainToDecibels = (gain) => 20 * Math.log10(gain);
  const duckedBgmLufs =
    bgmLoudnessReport.after.integratedLufs +
    gainToDecibels(AUDIO_CONFIG.BGM_VOLUME * AUDIO_CONFIG.BGM_DUCK_RATIO);
  const sortedVoices = [...voiceLoudnessReport.files].sort(
    (left, right) => left.after.integratedLufs - right.after.integratedLufs,
  );
  const meanVoiceLufs = sortedVoices.reduce(
    (sum, entry) => sum + entry.after.integratedLufs,
    0,
  ) / sortedVoices.length;
  const representativeVoices = [
    sortedVoices[0],
    sortedVoices.at(-1),
    sortedVoices.reduce((closest, entry) =>
      Math.abs(entry.after.integratedLufs - meanVoiceLufs) <
      Math.abs(closest.after.integratedLufs - meanVoiceLufs)
        ? entry
        : closest,
    ),
  ];
  representativeVoices.forEach((entry) => {
    const runtimeVoiceLufs =
      entry.after.integratedLufs +
      gainToDecibels(AUDIO_CONFIG.ARCHIVE_VOICE_GAIN);
    const prominenceOverDuckedBgm = runtimeVoiceLufs - duckedBgmLufs;
    assert.ok(prominenceOverDuckedBgm >= 1.4);
    assert.ok(prominenceOverDuckedBgm <= 2.4);
  });
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
  assert.equal(MEMORY_UI_CONFIG.MEMORY_CARD_WIDTH, 270);
  assert.equal(MEMORY_UI_CONFIG.MEMORY_IMAGE_CARD_WIDTH, 286);
  assert.equal(MEMORY_UI_CONFIG.MEMORY_AUDIO_CARD_WIDTH, 176);
  assert.equal(MEMORY_UI_CONFIG.MEMORY_CARD_UPPER_TOP_MIN_RATIO, 0.2);
  assert.equal(MEMORY_UI_CONFIG.MEMORY_CARD_UPPER_TOP_MAX_RATIO, 0.42);
  assert.equal(MEMORY_UI_CONFIG.MEMORY_CARD_UPPER_BOTTOM_MAX_RATIO, 0.58);
  assert.equal(MEMORY_UI_CONFIG.MEMORY_CARD_WORLD_Y_INFLUENCE, 0.28);
  const upperBand = getMemoryCardUpperBand(720, 140, 30);
  assert.equal(upperBand.topMin, 168);
  assert.ok(upperBand.topMax <= 720 * 0.58 - 140);
  assert.ok(upperBand.topMax > upperBand.topMin);
});

test("PNG public interface uses the approved English exhibition language", () => {
  const pngHtml = readFileSync(
    new URL("../png.html", import.meta.url),
    "utf8",
  );
  const pngEntrySource = readFileSync(
    new URL("../src/png-main.js", import.meta.url),
    "utf8",
  );
  const cardRendererSource = readFileSync(
    new URL("../src/memory/MemoryCardRenderer.js", import.meta.url),
    "utf8",
  );
  const memoryPoolSource = readFileSync(
    new URL("../src/data/memoryPool.js", import.meta.url),
    "utf8",
  );

  for (const approvedCopy of [
    "FIELD OF MEMORY",
    "Leave a memory you wish to preserve",
    "A memory of the Nanjing Massacre, Jiangdongmen,",
    "or a moment that connects you to this place.",
    "It can be a sentence, a place,",
    "a sound, or the moment you first encountered this history.",
    "Leave this memory in the field",
    "GAZE TO LET MEMORIES BLOOM",
    "AMBIENCE",
    "SOUND OFF",
    "MEMORIES",
    "RESET FIELD",
  ]) {
    assert.ok(pngHtml.includes(approvedCopy));
  }

  assert.match(pngEntrySource, /GAZE INPUT · WAITING/);
  assert.match(pngEntrySource, /GAZE INPUT · READY/);
  assert.doesNotMatch(pngHtml, />\s*BGM\s*</i);
  assert.doesNotMatch(pngHtml, /HOLD\s*\+\s*DRAG|MOUSE|POINTER/i);
  assert.doesNotMatch(pngHtml, /[\u3400-\u9fff]/u);
  assert.doesNotMatch(cardRendererSource, /[\u3400-\u9fff]/u);
  assert.match(
    memoryPoolSource,
    /TEXT_PROTOTYPE_DRAFTS_REQUIRING_TRANSLATION/,
  );
});

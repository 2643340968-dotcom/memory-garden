import * as THREE from "three";
import { clamp01 } from "../flowers/FlowerAnimation.js";
import { createSeededRandom, randomRange } from "../utils/random.js";
import { BLOOM_PATCH_CONFIG } from "../flowers/BloomPatchConfig.js";

const POINT_KIND_FLOWER = 0;
const POINT_KIND_CENTER = 1;
const POINT_KIND_PATCH_GLOW = 2;
const PALE_EDGE_COLOR = new THREE.Color(0xded5ff);
const CENTER_GLOW_COLOR = new THREE.Color(0xd9c6ff);
const PATCH_GLOW_COLOR = new THREE.Color(0x8265a8);

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function setTriplet(array, index, x, y, z) {
  const offset = index * 3;
  array[offset] = x;
  array[offset + 1] = y;
  array[offset + 2] = z;
}

function createParticleMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    name: "MemoryGardenFlowerBodyParticleMaterial",
    uniforms: {
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: `
      uniform float uPixelRatio;
      attribute float aAlpha;
      attribute float aSize;
      attribute float aSoftness;
      attribute float aRotation;
      attribute float aRadiance;
      attribute vec3 color;
      varying float vAlpha;
      varying float vSoftness;
      varying float vRotation;
      varying float vRadiance;
      varying vec3 vColor;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspectiveScale = clamp(
          8.0 / max(0.01, -viewPosition.z),
          0.55,
          1.35
        );
        gl_PointSize = max(1.0, aSize * uPixelRatio * perspectiveScale);
        gl_Position = projectionMatrix * viewPosition;
        vAlpha = aAlpha;
        vSoftness = aSoftness;
        vRotation = aRotation * 6.28318530718;
        vRadiance = aRadiance;
        vColor = color;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vSoftness;
      varying float vRotation;
      varying float vRadiance;
      varying vec3 vColor;

      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float cosine = cos(vRotation);
        float sine = sin(vRotation);
        vec2 grain = mat2(cosine, -sine, sine, cosine) * point;
        grain *= vec2(1.45, 0.82);

        float diamond = abs(grain.x) + abs(grain.y);
        float microPoint = 1.0 - smoothstep(
          mix(0.28, 0.22, vSoftness),
          0.5,
          diamond
        );
        float radius = length(point) * 2.0;
        float softGlow = exp(-radius * radius * 2.8) *
          (1.0 - smoothstep(0.72, 1.0, radius));
        float glowPoint = step(0.9, vSoftness);
        float alpha = vAlpha * mix(microPoint, softGlow, glowPoint);
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor * vRadiance, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

export class BloomParticleSystem {
  constructor(
    scene,
    renderer,
    flowerSystem,
    config = BLOOM_PATCH_CONFIG,
  ) {
    const flowerRenderer = flowerSystem?.flowerRenderer;
    if (
      typeof flowerRenderer?.getMatrixAt !== "function" ||
      typeof flowerRenderer?.getVariantIndex !== "function" ||
      typeof flowerRenderer?.getParticleSampleSet !== "function"
    ) {
      throw new TypeError(
        "Flower-body particles require a PNG renderer with sampled silhouettes.",
      );
    }

    this.scene = scene;
    this.flowerSystem = flowerSystem;
    this.flowerRenderer = flowerRenderer;
    this.config = config;
    this.capacity = config.PARTICLE_POOL_CAPACITY;
    this.effects = new Map();
    this.freeSlots = [];

    this.positions = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 3);
    this.alphas = new Float32Array(this.capacity);
    this.sizes = new Float32Array(this.capacity);
    this.softness = new Float32Array(this.capacity);
    this.radiances = new Float32Array(this.capacity);
    this.localPositions = new Float32Array(this.capacity * 3);
    this.startPositions = new Float32Array(this.capacity * 3);
    this.driftDirections = new Float32Array(this.capacity * 3);
    this.baseSizes = new Float32Array(this.capacity);
    this.sampleIntensities = new Float32Array(this.capacity);
    this.edgeFactors = new Float32Array(this.capacity);
    this.phases = new Float32Array(this.capacity);
    this.pointKinds = new Uint8Array(this.capacity);
    this.flowerIndices = new Uint32Array(this.capacity);
    this.slotAlive = new Uint8Array(this.capacity);
    this.maxDrawSlot = -1;
    this.staticDirtyMin = this.capacity;
    this.staticDirtyMax = -1;
    this.degradedPatchCount = 0;

    for (let index = this.capacity - 1; index >= 0; index -= 1) {
      this.freeSlots.push(index);
    }

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 3);
    this.alphaAttribute = new THREE.BufferAttribute(this.alphas, 1);
    this.sizeAttribute = new THREE.BufferAttribute(this.sizes, 1);
    this.softnessAttribute = new THREE.BufferAttribute(this.softness, 1);
    this.rotationAttribute = new THREE.BufferAttribute(this.phases, 1);
    this.radianceAttribute = new THREE.BufferAttribute(this.radiances, 1);
    [
      this.positionAttribute,
      this.colorAttribute,
      this.alphaAttribute,
      this.sizeAttribute,
      this.softnessAttribute,
      this.rotationAttribute,
      this.radianceAttribute,
    ].forEach((attribute) => attribute.setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setAttribute("color", this.colorAttribute);
    this.geometry.setAttribute("aAlpha", this.alphaAttribute);
    this.geometry.setAttribute("aSize", this.sizeAttribute);
    this.geometry.setAttribute("aSoftness", this.softnessAttribute);
    this.geometry.setAttribute("aRotation", this.rotationAttribute);
    this.geometry.setAttribute("aRadiance", this.radianceAttribute);
    this.geometry.setDrawRange(0, 0);

    this.material = createParticleMaterial(renderer.getPixelRatio());
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "MemoryGardenFlowerBodyParticlePool";
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.visible = false;
    this.points.userData.particleCapacity = this.capacity;
    this.points.userData.source = "png-alpha-silhouette";
    scene.add(this.points);

    this.matrix = new THREE.Matrix4();
    this.localPoint = new THREE.Vector3();
  }

  allocateSlot() {
    if (this.freeSlots.length === 0) {
      return -1;
    }
    const slot = this.freeSlots.pop();
    this.slotAlive[slot] = 1;
    this.maxDrawSlot = Math.max(this.maxDrawSlot, slot);
    this.staticDirtyMin = Math.min(this.staticDirtyMin, slot);
    this.staticDirtyMax = Math.max(this.staticDirtyMax, slot);
    return slot;
  }

  releaseSlot(slot) {
    if (this.slotAlive[slot] === 0) {
      return;
    }
    this.slotAlive[slot] = 0;
    this.alphas[slot] = 0;
    this.sizes[slot] = 0;
    this.freeSlots.push(slot);
    if (slot === this.maxDrawSlot) {
      while (
        this.maxDrawSlot >= 0 &&
        this.slotAlive[this.maxDrawSlot] === 0
      ) {
        this.maxDrawSlot -= 1;
      }
    }
  }

  setSlotColor(slot, color, edge = 0, variance = 0) {
    const offset = slot * 3;
    const mixture = clamp01(edge * 0.26);
    const multiplier = 1 + variance;
    this.colors[offset] = THREE.MathUtils.lerp(
      color[0],
      PALE_EDGE_COLOR.r,
      mixture,
    ) * multiplier;
    this.colors[offset + 1] = THREE.MathUtils.lerp(
      color[1],
      PALE_EDGE_COLOR.g,
      mixture,
    ) * multiplier;
    this.colors[offset + 2] = THREE.MathUtils.lerp(
      color[2],
      PALE_EDGE_COLOR.b,
      mixture,
    ) * multiplier;
  }

  setSolidSlotColor(slot, color) {
    setTriplet(this.colors, slot, color.r, color.g, color.b);
  }

  createFlowerPoint(effect, flowerIndex, sample, random) {
    const slot = this.allocateSlot();
    if (slot < 0) {
      return false;
    }

    this.pointKinds[slot] = POINT_KIND_FLOWER;
    this.flowerIndices[slot] = flowerIndex;
    this.edgeFactors[slot] = sample.edge;
    this.phases[slot] = random();
    this.sampleIntensities[slot] = clamp01(
      0.48 + sample.alpha * 0.36 + sample.center * 0.16,
    );
    setTriplet(this.localPositions, slot, sample.x, sample.y, sample.z);
    setTriplet(
      this.startPositions,
      slot,
      this.flowerSystem.positionsX[flowerIndex] + randomRange(random, -0.025, 0.025),
      randomRange(random, 0.01, 0.055),
      this.flowerSystem.positionsZ[flowerIndex] + randomRange(random, -0.025, 0.025),
    );
    const angle = randomRange(random, 0, Math.PI * 2);
    setTriplet(
      this.driftDirections,
      slot,
      Math.cos(angle),
      randomRange(random, 0.55, 1),
      Math.sin(angle),
    );
    this.baseSizes[slot] = randomRange(
      random,
      this.config.FLOWER_PARTICLE_SIZE_MIN,
      this.config.FLOWER_PARTICLE_SIZE_MAX,
    ) * (0.88 + sample.alpha * 0.12 + sample.edge * 0.1);
    this.softness[slot] = 0.08 + sample.edge * 0.38;
    this.radiances[slot] = this.config.FLOWER_PARTICLE_HDR_GAIN;
    this.setSlotColor(
      slot,
      sample.color,
      sample.edge,
      randomRange(
        random,
        -this.config.FLOWER_PARTICLE_COLOR_VARIANCE,
        this.config.FLOWER_PARTICLE_COLOR_VARIANCE,
      ),
    );
    effect.slots.push(slot);
    return true;
  }

  createCenterPoint(effect, flowerIndex, centerSample, random) {
    const slot = this.allocateSlot();
    if (slot < 0) {
      return false;
    }
    this.pointKinds[slot] = POINT_KIND_CENTER;
    this.flowerIndices[slot] = flowerIndex;
    this.edgeFactors[slot] = 0;
    this.phases[slot] = random();
    this.sampleIntensities[slot] = 1;
    setTriplet(
      this.localPositions,
      slot,
      centerSample.x,
      centerSample.y,
      centerSample.z + 0.006,
    );
    setTriplet(
      this.startPositions,
      slot,
      this.flowerSystem.positionsX[flowerIndex],
      0.02,
      this.flowerSystem.positionsZ[flowerIndex],
    );
    setTriplet(this.driftDirections, slot, 0, 1, 0);
    this.baseSizes[slot] = this.config.FLOWER_CENTER_GLOW_RADIUS;
    this.softness[slot] = 1;
    this.radiances[slot] = this.config.FLOWER_CENTER_HDR_GAIN;
    this.setSolidSlotColor(slot, CENTER_GLOW_COLOR);
    effect.slots.push(slot);
    return true;
  }

  createPatchGlow(effect, patch, random) {
    const slot = this.allocateSlot();
    if (slot < 0) {
      return;
    }
    this.pointKinds[slot] = POINT_KIND_PATCH_GLOW;
    this.edgeFactors[slot] = 0;
    this.phases[slot] = random();
    this.sampleIntensities[slot] = 1;
    setTriplet(this.localPositions, slot, patch.center.x, 0.13, patch.center.z);
    setTriplet(this.startPositions, slot, patch.center.x, 0.08, patch.center.z);
    setTriplet(this.driftDirections, slot, 0, 1, 0);
    this.baseSizes[slot] = randomRange(
      random,
      this.config.PATCH_GLOW_RADIUS_MIN,
      this.config.PATCH_GLOW_RADIUS_MAX,
    );
    this.softness[slot] = 1;
    this.radiances[slot] = 1;
    this.setSolidSlotColor(slot, PATCH_GLOW_COLOR);
    effect.slots.push(slot);
    effect.patchGlowSlot = slot;
  }

  spawnBirth(patch) {
    if (this.effects.has(patch.id)) {
      return;
    }

    const random = createSeededRandom(
      (patch.bloomEvent.randomSeed ^ 0xf10a6e11) >>> 0,
    );
    const effect = {
      patch,
      slots: [],
      patchGlowSlot: -1,
      startTime: patch.birthTime,
      decayStartTime: null,
      attentionEmphasis: 1,
      lastSyncTime: patch.birthTime,
      flowerMatrices: null,
    };
    const enhancedFlowers = [...patch.flowerIndices];
    effect.flowerMatrices = new Map(
      enhancedFlowers.map((flowerIndex) => [flowerIndex, new THREE.Matrix4()]),
    );
    const desiredSampleCount = Math.max(
      1,
      Math.round(
        this.config.FLOWER_PARTICLE_SAMPLE_COUNT *
          this.config.FLOWER_PARTICLE_ACTIVE_RATIO,
      ),
    );
    const reservedNonBodySlots = enhancedFlowers.length + 1;
    const availableBodySlots = Math.max(
      0,
      this.freeSlots.length - reservedNonBodySlots,
    );
    const sampleCount = Math.min(
      desiredSampleCount,
      Math.floor(availableBodySlots / Math.max(1, enhancedFlowers.length)),
    );
    effect.samplesPerFlower = sampleCount;
    effect.degraded = sampleCount < desiredSampleCount;
    if (effect.degraded) {
      this.degradedPatchCount += 1;
    }
    if (sampleCount <= 0) {
      return;
    }

    for (const flowerIndex of enhancedFlowers) {
      const variantIndex = this.flowerRenderer.getVariantIndex(flowerIndex);
      const sampleSet = this.flowerRenderer.getParticleSampleSet(variantIndex);
      if (!sampleSet?.samples?.length) {
        continue;
      }
      const firstSample = Math.floor(random() * sampleSet.samples.length);
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        const sample =
          sampleSet.samples[
            (firstSample + sampleIndex * 37) % sampleSet.samples.length
          ];
        if (!this.createFlowerPoint(effect, flowerIndex, sample, random)) {
          break;
        }
      }
      if (!this.createCenterPoint(effect, flowerIndex, sampleSet.center, random)) {
        break;
      }
    }

    this.createPatchGlow(effect, patch, random);
    if (effect.slots.length === 0) {
      return;
    }
    this.effects.set(patch.id, effect);
    this.points.visible = true;
    this.geometry.setDrawRange(0, this.maxDrawSlot + 1);
  }

  captureAttachedPosition(slot) {
    const flowerIndex = this.flowerIndices[slot];
    if (!this.flowerRenderer.getMatrixAt(flowerIndex, this.matrix)) {
      return false;
    }
    const offset = slot * 3;
    this.localPoint
      .set(
        this.localPositions[offset],
        this.localPositions[offset + 1],
        this.localPositions[offset + 2],
      )
      .applyMatrix4(this.matrix);
    setTriplet(
      this.startPositions,
      slot,
      this.localPoint.x,
      this.localPoint.y,
      this.localPoint.z,
    );
    return true;
  }

  spawnDecay(patch, flowerSystem, startTime) {
    const effect = this.effects.get(patch.id);
    if (!effect) {
      return;
    }
    effect.decayStartTime = startTime;
    for (const slot of effect.slots) {
      if (this.pointKinds[slot] !== POINT_KIND_PATCH_GLOW) {
        this.captureAttachedPosition(slot);
      }
    }
  }

  updateFlowerPoint(effect, slot, timeSeconds) {
    const patch = effect.patch;
    const offset = slot * 3;
    const flowerIndex = this.flowerIndices[slot];
    const flowerMatrix = effect.flowerMatrices.get(flowerIndex);
    if (!flowerMatrix) {
      this.alphas[slot] = 0;
      return;
    }

    this.localPoint
      .set(
        this.localPositions[offset],
        this.localPositions[offset + 1],
        this.localPositions[offset + 2],
      )
      .applyMatrix4(flowerMatrix);
    const age = Math.max(0, timeSeconds - patch.birthTime);
    const gatherProgress = clamp01(
      age / this.config.FLOWER_PARTICLE_BIRTH_DURATION,
    );
    const gatherDelay = this.phases[slot] * 0.16;
    const gather = smoothstep(
      clamp01((gatherProgress - gatherDelay) / (1 - gatherDelay)),
    );
    const settleProgress = smoothstep(
      clamp01(
        (age -
          this.config.FLOWER_PARTICLE_BIRTH_DURATION -
          this.config.FLOWER_PARTICLE_BIRTH_HOLD_DURATION) /
          this.config.FLOWER_PARTICLE_SETTLE_DURATION,
      ),
    );
    const sampleIntensity = this.sampleIntensities[slot];
    const shimmer =
      1 + Math.sin(timeSeconds * 1.45 + this.phases[slot] * Math.PI * 2) * 0.055;

    if (patch.state === "decaying" && effect.decayStartTime !== null) {
      const rawDecay = clamp01(
        (timeSeconds - effect.decayStartTime) / this.config.DECAY_DURATION,
      );
      const edge = this.edgeFactors[slot];
      const delayedDecay = clamp01(
        (rawDecay - (1 - edge) * this.phases[slot] * 0.11) / 0.89,
      );
      const breakup = easeOutCubic(delayedDecay);
      const driftScale =
        breakup *
        (0.05 + edge * this.config.DECAY_EDGE_BREAKUP_AMOUNT);
      this.positions[offset] =
        this.localPoint.x + this.driftDirections[offset] * driftScale;
      this.positions[offset + 1] =
        this.localPoint.y +
        this.driftDirections[offset + 1] * driftScale * 0.9 +
        breakup * 0.12;
      this.positions[offset + 2] =
        this.localPoint.z + this.driftDirections[offset + 2] * driftScale;
      const stableOpacity = THREE.MathUtils.lerp(
        this.config.FLOWER_PARTICLE_IDLE_OPACITY,
        this.config.FLOWER_PARTICLE_ATTENDED_OPACITY,
        effect.attentionEmphasis * patch.attention,
      );
      const fragmentEnvelope =
        THREE.MathUtils.lerp(
          stableOpacity,
          this.config.FLOWER_PARTICLE_DECAY_OPACITY,
          smoothstep(rawDecay / 0.18),
        ) * Math.pow(1 - delayedDecay, 0.72);
      this.alphas[slot] =
        fragmentEnvelope * sampleIntensity;
      this.sizes[slot] = this.baseSizes[slot] * (1 + breakup * 0.26);
      return;
    }

    const idleOpacity = this.config.FLOWER_PARTICLE_IDLE_OPACITY;
    const attendedOpacity = THREE.MathUtils.lerp(
      idleOpacity,
      this.config.FLOWER_PARTICLE_ATTENDED_OPACITY,
      effect.attentionEmphasis * patch.attention,
    );
    const stableOpacity = Math.max(idleOpacity, attendedOpacity);
    const birthOpacity = THREE.MathUtils.lerp(
      this.config.FLOWER_PARTICLE_BIRTH_OPACITY,
      stableOpacity,
      settleProgress,
    );
    const fadeIn = smoothstep(
      clamp01((gatherProgress - gatherDelay * 0.45) / 0.18),
    );
    this.positions[offset] = THREE.MathUtils.lerp(
      this.startPositions[offset],
      this.localPoint.x,
      gather,
    );
    this.positions[offset + 1] = THREE.MathUtils.lerp(
      this.startPositions[offset + 1],
      this.localPoint.y,
      gather,
    );
    this.positions[offset + 2] = THREE.MathUtils.lerp(
      this.startPositions[offset + 2],
      this.localPoint.z,
      gather,
    );
    const coherence = THREE.MathUtils.lerp(
      1,
      0.54,
      effect.attentionEmphasis * patch.attention,
    );
    const surfaceDrift =
      Math.sin(timeSeconds * 1.1 + this.phases[slot] * Math.PI * 2) *
      this.config.FLOWER_PARTICLE_DRIFT_AMOUNT *
      (0.35 + this.edgeFactors[slot] * 0.65) *
      gather *
      coherence;
    this.positions[offset] += surfaceDrift;
    this.positions[offset + 1] += Math.abs(surfaceDrift) * 0.3;
    this.alphas[slot] =
      birthOpacity * fadeIn * shimmer * sampleIntensity;
    this.sizes[slot] = this.baseSizes[slot] * (0.82 + gather * 0.18);
  }

  updateCenterPoint(effect, slot, timeSeconds) {
    this.updateFlowerPoint(effect, slot, timeSeconds);
    const patch = effect.patch;
    const age = Math.max(0, timeSeconds - patch.birthTime);
    const birthProgress = clamp01(
      age / this.config.FLOWER_PARTICLE_BIRTH_DURATION,
    );
    if (patch.state === "decaying") {
      this.alphas[slot] *= 0.42;
      return;
    }
    const calmBase = this.config.FLOWER_CENTER_GLOW_INTENSITY * 0.28;
    const attentionGlow = THREE.MathUtils.lerp(
      calmBase,
      this.config.FLOWER_CENTER_GLOW_INTENSITY,
      effect.attentionEmphasis * patch.attention,
    );
    const birthGlow =
      Math.sin(birthProgress * Math.PI) *
      this.config.FLOWER_CENTER_GLOW_INTENSITY;
    this.alphas[slot] = Math.max(this.alphas[slot] * 0.2, attentionGlow, birthGlow);
    this.sizes[slot] = this.baseSizes[slot] * (0.88 + patch.attention * 0.12);
  }

  updatePatchGlow(effect, slot, timeSeconds) {
    const patch = effect.patch;
    const offset = slot * 3;
    const age = Math.max(0, timeSeconds - patch.birthTime);
    const birthProgress = clamp01(age / this.config.PATCH_GLOW_DURATION);
    this.positions[offset] = this.localPositions[offset];
    this.positions[offset + 1] = this.localPositions[offset + 1];
    this.positions[offset + 2] = this.localPositions[offset + 2];
    this.sizes[slot] = this.baseSizes[slot] * (0.76 + birthProgress * 0.24);

    if (patch.state === "decaying" && effect.decayStartTime !== null) {
      const decayProgress = clamp01(
        (timeSeconds - effect.decayStartTime) / this.config.DECAY_DURATION,
      );
      this.alphas[slot] =
        this.config.PATCH_GLOW_INTENSITY *
        0.52 *
        Math.pow(1 - decayProgress, 1.8);
      return;
    }

    const birthGlow =
      Math.sin(birthProgress * Math.PI) * this.config.PATCH_GLOW_INTENSITY;
    const attentionGlow =
      this.config.PATCH_GLOW_INTENSITY *
      0.42 *
      effect.attentionEmphasis *
      patch.attention;
    this.alphas[slot] = Math.max(birthGlow, attentionGlow);
  }

  syncPatch(patch, flowerSystem, timeSeconds) {
    const effect = this.effects.get(patch.id);
    if (!effect) {
      return;
    }
    effect.patch = patch;
    const deltaSeconds = Math.max(0, timeSeconds - effect.lastSyncTime);
    const emphasisResponse =
      1 -
      Math.exp(
        -deltaSeconds /
          Math.max(0.001, this.config.FLOWER_PARTICLE_IDLE_FADE_DURATION),
      );
    effect.attentionEmphasis = THREE.MathUtils.lerp(
      effect.attentionEmphasis,
      patch.attended ? 1 : 0,
      emphasisResponse,
    );
    effect.lastSyncTime = timeSeconds;
    for (const [flowerIndex, matrix] of effect.flowerMatrices) {
      this.flowerRenderer.getMatrixAt(flowerIndex, matrix);
    }
    for (const slot of effect.slots) {
      const kind = this.pointKinds[slot];
      if (kind === POINT_KIND_FLOWER) {
        this.updateFlowerPoint(effect, slot, timeSeconds);
      } else if (kind === POINT_KIND_CENTER) {
        this.updateCenterPoint(effect, slot, timeSeconds);
      } else {
        this.updatePatchGlow(effect, slot, timeSeconds);
      }
    }
  }

  releasePatch(patchId) {
    const effect = this.effects.get(patchId);
    if (!effect) {
      return;
    }
    for (const slot of effect.slots) {
      this.releaseSlot(slot);
    }
    this.effects.delete(patchId);
    this.geometry.setDrawRange(0, this.maxDrawSlot + 1);
  }

  update() {
    const drawCount = this.maxDrawSlot + 1;
    this.geometry.setDrawRange(0, drawCount);
    if (drawCount > 0) {
      const dynamicAttributes = [
        [this.positionAttribute, 3],
        [this.alphaAttribute, 1],
        [this.sizeAttribute, 1],
      ];
      dynamicAttributes.forEach(([attribute, itemSize]) => {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, drawCount * itemSize);
        attribute.needsUpdate = true;
      });
    }
    if (this.staticDirtyMax >= this.staticDirtyMin) {
      const first = this.staticDirtyMin;
      const count = this.staticDirtyMax - first + 1;
      const staticAttributes = [
        [this.colorAttribute, 3],
        [this.softnessAttribute, 1],
        [this.rotationAttribute, 1],
        [this.radianceAttribute, 1],
      ];
      staticAttributes.forEach(([attribute, itemSize]) => {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(first * itemSize, count * itemSize);
        attribute.needsUpdate = true;
      });
      this.staticDirtyMin = this.capacity;
      this.staticDirtyMax = -1;
    }
    this.points.visible = this.effects.size > 0;
  }

  setPixelRatio(pixelRatio) {
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  get activeParticleCount() {
    return this.capacity - this.freeSlots.length;
  }

  reset() {
    this.effects.clear();
    this.alphas.fill(0);
    this.sizes.fill(0);
    this.slotAlive.fill(0);
    this.freeSlots.length = 0;
    for (let index = this.capacity - 1; index >= 0; index -= 1) {
      this.freeSlots.push(index);
    }
    this.maxDrawSlot = -1;
    this.staticDirtyMin = this.capacity;
    this.staticDirtyMax = -1;
    this.degradedPatchCount = 0;
    this.geometry.setDrawRange(0, 0);
    this.alphaAttribute.needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;
    this.points.visible = false;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.effects.clear();
  }
}

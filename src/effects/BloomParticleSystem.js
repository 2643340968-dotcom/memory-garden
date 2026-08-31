import * as THREE from "three";
import { clamp01 } from "../flowers/FlowerAnimation.js";
import { createSeededRandom, randomRange } from "../utils/random.js";
import { BLOOM_PATCH_CONFIG } from "../flowers/BloomPatchConfig.js";

const POINT_KIND_FLOWER = 0;
const POINT_KIND_CENTER = 1;
const PALE_EDGE_COLOR = new THREE.Color(0xded5ff);
const CENTER_GLOW_COLOR = new THREE.Color(0xd9c6ff);
const MATRIX_TEXELS_PER_FLOWER = 4;
const PATCH_STATE_TEXELS = 1;
const TEXTURE_WIDTH = 256;

function setTriplet(array, index, x, y, z) {
  const offset = index * 3;
  array[offset] = x;
  array[offset + 1] = y;
  array[offset + 2] = z;
}

function createFloatDataTexture(data, width, height, name) {
  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.name = name;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createParticleMaterial({
  pixelRatio,
  config,
  flowerMatrixTexture,
  flowerMatrixTextureSize,
  patchStateTexture,
  patchStateTextureSize,
}) {
  return new THREE.ShaderMaterial({
    name: "MemoryGardenAnalyticFlowerParticleMaterial",
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uFlowerMatrices: { value: flowerMatrixTexture },
      uFlowerMatrixTextureSize: { value: flowerMatrixTextureSize },
      uPatchStates: { value: patchStateTexture },
      uPatchStateTextureSize: { value: patchStateTextureSize },
      uBirthDuration: { value: config.FLOWER_PARTICLE_BIRTH_DURATION },
      uBirthHoldDuration: {
        value: config.FLOWER_PARTICLE_BIRTH_HOLD_DURATION,
      },
      uSettleDuration: { value: config.FLOWER_PARTICLE_SETTLE_DURATION },
      uDecayDuration: { value: config.DECAY_DURATION },
      uDriftAmount: { value: config.FLOWER_PARTICLE_DRIFT_AMOUNT },
      uEdgeBreakup: { value: config.DECAY_EDGE_BREAKUP_AMOUNT },
      uBirthOpacity: { value: config.FLOWER_PARTICLE_BIRTH_OPACITY },
      uIdleOpacity: { value: config.FLOWER_PARTICLE_IDLE_OPACITY },
      uAttendedOpacity: { value: config.FLOWER_PARTICLE_ATTENDED_OPACITY },
      uDecayOpacity: { value: config.FLOWER_PARTICLE_DECAY_OPACITY },
      uCenterGlowIntensity: { value: config.FLOWER_CENTER_GLOW_INTENSITY },
      uPatchAuraIntensity: { value: config.PATCH_GLOW_INTENSITY },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform sampler2D uFlowerMatrices;
      uniform vec2 uFlowerMatrixTextureSize;
      uniform sampler2D uPatchStates;
      uniform vec2 uPatchStateTextureSize;
      uniform float uBirthDuration;
      uniform float uBirthHoldDuration;
      uniform float uSettleDuration;
      uniform float uDecayDuration;
      uniform float uDriftAmount;
      uniform float uEdgeBreakup;
      uniform float uBirthOpacity;
      uniform float uIdleOpacity;
      uniform float uAttendedOpacity;
      uniform float uDecayOpacity;
      uniform float uCenterGlowIntensity;
      uniform float uPatchAuraIntensity;

      attribute vec3 aStartPosition;
      attribute vec3 aDecayPosition;
      attribute vec3 aDriftDirection;
      attribute vec3 color;
      attribute vec4 aShape;
      attribute vec4 aIdentity;
      attribute vec2 aAppearance;

      varying float vAlpha;
      varying float vSoftness;
      varying float vRotation;
      varying float vRadiance;
      varying vec3 vColor;

      vec2 texelUv(float linearIndex, vec2 textureSize) {
        float x = mod(linearIndex, textureSize.x);
        float y = floor(linearIndex / textureSize.x);
        return (vec2(x, y) + 0.5) / textureSize;
      }

      mat4 readFlowerMatrix(float flowerIndex) {
        float base = flowerIndex * 4.0;
        vec4 column0 = texture2D(
          uFlowerMatrices,
          texelUv(base, uFlowerMatrixTextureSize)
        );
        vec4 column1 = texture2D(
          uFlowerMatrices,
          texelUv(base + 1.0, uFlowerMatrixTextureSize)
        );
        vec4 column2 = texture2D(
          uFlowerMatrices,
          texelUv(base + 2.0, uFlowerMatrixTextureSize)
        );
        vec4 column3 = texture2D(
          uFlowerMatrices,
          texelUv(base + 3.0, uFlowerMatrixTextureSize)
        );
        return mat4(column0, column1, column2, column3);
      }

      vec4 readPatchState(float patchIndex) {
        return texture2D(
          uPatchStates,
          texelUv(patchIndex, uPatchStateTextureSize)
        );
      }

      float saturate(float value) {
        return clamp(value, 0.0, 1.0);
      }

      float smoother(float value) {
        float t = saturate(value);
        return t * t * (3.0 - 2.0 * t);
      }

      float easeOutCubic(float value) {
        float t = saturate(value);
        float inverse = 1.0 - t;
        return 1.0 - inverse * inverse * inverse;
      }

      void hidePoint() {
        gl_PointSize = 0.0;
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vAlpha = 0.0;
        vSoftness = 0.0;
        vRotation = 0.0;
        vRadiance = 0.0;
        vColor = vec3(0.0);
      }

      void main() {
        if (aIdentity.w < 0.5) {
          hidePoint();
          return;
        }

        vec4 patchState = readPatchState(aIdentity.z);
        float birthTime = patchState.x;
        float decayStartTime = patchState.y;
        float attentionEmphasis = patchState.z;
        float attention = patchState.w;
        float age = max(0.0, uTime - birthTime);
        float gatherProgress = saturate(age / max(0.001, uBirthDuration));
        float gatherDelay = aShape.w * 0.16;
        float gather = smoother(
          (gatherProgress - gatherDelay) / max(0.001, 1.0 - gatherDelay)
        );
        float settleProgress = smoother(
          (age - uBirthDuration - uBirthHoldDuration) /
          max(0.001, uSettleDuration)
        );
        bool isCenter = aIdentity.x > 0.5;

        mat4 flowerMatrix = readFlowerMatrix(aIdentity.y);
        vec3 targetPosition = (flowerMatrix * vec4(position, 1.0)).xyz;
        vec3 worldPosition;
        float pointAlpha;
        float pointSize;
        float radiance = aAppearance.y;

        if (decayStartTime >= 0.0) {
          float rawDecay = saturate(
            (uTime - decayStartTime) / max(0.001, uDecayDuration)
          );
          float delayedDecay = saturate(
            (rawDecay - (1.0 - aShape.z) * aShape.w * 0.11) / 0.89
          );
          float breakup = easeOutCubic(delayedDecay);
          float driftScale = breakup * (0.05 + aShape.z * uEdgeBreakup);
          worldPosition = aDecayPosition + vec3(
            aDriftDirection.x * driftScale,
            aDriftDirection.y * driftScale * 0.9 + breakup * 0.12,
            aDriftDirection.z * driftScale
          );
          float stableOpacity = mix(
            uIdleOpacity,
            uAttendedOpacity,
            attentionEmphasis * attention
          );
          float fragmentEnvelope = mix(
            stableOpacity,
            uDecayOpacity,
            smoother(rawDecay / 0.18)
          ) * pow(1.0 - delayedDecay, 0.72);
          pointAlpha = fragmentEnvelope * aShape.y;
          pointSize = aShape.x * (1.0 + breakup * 0.26);
          if (isCenter) {
            pointAlpha *= 0.42;
          }
        } else {
          worldPosition = mix(aStartPosition, targetPosition, gather);
          float coherence = mix(
            1.0,
            0.54,
            attentionEmphasis * attention
          );
          float surfaceDrift = sin(
            uTime * 1.1 + aShape.w * 6.28318530718
          ) * uDriftAmount *
            (0.35 + aShape.z * 0.65) * gather * coherence;
          worldPosition.x += surfaceDrift;
          worldPosition.y += abs(surfaceDrift) * 0.3;

          float stableOpacity = max(
            uIdleOpacity,
            mix(
              uIdleOpacity,
              uAttendedOpacity,
              attentionEmphasis * attention
            )
          );
          float birthOpacity = mix(
            uBirthOpacity,
            stableOpacity,
            settleProgress
          );
          float fadeIn = smoother(
            (gatherProgress - gatherDelay * 0.45) / 0.18
          );
          float shimmer = 1.0 + sin(
            uTime * 1.45 + aShape.w * 6.28318530718
          ) * 0.055;
          pointAlpha = birthOpacity * fadeIn * shimmer * aShape.y;
          pointSize = aShape.x * (0.82 + gather * 0.18);

          if (isCenter) {
            float birthProgress = saturate(age / max(0.001, uBirthDuration));
            float calmBase = uCenterGlowIntensity * 0.28;
            float attentionGlow = mix(
              calmBase,
              uCenterGlowIntensity,
              attentionEmphasis * attention
            );
            float distributedPatchAura =
              sin(birthProgress * 3.14159265359) * uPatchAuraIntensity;
            float birthGlow =
              sin(birthProgress * 3.14159265359) * uCenterGlowIntensity;
            pointAlpha = max(
              pointAlpha * 0.2,
              max(attentionGlow, birthGlow + distributedPatchAura)
            );
            pointSize = aShape.x * (0.88 + attention * 0.12);
            radiance *= 1.0 + distributedPatchAura * 4.0;
          }
        }

        vec4 viewPosition = modelViewMatrix * vec4(worldPosition, 1.0);
        float perspectiveScale = clamp(
          8.0 / max(0.01, -viewPosition.z),
          0.55,
          1.35
        );
        gl_PointSize = max(1.0, pointSize * uPixelRatio * perspectiveScale);
        gl_Position = projectionMatrix * viewPosition;
        vAlpha = pointAlpha;
        vSoftness = aAppearance.x;
        vRotation = aShape.w * 6.28318530718;
        vRadiance = radiance;
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
        float centerGlow = step(0.9, vSoftness);
        float alpha = vAlpha * mix(microPoint, softGlow, centerGlow);
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

    this.localPositions = new Float32Array(this.capacity * 3);
    this.startPositions = new Float32Array(this.capacity * 3);
    this.decayPositions = new Float32Array(this.capacity * 3);
    this.driftDirections = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 3);
    // shape = base size, sample intensity, petal-edge factor, random phase.
    this.shapeData = new Float32Array(this.capacity * 4);
    // identity = point kind, flower index, patch-state index, alive flag.
    this.identityData = new Float32Array(this.capacity * 4);
    // appearance = point softness, scene-linear radiance gain.
    this.appearanceData = new Float32Array(this.capacity * 2);
    this.slotAlive = new Uint8Array(this.capacity);
    this.slotGenerations = new Uint32Array(this.capacity);
    this.maxDrawSlot = -1;
    this.staticDirtyMin = this.capacity;
    this.staticDirtyMax = -1;
    this.degradedPatchCount = 0;
    this.matrixUpdatesThisFrame = 0;
    this.patchStateUpdatesThisFrame = 0;
    this.particleCpuUpdatesThisFrame = 0;

    for (let index = this.capacity - 1; index >= 0; index -= 1) {
      this.freeSlots.push(index);
    }

    const flowerTexelCount =
      flowerSystem.maxFlowers * MATRIX_TEXELS_PER_FLOWER;
    this.flowerMatrixTextureWidth = Math.min(TEXTURE_WIDTH, flowerTexelCount);
    this.flowerMatrixTextureHeight = Math.ceil(
      flowerTexelCount / this.flowerMatrixTextureWidth,
    );
    this.flowerMatrixData = new Float32Array(
      this.flowerMatrixTextureWidth * this.flowerMatrixTextureHeight * 4,
    );
    this.flowerMatrixTexture = createFloatDataTexture(
      this.flowerMatrixData,
      this.flowerMatrixTextureWidth,
      this.flowerMatrixTextureHeight,
      "MemoryGardenFlowerMatrixTexture",
    );

    this.patchCapacity = Math.max(
      32,
      Math.ceil(
        flowerSystem.maxFlowers /
          Math.max(1, flowerSystem.flowersPerBloomMin),
      ) + 16,
    );
    const patchTexelCount = this.patchCapacity * PATCH_STATE_TEXELS;
    this.patchStateTextureWidth = Math.min(TEXTURE_WIDTH, patchTexelCount);
    this.patchStateTextureHeight = Math.ceil(
      patchTexelCount / this.patchStateTextureWidth,
    );
    this.patchStateData = new Float32Array(
      this.patchStateTextureWidth * this.patchStateTextureHeight * 4,
    );
    this.patchStateTexture = createFloatDataTexture(
      this.patchStateData,
      this.patchStateTextureWidth,
      this.patchStateTextureHeight,
      "MemoryGardenPatchStateTexture",
    );
    this.freePatchSlots = [];
    for (let index = this.patchCapacity - 1; index >= 0; index -= 1) {
      this.freePatchSlots.push(index);
    }

    this.geometry = new THREE.BufferGeometry();
    this.staticAttributes = [
      ["position", this.localPositions, 3],
      ["aStartPosition", this.startPositions, 3],
      ["aDecayPosition", this.decayPositions, 3],
      ["aDriftDirection", this.driftDirections, 3],
      ["color", this.colors, 3],
      ["aShape", this.shapeData, 4],
      ["aIdentity", this.identityData, 4],
      ["aAppearance", this.appearanceData, 2],
    ].map(([name, array, itemSize]) => {
      const attribute = new THREE.BufferAttribute(array, itemSize);
      attribute.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, attribute);
      return { name, attribute, itemSize };
    });
    this.geometry.setDrawRange(0, 0);

    this.material = createParticleMaterial({
      pixelRatio: renderer.getPixelRatio(),
      config,
      flowerMatrixTexture: this.flowerMatrixTexture,
      flowerMatrixTextureSize: new THREE.Vector2(
        this.flowerMatrixTextureWidth,
        this.flowerMatrixTextureHeight,
      ),
      patchStateTexture: this.patchStateTexture,
      patchStateTextureSize: new THREE.Vector2(
        this.patchStateTextureWidth,
        this.patchStateTextureHeight,
      ),
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "MemoryGardenFlowerBodyParticlePool";
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.visible = false;
    this.points.userData.particleCapacity = this.capacity;
    this.points.userData.source = "png-alpha-silhouette";
    this.points.userData.motion = "analytic-vertex-shader";
    this.points.userData.patchAura = "distributed-center-bloom";
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
    this.identityData[slot * 4 + 3] = 1;
    this.slotGenerations[slot] += 1;
    this.maxDrawSlot = Math.max(this.maxDrawSlot, slot);
    this.markStaticDirty(slot);
    return slot;
  }

  releaseSlot(slot) {
    if (this.slotAlive[slot] === 0) {
      return;
    }
    this.slotAlive[slot] = 0;
    this.identityData[slot * 4 + 3] = 0;
    this.freeSlots.push(slot);
    this.markStaticDirty(slot);
    if (slot === this.maxDrawSlot) {
      while (
        this.maxDrawSlot >= 0 &&
        this.slotAlive[this.maxDrawSlot] === 0
      ) {
        this.maxDrawSlot -= 1;
      }
    }
  }

  markStaticDirty(slot) {
    this.staticDirtyMin = Math.min(this.staticDirtyMin, slot);
    this.staticDirtyMax = Math.max(this.staticDirtyMax, slot);
  }

  allocatePatchSlot() {
    return this.freePatchSlots.length > 0 ? this.freePatchSlots.pop() : -1;
  }

  releasePatchSlot(slot) {
    if (slot < 0) {
      return;
    }
    const offset = slot * 4;
    this.patchStateData[offset] = 0;
    this.patchStateData[offset + 1] = -1;
    this.patchStateData[offset + 2] = 0;
    this.patchStateData[offset + 3] = 0;
    this.patchStateTexture.needsUpdate = true;
    this.freePatchSlots.push(slot);
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

  setCommonPointState(effect, slot, flowerIndex, random) {
    const shapeOffset = slot * 4;
    const identityOffset = slot * 4;
    this.identityData[identityOffset + 1] = flowerIndex;
    this.identityData[identityOffset + 2] = effect.patchSlot;
    this.shapeData[shapeOffset + 3] = random();
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
  }

  createFlowerPoint(effect, flowerIndex, sample, random) {
    const slot = this.allocateSlot();
    if (slot < 0) {
      return false;
    }

    const shapeOffset = slot * 4;
    const identityOffset = slot * 4;
    const appearanceOffset = slot * 2;
    this.identityData[identityOffset] = POINT_KIND_FLOWER;
    this.shapeData[shapeOffset + 2] = sample.edge;
    this.shapeData[shapeOffset + 1] = clamp01(
      0.48 + sample.alpha * 0.36 + sample.center * 0.16,
    );
    setTriplet(this.localPositions, slot, sample.x, sample.y, sample.z);
    this.setCommonPointState(effect, slot, flowerIndex, random);
    this.shapeData[shapeOffset] = randomRange(
      random,
      this.config.FLOWER_PARTICLE_SIZE_MIN,
      this.config.FLOWER_PARTICLE_SIZE_MAX,
    ) * (0.88 + sample.alpha * 0.12 + sample.edge * 0.1);
    this.appearanceData[appearanceOffset] = 0.08 + sample.edge * 0.38;
    this.appearanceData[appearanceOffset + 1] =
      this.config.FLOWER_PARTICLE_HDR_GAIN;
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

    const shapeOffset = slot * 4;
    const identityOffset = slot * 4;
    const appearanceOffset = slot * 2;
    this.identityData[identityOffset] = POINT_KIND_CENTER;
    this.shapeData[shapeOffset + 2] = 0;
    this.shapeData[shapeOffset + 1] = 1;
    setTriplet(
      this.localPositions,
      slot,
      centerSample.x,
      centerSample.y,
      centerSample.z + 0.006,
    );
    this.setCommonPointState(effect, slot, flowerIndex, random);
    this.shapeData[shapeOffset] = this.config.FLOWER_CENTER_GLOW_RADIUS;
    this.appearanceData[appearanceOffset] = 1;
    this.appearanceData[appearanceOffset + 1] =
      this.config.FLOWER_CENTER_HDR_GAIN;
    this.setSolidSlotColor(slot, CENTER_GLOW_COLOR);
    effect.slots.push(slot);
    return true;
  }

  spawnBirth(patch) {
    if (this.effects.has(patch.id)) {
      return;
    }

    const patchSlot = this.allocatePatchSlot();
    if (patchSlot < 0) {
      this.degradedPatchCount += 1;
      return;
    }
    const random = createSeededRandom(
      (patch.bloomEvent.randomSeed ^ 0xf10a6e11) >>> 0,
    );
    const effect = {
      patch,
      patchSlot,
      slots: [],
      startTime: patch.birthTime,
      decayStartTime: null,
      attentionEmphasis: 1,
      lastSyncTime: patch.birthTime,
      flowerIndices: [...patch.flowerIndices],
    };
    const desiredSampleCount = Math.max(
      1,
      Math.round(
        this.config.FLOWER_PARTICLE_SAMPLE_COUNT *
          this.config.FLOWER_PARTICLE_ACTIVE_RATIO,
      ),
    );
    const reservedCenterSlots = effect.flowerIndices.length;
    const availableBodySlots = Math.max(
      0,
      this.freeSlots.length - reservedCenterSlots,
    );
    const sampleCount = Math.min(
      desiredSampleCount,
      Math.floor(availableBodySlots / Math.max(1, effect.flowerIndices.length)),
    );
    effect.samplesPerFlower = sampleCount;
    effect.degraded = sampleCount < desiredSampleCount;
    if (effect.degraded) {
      this.degradedPatchCount += 1;
    }
    if (sampleCount <= 0) {
      this.releasePatchSlot(patchSlot);
      return;
    }

    for (const flowerIndex of effect.flowerIndices) {
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

    if (effect.slots.length === 0) {
      this.releasePatchSlot(patchSlot);
      return;
    }
    this.effects.set(patch.id, effect);
    this.writePatchState(effect);
    this.points.visible = true;
    this.geometry.setDrawRange(0, this.maxDrawSlot + 1);
  }

  writePatchState(effect) {
    const offset = effect.patchSlot * 4;
    this.patchStateData[offset] = effect.patch.birthTime;
    this.patchStateData[offset + 1] = effect.decayStartTime ?? -1;
    this.patchStateData[offset + 2] = effect.attentionEmphasis;
    this.patchStateData[offset + 3] = effect.patch.attention;
    this.patchStateUpdatesThisFrame += 1;
  }

  writeFlowerMatrix(flowerIndex, matrix) {
    const offset = flowerIndex * 16;
    this.flowerMatrixData.set(matrix.elements, offset);
    this.matrixUpdatesThisFrame += 1;
  }

  captureAttachedPosition(slot) {
    const flowerIndex = this.identityData[slot * 4 + 1];
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
      this.decayPositions,
      slot,
      this.localPoint.x,
      this.localPoint.y,
      this.localPoint.z,
    );
    this.markStaticDirty(slot);
    return true;
  }

  spawnDecay(patch, flowerSystem, startTime) {
    const effect = this.effects.get(patch.id);
    if (!effect) {
      return;
    }
    effect.decayStartTime = startTime;
    for (const slot of effect.slots) {
      this.captureAttachedPosition(slot);
    }
    this.writePatchState(effect);
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
    this.writePatchState(effect);

    for (const flowerIndex of effect.flowerIndices) {
      if (this.flowerRenderer.getMatrixAt(flowerIndex, this.matrix)) {
        this.writeFlowerMatrix(flowerIndex, this.matrix);
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
    this.releasePatchSlot(effect.patchSlot);
    this.effects.delete(patchId);
    this.geometry.setDrawRange(0, this.maxDrawSlot + 1);
  }

  uploadStaticAttributes() {
    if (this.staticDirtyMax < this.staticDirtyMin) {
      return;
    }
    const first = this.staticDirtyMin;
    const count = this.staticDirtyMax - first + 1;
    this.staticAttributes.forEach(({ attribute, itemSize }) => {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(first * itemSize, count * itemSize);
      attribute.needsUpdate = true;
    });
    this.staticDirtyMin = this.capacity;
    this.staticDirtyMax = -1;
  }

  update(timeSeconds = 0) {
    this.material.uniforms.uTime.value = timeSeconds;
    this.geometry.setDrawRange(0, this.maxDrawSlot + 1);
    this.uploadStaticAttributes();
    if (this.effects.size > 0) {
      this.flowerMatrixTexture.needsUpdate = true;
      this.patchStateTexture.needsUpdate = true;
    }
    this.points.visible = this.effects.size > 0;
    this.particleCpuUpdatesThisFrame = 0;
  }

  setPixelRatio(pixelRatio) {
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  get activeParticleCount() {
    return this.capacity - this.freeSlots.length;
  }

  get diagnostics() {
    const staticStrideBytes = this.staticAttributes.reduce(
      (sum, { itemSize }) => sum + itemSize * 4,
      0,
    );
    return {
      mode: "analytic-vertex-shader",
      activeParticles: this.activeParticleCount,
      submittedSlots: this.maxDrawSlot + 1,
      holeCount: Math.max(0, this.maxDrawSlot + 1 - this.activeParticleCount),
      particleCpuUpdatesPerFrame: this.particleCpuUpdatesThisFrame,
      flowerMatrixUpdatesPerFrame: this.matrixUpdatesThisFrame,
      patchStateUpdatesPerFrame: this.patchStateUpdatesThisFrame,
      staticStrideBytes,
      staticCapacityBytes: staticStrideBytes * this.capacity,
      vertexAttributeCount: this.staticAttributes.length,
      dynamicTextureBytes:
        this.flowerMatrixData.byteLength + this.patchStateData.byteLength,
      drawClasses: 1,
      depthTest: this.material.depthTest,
      depthWrite: this.material.depthWrite,
      blending: "normal-alpha",
    };
  }

  resetFrameDiagnostics() {
    this.matrixUpdatesThisFrame = 0;
    this.patchStateUpdatesThisFrame = 0;
    this.particleCpuUpdatesThisFrame = 0;
  }

  reset() {
    this.effects.clear();
    this.slotAlive.fill(0);
    for (let index = 0; index < this.capacity; index += 1) {
      this.identityData[index * 4 + 3] = 0;
    }
    this.freeSlots.length = 0;
    for (let index = this.capacity - 1; index >= 0; index -= 1) {
      this.freeSlots.push(index);
    }
    this.patchStateData.fill(0);
    this.freePatchSlots.length = 0;
    for (let index = this.patchCapacity - 1; index >= 0; index -= 1) {
      this.freePatchSlots.push(index);
    }
    this.maxDrawSlot = -1;
    this.staticDirtyMin = 0;
    this.staticDirtyMax = this.capacity - 1;
    this.degradedPatchCount = 0;
    this.geometry.setDrawRange(0, 0);
    this.uploadStaticAttributes();
    this.patchStateTexture.needsUpdate = true;
    this.points.visible = false;
    this.resetFrameDiagnostics();
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.flowerMatrixTexture.dispose();
    this.patchStateTexture.dispose();
    this.effects.clear();
  }
}

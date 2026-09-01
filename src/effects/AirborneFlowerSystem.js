import * as THREE from "three";
import { createSeededRandom, randomRange } from "../utils/random.js";

const TWO_PI = Math.PI * 2;
const MEMORY_LAVENDER = Object.freeze([0.73, 0.62, 0.98]);
const TRIGGER_SEEDS = Object.freeze({
  bloom: 0x38d4a91f,
  memory: 0x6a09e667,
  decay: 0xbb67ae85,
});

const freezeTrigger = (config) => Object.freeze(config);

export const AIRBORNE_FLOWER_CONFIG = Object.freeze({
  particleCapacity: 512,
  pointSizeMin: 1.55,
  pointSizeMax: 2.8,
  mobileParticleRatio: 0.72,
  memoryColorMixMin: 0.24,
  memoryColorMixMax: 0.46,
  triggers: Object.freeze({
    bloom: freezeTrigger({
      fragmentCountMin: 1,
      fragmentCountMax: 1,
      pointsPerFragmentMin: 13,
      pointsPerFragmentMax: 18,
      lifetimeMin: 3.4,
      lifetimeMax: 4.7,
      scaleMin: 0.2,
      scaleMax: 0.31,
      opacityMin: 0.22,
      opacityMax: 0.32,
      riseMin: 0.18,
      riseMax: 0.3,
      spreadMin: 0.035,
      spreadMax: 0.09,
      originHeightMin: 0.22,
      originHeightMax: 0.42,
    }),
    memory: freezeTrigger({
      fragmentCountMin: 1,
      fragmentCountMax: 1,
      pointsPerFragmentMin: 17,
      pointsPerFragmentMax: 24,
      lifetimeMin: 4.1,
      lifetimeMax: 5.6,
      scaleMin: 0.24,
      scaleMax: 0.37,
      opacityMin: 0.26,
      opacityMax: 0.36,
      riseMin: 0.22,
      riseMax: 0.34,
      spreadMin: 0.045,
      spreadMax: 0.11,
      originHeightMin: 0.34,
      originHeightMax: 0.58,
    }),
    decay: freezeTrigger({
      fragmentCountMin: 2,
      fragmentCountMax: 2,
      pointsPerFragmentMin: 15,
      pointsPerFragmentMax: 22,
      lifetimeMin: 4.5,
      lifetimeMax: 6.2,
      scaleMin: 0.2,
      scaleMax: 0.34,
      opacityMin: 0.2,
      opacityMax: 0.3,
      riseMin: 0.16,
      riseMax: 0.29,
      spreadMin: 0.065,
      spreadMax: 0.15,
      originHeightMin: 0.24,
      originHeightMax: 0.56,
    }),
  }),
});

function randomInteger(random, minimum, maximum) {
  return Math.floor(random() * (maximum - minimum + 1)) + minimum;
}

function shuffleInPlace(values, random) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function selectFragmentSamples(sampleSet, pointCount, random, fragmentIndex) {
  const focusU = randomRange(random, 0.24, 0.76);
  const focusV = randomRange(random, 0.14, 0.48);
  const candidates = sampleSet.samples.filter((sample) => {
    if (sample.v > 0.66) {
      return false;
    }
    const normalizedX = (sample.u - focusU) / 0.42;
    const normalizedY = (sample.v - focusV) / 0.34;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  });
  const source = candidates.length >= pointCount ? candidates : sampleSet.samples;
  const shuffled = shuffleInPlace([...source], random);
  const selected = [];

  for (const sample of shuffled) {
    if (sample.v > 0.7) {
      continue;
    }
    const breakupField =
      Math.sin(sample.u * 17.3 + sample.v * 13.1 + fragmentIndex * 1.7) +
      Math.cos(sample.u * 9.2 - sample.v * 21.7 - fragmentIndex * 0.9);
    const presence = 0.38 + sample.edge * 0.28 + sample.alpha * 0.16;
    if (breakupField > -0.72 && random() < presence) {
      selected.push(sample);
    }
    if (selected.length >= pointCount) {
      break;
    }
  }

  for (const sample of shuffled) {
    if (selected.length >= pointCount) {
      break;
    }
    if (!selected.includes(sample) && sample.v <= 0.7) {
      selected.push(sample);
    }
  }

  if (selected.length === 0) {
    throw new Error("A transient flower fragment could not find PNG samples.");
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  selected.forEach((sample) => {
    minX = Math.min(minX, sample.x);
    maxX = Math.max(maxX, sample.x);
    minY = Math.min(minY, sample.y);
    maxY = Math.max(maxY, sample.y);
  });
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const height = Math.max(1e-4, maxY - minY);

  return selected.map((sample) => ({
    localX: (sample.x - centerX) / height,
    localY: (sample.y - centerY) / height,
    alpha: sample.alpha,
    edge: sample.edge,
    color: sample.color,
  }));
}

function createParticleMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    name: "EventDrivenMemoryFlowerFragmentMaterial",
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uMotionScale: { value: 1 },
      uCameraRight: { value: new THREE.Vector3(1, 0, 0) },
      uCameraUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uMotionScale;
      uniform vec3 uCameraRight;
      uniform vec3 uCameraUp;

      attribute vec3 aOrigin;
      attribute vec3 aVelocity;
      attribute vec3 aColor;
      attribute vec4 aLife;
      attribute vec4 aMotion;
      attribute vec2 aIdentity;

      varying vec3 vColor;
      varying float vAlpha;
      varying float vRadiance;

      void main() {
        float age = uTime - aLife.x;
        float lifetime = max(aLife.y, 0.0001);
        float age01 = clamp(age / lifetime, 0.0, 1.0);
        float alive = step(0.0, age) * step(age, lifetime) *
          step(0.5, aIdentity.y);
        float enter = smoothstep(0.0, 0.1, age01);
        float exit = 1.0 - smoothstep(0.62, 1.0, age01);
        float dispersion = age01 * age01;
        float curve = sin(aMotion.x + age * 0.82) * aMotion.y *
          dispersion * uMotionScale;
        float flutter = sin(aMotion.x * 1.7 + age * 1.18) *
          aMotion.z * age01 * uMotionScale;
        vec2 localPosition = position.xy *
          (1.0 + dispersion * (0.1 + aMotion.w * 0.18));
        vec3 worldPosition = aOrigin +
          uCameraRight * (localPosition.x + aVelocity.x * age + curve) +
          uCameraUp * (localPosition.y + flutter) +
          vec3(
            0.0,
            aVelocity.y * age * uMotionScale + age * age * 0.012 * uMotionScale,
            aVelocity.z * age * uMotionScale
          );
        vec4 viewPosition = viewMatrix * vec4(worldPosition, 1.0);

        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = aLife.w * uPixelRatio *
          (0.9 + aMotion.w * 0.24) *
          (1.0 - age01 * 0.12) * alive;
        vColor = aColor;
        vAlpha = aLife.z * enter * exit * alive *
          (0.68 + aMotion.w * 0.32);
        vRadiance = 1.02 + aMotion.w * 0.22;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vRadiance;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered);
        float coverage = smoothstep(0.5, 0.12, radius);
        float alpha = vAlpha * coverage;
        if (alpha < 0.006) {
          discard;
        }
        gl_FragColor = vec4(vColor * vRadiance, alpha);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

export function getAirborneParticleBudget(config = AIRBORNE_FLOWER_CONFIG) {
  const triggerTypes = Object.keys(config.triggers);
  const maximumParticlesPerEvent = Math.max(
    ...triggerTypes.map((type) => {
      const trigger = config.triggers[type];
      return trigger.fragmentCountMax * trigger.pointsPerFragmentMax;
    }),
  );
  return Object.freeze({
    particleCapacity: config.particleCapacity,
    drawCalls: 1,
    motionMode: "analytic-event-driven",
    capacityPolicy: "stable-ring-overwrite-oldest",
    initialActiveParticleCount: 0,
    triggerTypes: Object.freeze(triggerTypes),
    maximumParticlesPerEvent,
  });
}

export class AirborneFlowerSystem {
  constructor({
    scene,
    camera,
    renderer,
    flowerRenderer,
    flowerSystem = null,
    bloomPatchSystem = null,
    config = AIRBORNE_FLOWER_CONFIG,
  }) {
    if (typeof flowerRenderer?.getParticleSampleSet !== "function") {
      throw new TypeError(
        "Transient flower fragments require PNG particle sample libraries.",
      );
    }

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.flowerRenderer = flowerRenderer;
    this.config = config;
    this.budget = getAirborneParticleBudget(config);
    this.capacity = config.particleCapacity;
    this.nextSlot = 0;
    this.nextEmissionId = 1;
    this.lastTime = 0;
    this.latestEndTime = 0;
    this.isNarrow = camera.aspect < 0.72;
    this.eventCounts = { bloom: 0, memory: 0, decay: 0 };
    this.emissions = [];
    this.slotGenerations = new Uint32Array(this.capacity);
    this.slotEndTimes = new Float64Array(this.capacity);
    this.cameraRight = new THREE.Vector3();
    this.cameraUp = new THREE.Vector3();
    this.origin = new THREE.Vector3();

    this.geometry = new THREE.BufferGeometry();
    this.localData = new Float32Array(this.capacity * 3);
    this.originData = new Float32Array(this.capacity * 3);
    this.velocityData = new Float32Array(this.capacity * 3);
    this.colorData = new Float32Array(this.capacity * 3);
    this.lifeData = new Float32Array(this.capacity * 4);
    this.motionData = new Float32Array(this.capacity * 4);
    this.identityData = new Float32Array(this.capacity * 2);
    this.dynamicAttributes = [
      ["position", this.localData, 3],
      ["aOrigin", this.originData, 3],
      ["aVelocity", this.velocityData, 3],
      ["aColor", this.colorData, 3],
      ["aLife", this.lifeData, 4],
      ["aMotion", this.motionData, 4],
      ["aIdentity", this.identityData, 2],
    ].map(([name, data, itemSize]) => {
      const attribute = new THREE.BufferAttribute(data, itemSize).setUsage(
        THREE.DynamicDrawUsage,
      );
      this.geometry.setAttribute(name, attribute);
      return attribute;
    });
    this.geometry.setDrawRange(0, this.capacity);

    this.material = createParticleMaterial(renderer.getPixelRatio());
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "EventDrivenMemoryFlowerFragments";
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.points.userData.decorative = false;
    this.points.userData.pointerInteractive = false;
    this.points.userData.motion = "analytic-event-lifetime";
    this.points.userData.capacityPolicy = this.budget.capacityPolicy;
    scene.add(this.points);

    this.resize();
    this.unsubscribeBloom = flowerSystem?.onBloomCreated?.((bloomEvent) => {
      this.emitBloom(bloomEvent);
    });
    this.unsubscribeDecay = bloomPatchSystem?.onPatchDecay?.(
      (patch, timeSeconds) => this.emitDecay(patch, timeSeconds),
    );
  }

  resize() {
    this.camera.updateMatrixWorld();
    this.cameraRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    this.cameraUp.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
    this.material.uniforms.uCameraRight.value.copy(this.cameraRight);
    this.material.uniforms.uCameraUp.value.copy(this.cameraUp);
    this.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.material.uniforms.uMotionScale.value = prefersReducedMotion ? 0.28 : 1;
    this.isNarrow = this.camera.aspect < 0.72;
  }

  allocateSlot() {
    const slot = this.nextSlot;
    this.nextSlot = (this.nextSlot + 1) % this.capacity;
    this.slotGenerations[slot] += 1;
    return slot;
  }

  writeParticle(
    slot,
    sample,
    origin,
    velocity,
    birthTime,
    lifetime,
    opacity,
    pointSize,
    localScale,
    random,
  ) {
    const localOffset = slot * 3;
    this.localData[localOffset] = sample.localX * localScale;
    this.localData[localOffset + 1] = sample.localY * localScale;
    this.localData[localOffset + 2] = 0;
    this.originData[localOffset] = origin.x;
    this.originData[localOffset + 1] = origin.y;
    this.originData[localOffset + 2] = origin.z;
    this.velocityData[localOffset] = velocity.x;
    this.velocityData[localOffset + 1] = velocity.y;
    this.velocityData[localOffset + 2] = velocity.z;

    const memoryMix = THREE.MathUtils.lerp(
      this.config.memoryColorMixMin,
      this.config.memoryColorMixMax,
      sample.edge,
    );
    this.colorData[localOffset] = THREE.MathUtils.lerp(
      sample.color[0],
      MEMORY_LAVENDER[0],
      memoryMix,
    );
    this.colorData[localOffset + 1] = THREE.MathUtils.lerp(
      sample.color[1],
      MEMORY_LAVENDER[1],
      memoryMix,
    );
    this.colorData[localOffset + 2] = THREE.MathUtils.lerp(
      sample.color[2],
      MEMORY_LAVENDER[2],
      memoryMix,
    );

    const lifeOffset = slot * 4;
    this.lifeData[lifeOffset] = birthTime;
    this.lifeData[lifeOffset + 1] = lifetime;
    this.lifeData[lifeOffset + 2] = opacity * (0.72 + sample.alpha * 0.28);
    this.lifeData[lifeOffset + 3] = pointSize;
    this.motionData[lifeOffset] = random() * TWO_PI;
    this.motionData[lifeOffset + 1] = randomRange(random, 0.018, 0.055);
    this.motionData[lifeOffset + 2] = randomRange(random, 0.006, 0.018);
    this.motionData[lifeOffset + 3] = sample.edge;

    const identityOffset = slot * 2;
    this.identityData[identityOffset] = this.slotGenerations[slot];
    this.identityData[identityOffset + 1] = 1;
    this.slotEndTimes[slot] = birthTime + lifetime;
  }

  emit(type, worldPosition, timeSeconds = this.lastTime, options = {}) {
    const trigger = this.config.triggers[type];
    if (!trigger || !worldPosition) {
      return null;
    }

    const eventId = this.nextEmissionId++;
    const seed = (TRIGGER_SEEDS[type] ^ Math.imul(eventId, 0x45d9f3b)) >>> 0;
    const random = createSeededRandom(seed);
    const birthTime = Number.isFinite(timeSeconds) ? timeSeconds : this.lastTime;
    const fragmentCount = randomInteger(
      random,
      trigger.fragmentCountMin,
      trigger.fragmentCountMax,
    );
    const eventSlots = [];
    const eventGenerations = [];
    let eventEndTime = birthTime;

    for (let fragmentIndex = 0; fragmentIndex < fragmentCount; fragmentIndex += 1) {
      const variantIndex = randomInteger(
        random,
        0,
        this.flowerRenderer.particleSampleSets.length - 1,
      );
      const sampleSet = this.flowerRenderer.getParticleSampleSet(variantIndex);
      const requestedPointCount = randomInteger(
        random,
        trigger.pointsPerFragmentMin,
        trigger.pointsPerFragmentMax,
      );
      const pointCount = this.isNarrow
        ? Math.max(
            trigger.pointsPerFragmentMin,
            Math.round(requestedPointCount * this.config.mobileParticleRatio),
          )
        : requestedPointCount;
      const samples = selectFragmentSamples(
        sampleSet,
        pointCount,
        random,
        fragmentIndex,
      );
      const lifetime = randomRange(
        random,
        trigger.lifetimeMin,
        trigger.lifetimeMax,
      );
      const localScale = randomRange(random, trigger.scaleMin, trigger.scaleMax);
      const opacity = randomRange(
        random,
        trigger.opacityMin,
        trigger.opacityMax,
      );
      const horizontalBias = THREE.MathUtils.clamp(
        options.horizontalBias ?? 0,
        -1,
        1,
      );
      const spread = randomRange(random, trigger.spreadMin, trigger.spreadMax);
      const velocity = new THREE.Vector3(
        horizontalBias * 0.055 + randomRange(random, -spread, spread),
        randomRange(random, trigger.riseMin, trigger.riseMax),
        randomRange(random, -spread * 0.72, spread * 0.72),
      );
      this.origin.copy(worldPosition);
      this.origin.x += randomRange(random, -0.28, 0.28);
      this.origin.y += randomRange(
        random,
        trigger.originHeightMin,
        trigger.originHeightMax,
      );
      this.origin.z += randomRange(random, -0.22, 0.22);

      samples.forEach((sample) => {
        const slot = this.allocateSlot();
        this.writeParticle(
          slot,
          sample,
          this.origin,
          velocity,
          birthTime,
          lifetime,
          opacity,
          randomRange(random, this.config.pointSizeMin, this.config.pointSizeMax),
          localScale,
          random,
        );
        eventSlots.push(slot);
        eventGenerations.push(this.slotGenerations[slot]);
      });
      eventEndTime = Math.max(eventEndTime, birthTime + lifetime);
    }

    this.dynamicAttributes.forEach((attribute) => {
      attribute.needsUpdate = true;
    });
    this.emissions = this.emissions.filter(
      (emission) => emission.endTime > birthTime,
    );
    const emission = {
      id: eventId,
      type,
      birthTime,
      endTime: eventEndTime,
      slots: eventSlots,
      generations: eventGenerations,
    };
    this.emissions.push(emission);
    this.eventCounts[type] += 1;
    this.latestEndTime = Math.max(this.latestEndTime, eventEndTime);
    this.points.visible = true;
    return emission;
  }

  emitBloom(bloomEvent) {
    return this.emit(
      "bloom",
      bloomEvent?.anchorPosition,
      bloomEvent?.startTime,
    );
  }

  emitMemory(worldPosition, timeSeconds, options = {}) {
    return this.emit("memory", worldPosition, timeSeconds, options);
  }

  emitDecay(patch, timeSeconds) {
    return this.emit("decay", patch?.center, timeSeconds);
  }

  update(timeSeconds = 0) {
    this.lastTime = timeSeconds;
    this.material.uniforms.uTime.value = timeSeconds;
    if (this.points.visible && timeSeconds > this.latestEndTime) {
      this.points.visible = false;
    }
  }

  reset() {
    this.identityData.fill(0);
    this.lifeData.fill(0);
    this.slotEndTimes.fill(0);
    this.dynamicAttributes.forEach((attribute) => {
      attribute.needsUpdate = true;
    });
    this.nextSlot = 0;
    this.nextEmissionId = 1;
    this.latestEndTime = this.lastTime;
    this.eventCounts = { bloom: 0, memory: 0, decay: 0 };
    this.emissions.length = 0;
    this.points.visible = false;
  }

  countActiveParticles() {
    let activeCount = 0;
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (
        this.identityData[slot * 2 + 1] > 0.5 &&
        this.slotEndTimes[slot] > this.lastTime
      ) {
        activeCount += 1;
      }
    }
    return activeCount;
  }

  countActiveFragments() {
    return this.emissions.reduce((total, emission) => {
      if (emission.endTime <= this.lastTime) {
        return total;
      }
      const ownsAnySlot = emission.slots.some(
        (slot, index) =>
          this.slotGenerations[slot] === emission.generations[index] &&
          this.slotEndTimes[slot] > this.lastTime,
      );
      return total + (ownsAnySlot ? 1 : 0);
    }, 0);
  }

  get diagnostics() {
    const activeFragmentCount = this.countActiveFragments();
    return {
      mode: this.budget.motionMode,
      representation: "event-driven-stable-slot-flower-fragments",
      fragmentCount: activeFragmentCount,
      visibleFragmentCount: activeFragmentCount,
      particleCount: this.countActiveParticles(),
      particleCapacity: this.capacity,
      initialActiveParticleCount: this.budget.initialActiveParticleCount,
      triggerTypes: this.budget.triggerTypes,
      eventCounts: { ...this.eventCounts },
      drawCalls: this.points.visible ? this.budget.drawCalls : 0,
      particleCpuUpdatesPerFrame: 0,
      depthTest: this.material.depthTest,
      depthWrite: this.material.depthWrite,
      blending: "normal",
    };
  }

  dispose() {
    this.unsubscribeBloom?.();
    this.unsubscribeDecay?.();
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.emissions.length = 0;
  }
}

export function createAirborneFlowerSystem(options) {
  return new AirborneFlowerSystem(options);
}

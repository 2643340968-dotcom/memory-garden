import * as THREE from "three";
import { clamp01 } from "../flowers/FlowerAnimation.js";
import { createSeededRandom, randomRange } from "../utils/random.js";
import { BLOOM_PATCH_CONFIG } from "../flowers/BloomPatchConfig.js";

const BIRTH_COLOR_A = new THREE.Color(0xb99be8);
const BIRTH_COLOR_B = new THREE.Color(0x76539f);
const DECAY_COLOR_A = new THREE.Color(0xa889c9);
const DECAY_COLOR_B = new THREE.Color(0x5f496f);
const GLOW_COLOR = new THREE.Color(0x9c76c2);

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

function writeLerp(target, index, start, end, progress) {
  const offset = index * 3;
  target[offset] = THREE.MathUtils.lerp(start[offset], end[offset], progress);
  target[offset + 1] = THREE.MathUtils.lerp(
    start[offset + 1],
    end[offset + 1],
    progress,
  );
  target[offset + 2] = THREE.MathUtils.lerp(
    start[offset + 2],
    end[offset + 2],
    progress,
  );
}

function createParticleMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    name: "MemoryGardenBloomParticleMaterial",
    uniforms: {
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: `
      uniform float uPixelRatio;
      attribute float aAlpha;
      attribute float aSize;
      attribute float aSoftness;
      attribute vec3 color;
      varying float vAlpha;
      varying float vSoftness;
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
        vColor = color;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vSoftness;
      varying vec3 vColor;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        float exponent = mix(0.85, 2.6, vSoftness);
        float softDisc = pow(max(0.0, 1.0 - radius), exponent);
        float alpha = vAlpha * softDisc;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export class BloomParticleSystem {
  constructor(scene, renderer, config = BLOOM_PATCH_CONFIG) {
    this.scene = scene;
    this.config = config;
    this.capacity = config.PARTICLE_POOL_CAPACITY;
    this.effects = [];
    this.freeSlots = [];

    this.positions = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 3);
    this.alphas = new Float32Array(this.capacity);
    this.sizes = new Float32Array(this.capacity);
    this.softness = new Float32Array(this.capacity);
    this.startPositions = new Float32Array(this.capacity * 3);
    this.controlPositions = new Float32Array(this.capacity * 3);
    this.targetPositions = new Float32Array(this.capacity * 3);
    this.driftPositions = new Float32Array(this.capacity * 3);
    this.baseSizes = new Float32Array(this.capacity);

    for (let index = this.capacity - 1; index >= 0; index -= 1) {
      this.freeSlots.push(index);
    }

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 3);
    this.alphaAttribute = new THREE.BufferAttribute(this.alphas, 1);
    this.sizeAttribute = new THREE.BufferAttribute(this.sizes, 1);
    this.softnessAttribute = new THREE.BufferAttribute(this.softness, 1);
    [
      this.positionAttribute,
      this.colorAttribute,
      this.alphaAttribute,
      this.sizeAttribute,
      this.softnessAttribute,
    ].forEach((attribute) => attribute.setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setAttribute("color", this.colorAttribute);
    this.geometry.setAttribute("aAlpha", this.alphaAttribute);
    this.geometry.setAttribute("aSize", this.sizeAttribute);
    this.geometry.setAttribute("aSoftness", this.softnessAttribute);
    this.geometry.setDrawRange(0, this.capacity);

    this.material = createParticleMaterial(renderer.getPixelRatio());
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "MemoryGardenBloomEffectPool";
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.visible = false;
    this.points.userData.particleCapacity = this.capacity;
    scene.add(this.points);
  }

  allocateSlot() {
    return this.freeSlots.length > 0 ? this.freeSlots.pop() : -1;
  }

  setSlotColor(slot, colorA, colorB, mixture) {
    const offset = slot * 3;
    this.colors[offset] = THREE.MathUtils.lerp(colorA.r, colorB.r, mixture);
    this.colors[offset + 1] = THREE.MathUtils.lerp(
      colorA.g,
      colorB.g,
      mixture,
    );
    this.colors[offset + 2] = THREE.MathUtils.lerp(
      colorA.b,
      colorB.b,
      mixture,
    );
  }

  spawnBirth(patch, flowerSystem) {
    const random = createSeededRandom((patch.bloomEvent.randomSeed ^ 0xb106f00d) >>> 0);
    const slots = [];
    const flowerIndices = patch.flowerIndices;

    for (
      let particle = 0;
      particle < this.config.BLOOM_PARTICLE_COUNT;
      particle += 1
    ) {
      const slot = this.allocateSlot();
      if (slot < 0) {
        break;
      }

      const angle = randomRange(random, 0, Math.PI * 2);
      const startRadius = randomRange(random, 0.08, patch.bloomEvent.radius * 0.7);
      const controlRadius = randomRange(
        random,
        patch.bloomEvent.radius * 0.28,
        patch.bloomEvent.radius * 0.95,
      );
      const flowerIndex = flowerIndices[
        Math.min(flowerIndices.length - 1, Math.floor(random() * flowerIndices.length))
      ];
      const targetX = flowerSystem.positionsX[flowerIndex];
      const targetZ = flowerSystem.positionsZ[flowerIndex];
      const driftAngle = angle + randomRange(random, -0.55, 0.55);

      setTriplet(
        this.startPositions,
        slot,
        patch.center.x + Math.cos(angle) * startRadius,
        randomRange(random, 0.018, 0.055),
        patch.center.z + Math.sin(angle) * startRadius,
      );
      setTriplet(
        this.controlPositions,
        slot,
        patch.center.x + Math.cos(angle) * controlRadius,
        randomRange(random, 0.2, 0.72),
        patch.center.z + Math.sin(angle) * controlRadius,
      );
      setTriplet(
        this.targetPositions,
        slot,
        targetX + randomRange(random, -0.08, 0.08),
        randomRange(random, 0.12, 0.64),
        targetZ + randomRange(random, -0.08, 0.08),
      );
      setTriplet(
        this.driftPositions,
        slot,
        targetX + Math.cos(driftAngle) * randomRange(random, 0.08, 0.28),
        randomRange(random, 0.62, 1.05),
        targetZ + Math.sin(driftAngle) * randomRange(random, 0.08, 0.28),
      );
      this.baseSizes[slot] = randomRange(random, 2.2, 5.2);
      this.softness[slot] = randomRange(random, 0.12, 0.42);
      this.setSlotColor(slot, BIRTH_COLOR_A, BIRTH_COLOR_B, random());
      slots.push(slot);
    }

    if (slots.length > 0) {
      this.effects.push({
        type: "birth",
        slots,
        startTime: patch.birthTime,
        duration: this.config.BLOOM_PARTICLE_DURATION,
      });
    }
    this.spawnGlow(patch, random);
    this.points.visible = this.effects.length > 0;
    this.markStaticAttributesDirty();
  }

  spawnGlow(patch, random) {
    const slot = this.allocateSlot();
    if (slot < 0) {
      return;
    }

    setTriplet(
      this.startPositions,
      slot,
      patch.center.x,
      0.11,
      patch.center.z,
    );
    setTriplet(
      this.targetPositions,
      slot,
      patch.center.x,
      0.24,
      patch.center.z,
    );
    this.baseSizes[slot] = randomRange(
      random,
      this.config.BLOOM_GLOW_SIZE_MIN,
      this.config.BLOOM_GLOW_SIZE_MAX,
    );
    this.softness[slot] = 1;
    this.setSlotColor(slot, GLOW_COLOR, GLOW_COLOR, 0);
    this.effects.push({
      type: "glow",
      slots: [slot],
      startTime: patch.birthTime,
      duration: this.config.BLOOM_GLOW_DURATION,
    });
  }

  spawnDecay(patch, flowerSystem, startTime) {
    const random = createSeededRandom((patch.bloomEvent.randomSeed ^ 0xdecafbad) >>> 0);
    const slots = [];
    const flowerIndices = patch.flowerIndices;

    for (
      let particle = 0;
      particle < this.config.DECAY_PARTICLE_COUNT;
      particle += 1
    ) {
      const slot = this.allocateSlot();
      if (slot < 0) {
        break;
      }

      const flowerIndex = flowerIndices[
        Math.min(flowerIndices.length - 1, Math.floor(random() * flowerIndices.length))
      ];
      const startX = flowerSystem.positionsX[flowerIndex];
      const startZ = flowerSystem.positionsZ[flowerIndex];
      const angle = randomRange(random, 0, Math.PI * 2);
      const driftRadius = randomRange(random, 0.28, 0.86);

      setTriplet(
        this.startPositions,
        slot,
        startX + randomRange(random, -0.07, 0.07),
        randomRange(random, 0.08, 0.58),
        startZ + randomRange(random, -0.07, 0.07),
      );
      setTriplet(
        this.targetPositions,
        slot,
        startX + Math.cos(angle) * driftRadius,
        randomRange(random, 0.82, 1.48),
        startZ + Math.sin(angle) * driftRadius,
      );
      this.baseSizes[slot] = randomRange(random, 1.8, 3.8);
      this.softness[slot] = randomRange(random, 0.28, 0.58);
      this.setSlotColor(slot, DECAY_COLOR_A, DECAY_COLOR_B, random());
      slots.push(slot);
    }

    if (slots.length > 0) {
      this.effects.push({
        type: "decay",
        slots,
        startTime,
        duration: this.config.DECAY_PARTICLE_DURATION,
      });
      this.points.visible = true;
      this.markStaticAttributesDirty();
    }
  }

  updateBirth(effect, progress) {
    for (const slot of effect.slots) {
      if (progress < 0.32) {
        const phase = smoothstep(progress / 0.32);
        writeLerp(
          this.positions,
          slot,
          this.startPositions,
          this.controlPositions,
          phase,
        );
        this.alphas[slot] = smoothstep(progress / 0.1) * 0.62;
      } else if (progress < 0.78) {
        const phase = smoothstep((progress - 0.32) / 0.46);
        writeLerp(
          this.positions,
          slot,
          this.controlPositions,
          this.targetPositions,
          phase,
        );
        this.alphas[slot] = 0.62;
      } else {
        const phase = smoothstep((progress - 0.78) / 0.22);
        writeLerp(
          this.positions,
          slot,
          this.targetPositions,
          this.driftPositions,
          phase,
        );
        this.alphas[slot] = Math.pow(1 - phase, 2) * 0.62;
      }
      this.sizes[slot] = this.baseSizes[slot] * (0.84 + progress * 0.24);
    }
  }

  updateGlow(effect, progress) {
    const slot = effect.slots[0];
    const expansion = easeOutCubic(progress);
    writeLerp(
      this.positions,
      slot,
      this.startPositions,
      this.targetPositions,
      expansion,
    );
    this.sizes[slot] = this.baseSizes[slot] * (0.58 + expansion * 0.54);
    this.alphas[slot] =
      Math.sin(progress * Math.PI) * this.config.BLOOM_GLOW_INTENSITY;
  }

  updateDecay(effect, progress) {
    const movement = easeOutCubic(progress);
    for (const slot of effect.slots) {
      writeLerp(
        this.positions,
        slot,
        this.startPositions,
        this.targetPositions,
        movement,
      );
      this.sizes[slot] = this.baseSizes[slot] * (1 + progress * 0.36);
      this.alphas[slot] = Math.pow(1 - progress, 1.65) * 0.42;
    }
  }

  releaseEffect(effect) {
    for (const slot of effect.slots) {
      this.alphas[slot] = 0;
      this.sizes[slot] = 0;
      this.freeSlots.push(slot);
    }
  }

  update(timeSeconds) {
    if (this.effects.length === 0) {
      return;
    }

    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      const progress = (timeSeconds - effect.startTime) / effect.duration;
      if (progress >= 1) {
        this.releaseEffect(effect);
        this.effects.splice(index, 1);
        continue;
      }
      if (progress < 0) {
        continue;
      }

      if (effect.type === "birth") {
        this.updateBirth(effect, progress);
      } else if (effect.type === "glow") {
        this.updateGlow(effect, progress);
      } else {
        this.updateDecay(effect, progress);
      }
    }

    this.positionAttribute.needsUpdate = true;
    this.alphaAttribute.needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;
    this.points.visible = this.effects.length > 0;
  }

  markStaticAttributesDirty() {
    this.colorAttribute.needsUpdate = true;
    this.softnessAttribute.needsUpdate = true;
  }

  setPixelRatio(pixelRatio) {
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  get activeParticleCount() {
    return this.capacity - this.freeSlots.length;
  }

  reset() {
    this.effects.length = 0;
    this.alphas.fill(0);
    this.sizes.fill(0);
    this.freeSlots.length = 0;
    for (let index = this.capacity - 1; index >= 0; index -= 1) {
      this.freeSlots.push(index);
    }
    this.alphaAttribute.needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;
    this.points.visible = false;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}

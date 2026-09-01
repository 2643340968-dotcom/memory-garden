import * as THREE from "three";
import { clamp01 } from "./FlowerAnimation.js";
import { BLOOM_PATCH_CONFIG } from "./BloomPatchConfig.js";
import { BloomParticleSystem } from "../effects/BloomParticleSystem.js";

export class BloomPatchSystem {
  constructor({
    scene,
    renderer,
    flowerSystem,
    config = BLOOM_PATCH_CONFIG,
    particleSystem = null,
  }) {
    if (typeof flowerSystem.flowerRenderer.releaseInstance !== "function") {
      throw new TypeError(
        "BloomPatchSystem requires a flower renderer with reusable instance slots.",
      );
    }
    this.config = config;
    this.flowerSystem = flowerSystem;
    this.particleSystem =
      particleSystem ??
      new BloomParticleSystem(scene, renderer, flowerSystem, config);
    this.patches = [];
    this.nextPatchId = 1;
    this.decayStartedCount = 0;
    this.deadPatchCount = 0;
    this.patchDecayListeners = new Set();
    this.attentionRadiusSquared = config.ATTENTION_RADIUS ** 2;
    this.unsubscribeFromBlooms = flowerSystem.onBloomCreated((bloomEvent) => {
      this.createPatch(bloomEvent);
    });
  }

  createPatch(bloomEvent) {
    const patch = {
      id: `bloom-patch-${this.nextPatchId++}`,
      center: bloomEvent.anchorPosition.clone(),
      flowers: bloomEvent.flowerIndices,
      flowerIndices: bloomEvent.flowerIndices,
      memoryId: bloomEvent.memoryId,
      birthTime: bloomEvent.startTime,
      age: 0,
      attention: 1,
      attended: false,
      lastAttentionTime: bloomEvent.startTime,
      state: "growing",
      decayStartTime: null,
      vitality: 1,
      bloomEvent,
    };

    this.patches.push(patch);
    this.particleSystem.spawnBirth(patch, this.flowerSystem);
    return patch;
  }

  updateAttention(patch, timeSeconds, deltaSeconds, pointerGroundPosition) {
    patch.attended = false;
    if (
      pointerGroundPosition &&
      pointerGroundPosition.distanceToSquared(patch.center) <=
        this.attentionRadiusSquared
    ) {
      patch.attended = true;
      const distance = Math.sqrt(
        pointerGroundPosition.distanceToSquared(patch.center),
      );
      const proximity = 1 - distance / this.config.ATTENTION_RADIUS;
      const softGain = 0.35 + proximity * 0.65;
      patch.attention = clamp01(
        patch.attention +
          this.config.ATTENTION_GAIN_RATE * deltaSeconds * softGain,
      );
      patch.lastAttentionTime = timeSeconds;
      return;
    }

    patch.attention = clamp01(
      patch.attention - this.config.ATTENTION_DECAY_RATE * deltaSeconds,
    );
  }

  shouldBeginDecay(patch, timeSeconds) {
    return (
      patch.age >= this.config.MIN_PATCH_LIFETIME &&
      patch.attention <= this.config.DECAY_THRESHOLD &&
      timeSeconds - patch.lastAttentionTime >=
        this.config.ATTENTION_GRACE_DURATION
    );
  }

  beginDecay(patch, timeSeconds) {
    patch.state = "decaying";
    patch.decayStartTime = timeSeconds;
    this.decayStartedCount += 1;
    this.flowerSystem.beginBloomDecay(patch.bloomEvent);
    this.particleSystem.spawnDecay(patch, this.flowerSystem, timeSeconds);
    this.patchDecayListeners.forEach((listener) => listener(patch, timeSeconds));
  }

  onPatchDecay(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("BloomPatch decay listeners must be functions.");
    }
    this.patchDecayListeners.add(listener);
    return () => this.patchDecayListeners.delete(listener);
  }

  update(timeSeconds, deltaSeconds, pointerGroundPosition = null) {
    const safeDelta = THREE.MathUtils.clamp(deltaSeconds, 0, 1);
    this.particleSystem.resetFrameDiagnostics?.();

    for (let index = this.patches.length - 1; index >= 0; index -= 1) {
      const patch = this.patches[index];
      patch.age = Math.max(0, timeSeconds - patch.birthTime);
      patch.memoryId = patch.bloomEvent.memoryId;

      if (patch.state !== "decaying") {
        this.updateAttention(
          patch,
          timeSeconds,
          safeDelta,
          pointerGroundPosition,
        );

        if (
          patch.state === "growing" &&
          patch.age >= patch.bloomEvent.duration + 0.28
        ) {
          patch.state = "alive";
        }

        if (this.shouldBeginDecay(patch, timeSeconds)) {
          this.beginDecay(patch, timeSeconds);
        }
      }

      if (patch.state === "decaying") {
        const decayProgress = clamp01(
          (timeSeconds - patch.decayStartTime) / this.config.DECAY_DURATION,
        );
        patch.vitality = 1 - decayProgress;
        this.flowerSystem.updateBloomDecay(
          patch.bloomEvent,
          decayProgress,
          timeSeconds,
        );

        if (decayProgress >= 1) {
          patch.state = "dead";
          patch.vitality = 0;
          this.particleSystem.releasePatch?.(patch.id);
          this.flowerSystem.releaseBloom(patch.bloomEvent);
          this.deadPatchCount += 1;
          this.patches.splice(index, 1);
          continue;
        }
      }

      this.particleSystem.syncPatch?.(
        patch,
        this.flowerSystem,
        timeSeconds,
      );
    }

    this.particleSystem.update(timeSeconds);
  }

  setPixelRatio(pixelRatio) {
    this.particleSystem.setPixelRatio(pixelRatio);
  }

  reset() {
    this.patches.length = 0;
    this.nextPatchId = 1;
    this.decayStartedCount = 0;
    this.deadPatchCount = 0;
    this.particleSystem.reset();
  }

  dispose() {
    this.unsubscribeFromBlooms?.();
    this.particleSystem.dispose();
    this.patches.length = 0;
    this.patchDecayListeners.clear();
  }
}

export function createBloomPatchSystem(options) {
  return new BloomPatchSystem(options);
}

import * as THREE from "three";
import { CONFIG } from "../config.js";

export class FlowerSpawner {
  constructor(flowerSystem) {
    this.flowerSystem = flowerSystem;
    this.planting = false;
    this.lastBloomAnchor = new THREE.Vector3();
    this.segmentStart = new THREE.Vector3();
    this.segmentDirection = new THREE.Vector3();
    this.sampleAnchor = new THREE.Vector3();
    this.lastScheduledBloomTime = Number.NEGATIVE_INFINITY;
  }

  update(worldPoint, active, timeSeconds) {
    if (!active || !worldPoint || this.flowerSystem.isFull()) {
      this.planting = false;
      return;
    }

    if (!this.planting) {
      this.flowerSystem.createBloom(worldPoint, timeSeconds);
      this.lastBloomAnchor.copy(worldPoint);
      this.lastScheduledBloomTime = timeSeconds;
      this.planting = true;
      return;
    }

    const distance = this.lastBloomAnchor.distanceTo(worldPoint);
    if (distance < CONFIG.BLOOM_TRIGGER_DISTANCE) {
      return;
    }

    this.segmentStart.copy(this.lastBloomAnchor);
    this.segmentDirection
      .subVectors(worldPoint, this.segmentStart)
      .multiplyScalar(1 / distance);

    const bloomCount = Math.min(
      Math.floor(distance / CONFIG.BLOOM_TRIGGER_DISTANCE),
      CONFIG.MAX_BLOOMS_PER_FRAME,
    );
    const cooldownSeconds = CONFIG.BLOOM_TRIGGER_COOLDOWN * 0.001;

    for (let bloom = 1; bloom <= bloomCount; bloom += 1) {
      if (this.flowerSystem.isFull()) {
        break;
      }

      this.sampleAnchor
        .copy(this.segmentStart)
        .addScaledVector(
          this.segmentDirection,
          CONFIG.BLOOM_TRIGGER_DISTANCE * bloom,
        );

      const scheduledTime = Math.max(
        timeSeconds,
        this.lastScheduledBloomTime + cooldownSeconds,
      );
      this.flowerSystem.createBloom(this.sampleAnchor, scheduledTime);
      this.lastScheduledBloomTime = scheduledTime;
      this.lastBloomAnchor.copy(this.sampleAnchor);
    }
  }

  reset() {
    this.planting = false;
    this.lastScheduledBloomTime = Number.NEGATIVE_INFINITY;
  }
}

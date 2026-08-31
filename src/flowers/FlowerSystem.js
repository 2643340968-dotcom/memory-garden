import * as THREE from "three";
import { CONFIG } from "../config.js";
import { BloomEvent } from "./BloomEvent.js";
import { clamp01, easeOutBloom } from "./FlowerAnimation.js";
import { createSeededRandom, randomIntInclusive, randomRange } from "../utils/random.js";
import { assertFlowerRenderer } from "./renderers/FlowerRenderer.js";

export class FlowerSystem {
  constructor(scene, camera, flowerRenderer, groundRaycaster, viewportElement) {
    this.scene = scene;
    this.camera = camera;
    const fieldConfig = flowerRenderer.fieldConfig ?? {};
    this.flowerRenderer = assertFlowerRenderer(
      flowerRenderer,
      fieldConfig.maxFlowers ?? CONFIG.MAX_FLOWERS,
    );
    this.groundRaycaster = groundRaycaster;
    this.viewportElement = viewportElement;
    this.normalizationScale = this.flowerRenderer.normalizationScale;
    const transformConfig = this.flowerRenderer.transformConfig ?? {};
    this.orientationMode = transformConfig.orientationMode ?? "random-yaw";
    this.scaleMin = transformConfig.scaleMin ?? CONFIG.FLOWER_SCALE_MIN;
    this.scaleMax = transformConfig.scaleMax ?? CONFIG.FLOWER_SCALE_MAX;
    this.yawMax = transformConfig.yawMax ?? Math.PI;
    this.tiltMax = transformConfig.tiltMax ?? CONFIG.FLOWER_TILT_MAX;
    this.mirrorProbability = transformConfig.mirrorProbability ?? 0;
    this.startYOffset =
      transformConfig.startYOffset ?? CONFIG.BLOOM_START_Y_OFFSET;
    this.maxFlowers = fieldConfig.maxFlowers ?? CONFIG.MAX_FLOWERS;
    this.flowersPerBloomMin =
      fieldConfig.flowersPerBloomMin ?? CONFIG.FLOWERS_PER_BLOOM_MIN;
    this.flowersPerBloomMax =
      fieldConfig.flowersPerBloomMax ?? CONFIG.FLOWERS_PER_BLOOM_MAX;
    this.count = 0;
    this.nextUnusedIndex = 0;
    this.freeFlowerIndices = [];
    this.blooms = [];
    this.bloomListeners = new Set();
    this.random = createSeededRandom((Date.now() ^ 0x71f20ca) >>> 0);

    this.positionsX = new Float32Array(this.maxFlowers);
    this.positionsZ = new Float32Array(this.maxFlowers);
    this.scales = new Float32Array(this.maxFlowers);
    this.mirrorsX = new Int8Array(this.maxFlowers);
    this.rotationsY = new Float32Array(this.maxFlowers);
    this.tiltsX = new Float32Array(this.maxFlowers);
    this.tiltsZ = new Float32Array(this.maxFlowers);
    this.startTimes = new Float32Array(this.maxFlowers);
    this.durations = new Float32Array(this.maxFlowers);
    this.swayPhases = new Float32Array(this.maxFlowers);
    this.swaySpeeds = new Float32Array(this.maxFlowers);
    this.swayAmounts = new Float32Array(this.maxFlowers);
    this.activeFlowerIndices = new Uint32Array(this.maxFlowers);
    this.settledFlowers = new Uint8Array(this.maxFlowers);
    this.aliveFlowers = new Uint8Array(this.maxFlowers);
    this.activeFlowerCount = 0;
    this.settledUpdateCursor = 0;
    this.capacityReachedLogged = false;
    this.matricesDirty = false;

    // Bloom patch construction reuses these buffers. Only one lightweight
    // BloomEvent descriptor is allocated per large vegetation burst.
    this.lobeScreenX = new Float32Array(CONFIG.BLOOM_LOBE_MAX);
    this.lobeScreenY = new Float32Array(CONFIG.BLOOM_LOBE_MAX);
    this.lobeRadiusPx = new Float32Array(CONFIG.BLOOM_LOBE_MAX);
    this.lobeScaleX = new Float32Array(CONFIG.BLOOM_LOBE_MAX);
    this.lobeScaleY = new Float32Array(CONFIG.BLOOM_LOBE_MAX);
    this.lobeRotation = new Float32Array(CONFIG.BLOOM_LOBE_MAX);
    this.lobeWeights = new Float32Array(CONFIG.BLOOM_LOBE_MAX);
    this.lobeFlowerCounts = new Uint8Array(CONFIG.BLOOM_LOBE_MAX);
    this.projectedGroundPoint = new THREE.Vector3();
    this.anchorNdc = new THREE.Vector3();

    this.dummy = new THREE.Object3D();
    this.flowerRenderer.addToScene(scene);
  }

  createBloom(anchorWorld, startTime, { memoryId = null } = {}) {
    if (this.count >= this.maxFlowers) {
      return null;
    }

    const viewportWidth = Math.max(
      1,
      this.viewportElement.clientWidth || this.viewportElement.width || 1,
    );
    const viewportHeight = Math.max(
      1,
      this.viewportElement.clientHeight || this.viewportElement.height || 1,
    );
    const randomSeed = Math.floor(this.random() * 0xffffffff) >>> 0;
    const bloomRandom = createSeededRandom(randomSeed);
    const bloomRadius = randomRange(
      bloomRandom,
      CONFIG.BLOOM_RADIUS_MIN,
      CONFIG.BLOOM_RADIUS_MAX,
    );
    const bloomRadiusPx = bloomRadius * CONFIG.BLOOM_RADIUS_PX_SCALE;
    const bloomDuration = randomRange(
      bloomRandom,
      CONFIG.BLOOM_DURATION_MIN,
      CONFIG.BLOOM_DURATION_MAX,
    );
    const lobeCount = randomIntInclusive(
      bloomRandom,
      CONFIG.BLOOM_LOBE_MIN,
      CONFIG.BLOOM_LOBE_MAX,
    );
    const targetFlowerCount = Math.min(
      randomIntInclusive(
        bloomRandom,
        this.flowersPerBloomMin,
        this.flowersPerBloomMax,
      ),
      this.maxFlowers - this.count,
    );

    this.anchorNdc.copy(anchorWorld).project(this.camera);
    const cursorScreenX = (this.anchorNdc.x * 0.5 + 0.5) * viewportWidth;
    const cursorScreenY = (-this.anchorNdc.y * 0.5 + 0.5) * viewportHeight;
    const anchorJitterAngle = randomRange(bloomRandom, 0, Math.PI * 2);
    const anchorJitterPx =
      CONFIG.BLOOM_ANCHOR_JITTER *
      CONFIG.BLOOM_RADIUS_PX_SCALE *
      randomRange(bloomRandom, 0.35, 1);
    const bloomScreenX = cursorScreenX + Math.cos(anchorJitterAngle) * anchorJitterPx;
    const bloomScreenY = cursorScreenY + Math.sin(anchorJitterAngle) * anchorJitterPx;

    const hasProjectedAnchor = this.groundRaycaster.getGroundPointFromPixel(
      bloomScreenX,
      bloomScreenY,
      viewportWidth,
      viewportHeight,
      this.projectedGroundPoint,
    );
    const bloomAnchorPosition = hasProjectedAnchor
      ? this.projectedGroundPoint.clone()
      : anchorWorld.clone();

    let totalWeight = 0;
    this.lobeFlowerCounts.fill(0);

    for (let lobe = 0; lobe < lobeCount; lobe += 1) {
      const offsetAngle = randomRange(bloomRandom, 0, Math.PI * 2);
      const offsetRadius =
        bloomRadiusPx *
        randomRange(bloomRandom, 0.12, CONFIG.LOBE_OFFSET_RADIUS);

      this.lobeScreenX[lobe] = bloomScreenX + Math.cos(offsetAngle) * offsetRadius;
      this.lobeScreenY[lobe] = bloomScreenY + Math.sin(offsetAngle) * offsetRadius;
      this.lobeRadiusPx[lobe] =
        bloomRadiusPx * randomRange(bloomRandom, 0.34, 0.62);
      this.lobeScaleX[lobe] = randomRange(bloomRandom, 0.72, 1.32);
      this.lobeScaleY[lobe] = randomRange(bloomRandom, 0.72, 1.32);
      this.lobeRotation[lobe] = randomRange(bloomRandom, 0, Math.PI * 2);
      this.lobeWeights[lobe] = randomRange(bloomRandom, 0.45, 1.6);
      totalWeight += this.lobeWeights[lobe];
    }

    const reservedFlowers = Math.min(targetFlowerCount, lobeCount * 3);
    for (let flower = 0; flower < reservedFlowers; flower += 1) {
      this.lobeFlowerCounts[flower % lobeCount] += 1;
    }

    for (let flower = reservedFlowers; flower < targetFlowerCount; flower += 1) {
      let selection = bloomRandom() * totalWeight;
      let chosenLobe = lobeCount - 1;

      for (let lobe = 0; lobe < lobeCount; lobe += 1) {
        selection -= this.lobeWeights[lobe];
        if (selection <= 0) {
          chosenLobe = lobe;
          break;
        }
      }

      this.lobeFlowerCounts[chosenLobe] += 1;
    }

    const hasExclusionPocket = bloomRandom() < 0.58;
    const exclusionAngle = randomRange(bloomRandom, 0, Math.PI * 2);
    const exclusionDistance = bloomRadiusPx * randomRange(bloomRandom, 0.15, 0.52);
    const exclusionX = bloomScreenX + Math.cos(exclusionAngle) * exclusionDistance;
    const exclusionY = bloomScreenY + Math.sin(exclusionAngle) * exclusionDistance;
    const exclusionRadius = bloomRadiusPx * randomRange(bloomRandom, 0.1, 0.2);
    const exclusionRadiusSquared = exclusionRadius * exclusionRadius;
    const flowerIndices = [];

    for (let lobe = 0; lobe < lobeCount; lobe += 1) {
      const ellipseCos = Math.cos(this.lobeRotation[lobe]);
      const ellipseSin = Math.sin(this.lobeRotation[lobe]);
      const flowersInLobe = this.lobeFlowerCounts[lobe];
      let accepted = 0;
      let attempts = 0;
      const maximumAttempts = flowersInLobe * 5;

      while (
        accepted < flowersInLobe &&
        attempts < maximumAttempts &&
        this.count < this.maxFlowers
      ) {
        attempts += 1;
        const angle = randomRange(bloomRandom, 0, Math.PI * 2);
        const radialExponent = randomRange(bloomRandom, 1.5, 2.2);
        const normalizedRadius = Math.pow(bloomRandom(), radialExponent);
        const radiusPx = normalizedRadius * this.lobeRadiusPx[lobe];
        const ellipseX = Math.cos(angle) * radiusPx * this.lobeScaleX[lobe];
        const ellipseY = Math.sin(angle) * radiusPx * this.lobeScaleY[lobe];
        const screenX =
          this.lobeScreenX[lobe] + ellipseX * ellipseCos - ellipseY * ellipseSin;
        const screenY =
          this.lobeScreenY[lobe] + ellipseX * ellipseSin + ellipseY * ellipseCos;

        const edgeRejection =
          CONFIG.BLOOM_EDGE_REJECTION * (0.3 + normalizedRadius * 1.2);
        if (bloomRandom() < edgeRejection) {
          continue;
        }

        const exclusionDeltaX = screenX - exclusionX;
        const exclusionDeltaY = screenY - exclusionY;
        if (
          hasExclusionPocket &&
          exclusionDeltaX * exclusionDeltaX + exclusionDeltaY * exclusionDeltaY <
            exclusionRadiusSquared &&
          bloomRandom() < 0.88
        ) {
          continue;
        }

        if (
          !this.groundRaycaster.getGroundPointFromPixel(
            screenX,
            screenY,
            viewportWidth,
            viewportHeight,
            this.projectedGroundPoint,
          )
        ) {
          continue;
        }

        let nearestNormalizedDistanceSquared = Number.POSITIVE_INFINITY;
        for (let center = 0; center < lobeCount; center += 1) {
          const deltaX = screenX - this.lobeScreenX[center];
          const deltaY = screenY - this.lobeScreenY[center];
          const centerRadius = Math.max(1, this.lobeRadiusPx[center]);
          const normalizedDistanceSquared =
            (deltaX * deltaX + deltaY * deltaY) / (centerRadius * centerRadius);
          nearestNormalizedDistanceSquared = Math.min(
            nearestNormalizedDistanceSquared,
            normalizedDistanceSquared,
          );
        }

        const outwardProgress = Math.min(
          1,
          Math.sqrt(nearestNormalizedDistanceSquared),
        );
        const waveDelay = Math.max(
          0,
          outwardProgress * CONFIG.BLOOM_OUTWARD_DELAY +
            randomRange(
              bloomRandom,
              -CONFIG.BLOOM_DELAY_MAX,
              CONFIG.BLOOM_DELAY_MAX,
            ),
        );

        const flowerIndex = this.spawnFlowerIndex(
          this.projectedGroundPoint.x,
          this.projectedGroundPoint.z,
          startTime,
          bloomDuration * randomRange(bloomRandom, 0.88, 1.08),
          waveDelay,
          bloomRandom,
        );
        if (flowerIndex < 0) {
          break;
        }
        flowerIndices.push(flowerIndex);
        accepted += 1;
      }
    }

    const flowerCount = flowerIndices.length;
    if (flowerCount === 0) {
      return null;
    }

    const lobeCentersScreen = new Float32Array(lobeCount * 2);
    for (let lobe = 0; lobe < lobeCount; lobe += 1) {
      lobeCentersScreen[lobe * 2] = this.lobeScreenX[lobe];
      lobeCentersScreen[lobe * 2 + 1] = this.lobeScreenY[lobe];
    }

    const bloomEvent = new BloomEvent({
      anchorPosition: bloomAnchorPosition,
      startTime,
      duration: bloomDuration,
      radius: bloomRadius,
      flowerCount,
      firstFlowerIndex: flowerIndices[0],
      flowerIndices,
      randomSeed,
      lobeCentersScreen,
      memoryId,
    });
    this.blooms.push(bloomEvent);
    this.bloomListeners.forEach((listener) => listener(bloomEvent));
    return bloomEvent;
  }

  onBloomCreated(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Bloom listener must be a function.");
    }

    this.bloomListeners.add(listener);
    return () => this.bloomListeners.delete(listener);
  }

  spawnFlower(x, z, bloomStartTime, duration, waveDelay, random) {
    return (
      this.spawnFlowerIndex(
        x,
        z,
        bloomStartTime,
        duration,
        waveDelay,
        random,
      ) >= 0
    );
  }

  spawnFlowerIndex(x, z, bloomStartTime, duration, waveDelay, random) {
    if (this.count >= this.maxFlowers) {
      return -1;
    }

    const index =
      this.freeFlowerIndices.length > 0
        ? this.freeFlowerIndices.pop()
        : this.nextUnusedIndex++;
    this.positionsX[index] = x + randomRange(
      random,
      -CONFIG.FLOWER_POSITION_JITTER,
      CONFIG.FLOWER_POSITION_JITTER,
    );
    this.positionsZ[index] = z + randomRange(
      random,
      -CONFIG.FLOWER_POSITION_JITTER,
      CONFIG.FLOWER_POSITION_JITTER,
    );
    this.flowerRenderer.allocateInstance?.(index, random);
    this.scales[index] =
      this.normalizationScale *
      randomRange(random, this.scaleMin, this.scaleMax);
    if (this.orientationMode === "camera-facing") {
      const cameraDirectionX = this.camera.position.x - this.positionsX[index];
      const cameraDirectionZ = this.camera.position.z - this.positionsZ[index];
      const cameraFacingYaw = Math.atan2(cameraDirectionX, cameraDirectionZ);
      this.rotationsY[index] =
        cameraFacingYaw + randomRange(random, -this.yawMax, this.yawMax);
    } else {
      this.rotationsY[index] = randomRange(random, 0, Math.PI * 2);
    }
    this.tiltsX[index] = randomRange(
      random,
      -this.tiltMax,
      this.tiltMax,
    );
    this.tiltsZ[index] = randomRange(
      random,
      -this.tiltMax,
      this.tiltMax,
    );
    this.mirrorsX[index] =
      this.mirrorProbability > 0 && random() < this.mirrorProbability ? -1 : 1;
    this.startTimes[index] = bloomStartTime + waveDelay;
    this.durations[index] = duration;
    this.swayPhases[index] = randomRange(random, 0, Math.PI * 2);
    this.swaySpeeds[index] = randomRange(
      random,
      CONFIG.SWAY_SPEED_MIN,
      CONFIG.SWAY_SPEED_MAX,
    );
    this.swayAmounts[index] = randomRange(
      random,
      CONFIG.SWAY_AMOUNT_MIN,
      CONFIG.SWAY_AMOUNT_MAX,
    );

    this.settledFlowers[index] = 0;
    this.aliveFlowers[index] = 1;
    this.activeFlowerIndices[this.activeFlowerCount] = index;
    this.activeFlowerCount += 1;

    this.count += 1;
    this.flowerRenderer.setCount(this.nextUnusedIndex);
    if (this.count >= this.maxFlowers && !this.capacityReachedLogged) {
      console.info(`Flower capacity reached: ${this.maxFlowers}`);
      this.capacityReachedLogged = true;
    }
    return index;
  }

  writeFlowerMatrix(
    index,
    timeSeconds,
    growth,
    windStrength,
    { yOffset = 0, vitality = 1 } = {},
  ) {
    const emergence = clamp01(growth);
    const sway =
      Math.sin(timeSeconds * this.swaySpeeds[index] + this.swayPhases[index]) *
      this.swayAmounts[index] *
      windStrength;
    const scale = this.scales[index] * growth;
    const y = 0.012 - this.startYOffset * (1 - emergence) + yOffset;

    this.dummy.position.set(this.positionsX[index], y, this.positionsZ[index]);
    this.dummy.rotation.set(
      this.tiltsX[index] + sway * 0.34,
      this.rotationsY[index],
      this.tiltsZ[index] + sway,
    );
    this.dummy.scale.set(scale * this.mirrorsX[index], scale, scale);
    this.dummy.updateMatrix();
    this.flowerRenderer.setMatrixAt(index, this.dummy.matrix);
    this.flowerRenderer.setVitalityAt?.(index, vitality);
    this.matricesDirty = true;
  }

  update(timeSeconds) {
    if (this.count === 0) {
      return;
    }

    this.matricesDirty = false;

    let activeSlot = 0;
    while (activeSlot < this.activeFlowerCount) {
      const index = this.activeFlowerIndices[activeSlot];
      if (this.aliveFlowers[index] === 0) {
        this.activeFlowerCount -= 1;
        this.activeFlowerIndices[activeSlot] =
          this.activeFlowerIndices[this.activeFlowerCount];
        continue;
      }
      const growthTime = (timeSeconds - this.startTimes[index]) / this.durations[index];
      const growth =
        growthTime <= 0
          ? CONFIG.BLOOM_START_SCALE
          : growthTime >= 1
            ? 1
            : Math.max(
                CONFIG.BLOOM_START_SCALE,
                easeOutBloom(growthTime, CONFIG.BLOOM_OVERSHOOT),
              );

      this.writeFlowerMatrix(index, timeSeconds, growth, clamp01(growthTime));

      if (growthTime >= 1) {
        this.settledFlowers[index] = 1;
        this.activeFlowerCount -= 1;
        this.activeFlowerIndices[activeSlot] =
          this.activeFlowerIndices[this.activeFlowerCount];
      } else {
        activeSlot += 1;
      }
    }

    const settledUpdateBudget = Math.min(
      CONFIG.SETTLED_SWAY_UPDATES_PER_FRAME,
      this.count,
    );
    let checkedFlowers = 0;
    let updatedSettledFlowers = 0;

    while (
      checkedFlowers < this.nextUnusedIndex &&
      updatedSettledFlowers < settledUpdateBudget
    ) {
      const index = this.settledUpdateCursor;
      this.settledUpdateCursor =
        (this.settledUpdateCursor + 1) % Math.max(1, this.nextUnusedIndex);
      checkedFlowers += 1;

      if (
        this.aliveFlowers[index] === 0 ||
        this.settledFlowers[index] === 0
      ) {
        continue;
      }

      this.writeFlowerMatrix(index, timeSeconds, 1, 1);
      updatedSettledFlowers += 1;
    }

    if (this.matricesDirty) {
      this.flowerRenderer.commit();
    }
  }

  beginBloomDecay(bloomEvent) {
    for (const index of bloomEvent.flowerIndices) {
      if (this.aliveFlowers[index] !== 0) {
        this.settledFlowers[index] = 0;
      }
    }
  }

  updateBloomDecay(bloomEvent, progress, timeSeconds) {
    const decay = clamp01(progress);
    const easedDecay = decay * decay * (3 - 2 * decay);
    const scale = 1 - easedDecay * 0.24;
    const windStrength = 1 - easedDecay * 0.82;
    const vitality = 1 - easedDecay * 0.74;
    const yOffset = -easedDecay * 0.095;
    let wroteMatrix = false;

    for (const index of bloomEvent.flowerIndices) {
      if (this.aliveFlowers[index] === 0) {
        continue;
      }
      this.writeFlowerMatrix(index, timeSeconds, scale, windStrength, {
        yOffset,
        vitality,
      });
      wroteMatrix = true;
    }

    if (wroteMatrix) {
      this.flowerRenderer.commit();
    }
  }

  releaseBloom(bloomEvent) {
    const bloomIndex = this.blooms.indexOf(bloomEvent);
    if (bloomIndex < 0) {
      return false;
    }

    for (const index of bloomEvent.flowerIndices) {
      if (this.aliveFlowers[index] === 0) {
        continue;
      }
      this.flowerRenderer.releaseInstance?.(index);
      this.aliveFlowers[index] = 0;
      this.settledFlowers[index] = 0;
      this.freeFlowerIndices.push(index);
      this.count -= 1;
    }

    this.blooms.splice(bloomIndex, 1);
    this.flowerRenderer.setCount(this.nextUnusedIndex);
    this.flowerRenderer.commit();
    return true;
  }

  reset() {
    this.count = 0;
    this.nextUnusedIndex = 0;
    this.freeFlowerIndices.length = 0;
    this.blooms.length = 0;
    this.activeFlowerCount = 0;
    this.settledUpdateCursor = 0;
    this.capacityReachedLogged = false;
    this.settledFlowers.fill(0);
    this.aliveFlowers.fill(0);
    this.mirrorsX.fill(1);
    this.flowerRenderer.reset();
  }

  isFull() {
    return this.count >= this.maxFlowers;
  }
}

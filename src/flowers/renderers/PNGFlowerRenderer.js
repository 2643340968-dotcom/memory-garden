import * as THREE from "three";
import { BLOOM_PATCH_CONFIG } from "../BloomPatchConfig.js";
import { PNG_FLOWER_CONFIG } from "./PNGFlowerConfig.js";
import {
  createFallbackFlowerParticleSampleSet,
  createFlowerParticleSampleSetFromImage,
} from "./PNGFlowerParticleSampler.js";

const UNASSIGNED_VARIANT = 255;

function smoothstepRange(value, start, end) {
  const progress = THREE.MathUtils.clamp(
    (value - start) / Math.max(1e-6, end - start),
    0,
    1,
  );
  return progress * progress * (3 - 2 * progress);
}

function createBottomAnchoredGeometry(aspect, cardMode) {
  const height = PNG_FLOWER_CONFIG.FLOWER_CARD_HEIGHT;
  const width = height * aspect;
  const front = new THREE.PlaneGeometry(width, height);
  front.translate(0, height * 0.5, 0);
  front.computeBoundingBox();
  front.computeBoundingSphere();

  if (cardMode === "single") {
    return [front];
  }

  if (cardMode !== "cross") {
    front.dispose();
    throw new Error(`Unsupported PNG flower card mode: ${cardMode}`);
  }

  const side = front.clone();
  side.rotateY(Math.PI * 0.5);
  side.computeBoundingBox();
  side.computeBoundingSphere();
  return [front, side];
}

function createCardMaterial(texture, variantIndex) {
  const material = new THREE.MeshBasicMaterial({
    name: `ZijincaoPNGMaterial-${variantIndex + 1}`,
    map: texture,
    color: PNG_FLOWER_CONFIG.FLOWER_TINT,
    opacity: PNG_FLOWER_CONFIG.FLOWER_OPACITY,
    alphaTest: PNG_FLOWER_CONFIG.FLOWER_ALPHA_TEST,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false,
  });

  // Transparent DoubleSide materials otherwise render back and front in two
  // passes. A vegetation cutout only needs one, keeping the default at five
  // flower draw calls for five variants.
  material.forceSinglePass = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float instanceOpacity;
        varying float vInstanceOpacity;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vInstanceOpacity = instanceOpacity;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying float vInstanceOpacity;`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `#include <alphatest_fragment>
        diffuseColor.a *= vInstanceOpacity;
        if (vInstanceOpacity < 0.002) discard;`,
      );
  };
  material.customProgramCacheKey = () =>
    "memory-garden-png-instance-opacity-v2";
  return material;
}

function configureTexture(texture, renderer, variantIndex) {
  texture.name = `ZijincaoPNGTexture-${variantIndex + 1}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
}

export class PNGFlowerRenderer {
  constructor(textureRecords) {
    if (textureRecords.length !== PNG_FLOWER_CONFIG.PNG_FLOWER_PATHS.length) {
      textureRecords.forEach((record) => record.texture.dispose());
      throw new Error(
        `Expected ${PNG_FLOWER_CONFIG.PNG_FLOWER_PATHS.length} PNG variants, ` +
          `received ${textureRecords.length}.`,
      );
    }

    this.type = "png";
    this.assetMode = `PNG · ${textureRecords.length} VARIANTS`;
    this.normalizationScale = 1;
    this.maxFlowers = PNG_FLOWER_CONFIG.MAX_FLOWERS;
    this.globalCount = 0;
    this.fieldConfig = Object.freeze({
      maxFlowers: PNG_FLOWER_CONFIG.MAX_FLOWERS,
      flowersPerBloomMin: PNG_FLOWER_CONFIG.FLOWERS_PER_BLOOM_MIN,
      flowersPerBloomMax: PNG_FLOWER_CONFIG.FLOWERS_PER_BLOOM_MAX,
    });
    this.transformConfig = Object.freeze({
      orientationMode: "camera-facing",
      scaleMin: PNG_FLOWER_CONFIG.FLOWER_SCALE_MIN,
      scaleMax: PNG_FLOWER_CONFIG.FLOWER_SCALE_MAX,
      yawMax: PNG_FLOWER_CONFIG.FLOWER_YAW_MAX,
      tiltMax: PNG_FLOWER_CONFIG.FLOWER_TILT_MAX,
      mirrorProbability: PNG_FLOWER_CONFIG.FLOWER_MIRROR_PROBABILITY,
      startYOffset: 0,
    });

    this.variantAssignments = new Uint8Array(this.maxFlowers);
    this.variantAssignments.fill(UNASSIGNED_VARIANT);
    this.localIndices = new Uint32Array(this.maxFlowers);
    this.batchCounts = new Uint32Array(textureRecords.length);
    this.freeLocalIndices = Array.from(
      { length: textureRecords.length },
      () => [],
    );
    this.hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    this.vitalityColor = new THREE.Color(1, 1, 1);
    this.textures = textureRecords.map((record) => record.texture);
    this.materials = [];
    this.geometries = [];
    this.variantBatches = [];
    this.particleSampleSets = [];

    textureRecords.forEach((record, variantIndex) => {
      const aspect = record.textureWidth / record.textureHeight;
      if (!Number.isFinite(aspect) || aspect <= 0) {
        this.dispose();
        throw new Error(
          `PNG flower variant ${variantIndex + 1} has invalid image dimensions.`,
        );
      }

      const material = createCardMaterial(record.texture, variantIndex);
      const particleSampleSet =
        record.particleSampleSet ??
        createFallbackFlowerParticleSampleSet(
          aspect,
          variantIndex,
          PNG_FLOWER_CONFIG.FLOWER_CARD_HEIGHT,
        );
      const geometries = createBottomAnchoredGeometry(
        aspect,
        PNG_FLOWER_CONFIG.FLOWER_CARD_MODE,
      );
      const meshes = geometries.map((geometry, cardIndex) => {
        const instanceOpacity = new THREE.InstancedBufferAttribute(
          new Float32Array(this.maxFlowers).fill(1),
          1,
        );
        instanceOpacity.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("instanceOpacity", instanceOpacity);
        const mesh = new THREE.InstancedMesh(
          geometry,
          material,
          this.maxFlowers,
        );
        mesh.name =
          `InstancedZijincaoPNG-${variantIndex + 1}-Card-${cardIndex + 1}`;
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.userData.instanceCapacity = this.maxFlowers;
        mesh.userData.variantIndex = variantIndex;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(
          new Float32Array(this.maxFlowers * 3).fill(1),
          3,
        );
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        return mesh;
      });

      this.materials.push(material);
      this.geometries.push(...geometries);
      this.particleSampleSets.push(particleSampleSet);
      this.variantBatches.push({
        aspect,
        path: record.path,
        textureSize: Object.freeze([
          record.textureWidth,
          record.textureHeight,
        ]),
        meshes,
      });
    });

    this.meshes = this.variantBatches.flatMap((batch) => batch.meshes);
    this.summary = Object.freeze({
      variantCount: textureRecords.length,
      texturePaths: Object.freeze(textureRecords.map((record) => record.path)),
      textureSizes: Object.freeze(
        textureRecords.map((record) =>
          Object.freeze([record.textureWidth, record.textureHeight]),
        ),
      ),
      batchCount: this.meshes.length,
      drawCalls: this.meshes.length,
      cardMode: PNG_FLOWER_CONFIG.FLOWER_CARD_MODE,
      cardHeight: PNG_FLOWER_CONFIG.FLOWER_CARD_HEIGHT,
    });

    console.info(
      [
        "PNG flower variants loaded",
        `Variants: ${this.summary.variantCount}`,
        `Card mode: ${this.summary.cardMode}`,
        `Instance batches: ${this.summary.batchCount}`,
        `Flower draw calls: ${this.summary.drawCalls}`,
        `Global capacity: ${this.maxFlowers}`,
      ].join("\n"),
    );
  }

  addToScene(scene) {
    scene.add(...this.meshes);
  }

  allocateInstance(globalIndex, random) {
    if (this.variantAssignments[globalIndex] !== UNASSIGNED_VARIANT) {
      throw new Error(`PNG flower instance ${globalIndex} was allocated twice.`);
    }

    const variantIndex = Math.min(
      this.variantBatches.length - 1,
      Math.floor(random() * this.variantBatches.length),
    );
    const freeLocalIndices = this.freeLocalIndices[variantIndex];
    const localIndex =
      freeLocalIndices.length > 0
        ? freeLocalIndices.pop()
        : this.batchCounts[variantIndex]++;
    this.variantAssignments[globalIndex] = variantIndex;
    this.localIndices[globalIndex] = localIndex;
    this.variantBatches[variantIndex].meshes.forEach((mesh) => {
      mesh.count = this.batchCounts[variantIndex];
      mesh.setColorAt(localIndex, this.vitalityColor.setRGB(1, 1, 1));
      mesh.geometry.getAttribute("instanceOpacity").setX(localIndex, 0);
    });
  }

  setCount(count) {
    this.globalCount = count;
  }

  setMatrixAt(globalIndex, matrix) {
    const variantIndex = this.variantAssignments[globalIndex];
    if (variantIndex === UNASSIGNED_VARIANT) {
      throw new Error(`PNG flower instance ${globalIndex} has no variant.`);
    }

    const localIndex = this.localIndices[globalIndex];
    this.variantBatches[variantIndex].meshes.forEach((mesh) => {
      mesh.setMatrixAt(localIndex, matrix);
    });
  }

  getMatrixAt(globalIndex, target) {
    const variantIndex = this.variantAssignments[globalIndex];
    if (variantIndex === UNASSIGNED_VARIANT) {
      return false;
    }
    const localIndex = this.localIndices[globalIndex];
    this.variantBatches[variantIndex].meshes[0].getMatrixAt(localIndex, target);
    return true;
  }

  getVariantIndex(globalIndex) {
    const variantIndex = this.variantAssignments[globalIndex];
    return variantIndex === UNASSIGNED_VARIANT ? -1 : variantIndex;
  }

  getParticleSampleSet(variantIndex) {
    return this.particleSampleSets[variantIndex] ?? null;
  }

  setVitalityAt(
    globalIndex,
    vitality,
    emergence = 1,
    timeSeconds = null,
    startTime = null,
  ) {
    const variantIndex = this.variantAssignments[globalIndex];
    if (variantIndex === UNASSIGNED_VARIANT) {
      return;
    }

    const localIndex = this.localIndices[globalIndex];
    const value = THREE.MathUtils.clamp(vitality, 0, 1);
    const hasFormationTime =
      Number.isFinite(timeSeconds) && Number.isFinite(startTime);
    const reveal = hasFormationTime
      ? smoothstepRange(
          Math.max(0, timeSeconds - startTime),
          BLOOM_PATCH_CONFIG.FLOWER_CARD_REVEAL_DELAY,
          BLOOM_PATCH_CONFIG.FLOWER_CARD_REVEAL_DELAY +
            BLOOM_PATCH_CONFIG.FLOWER_CARD_REVEAL_DURATION,
        )
      : smoothstepRange(emergence, 0.18, 0.78);
    const decayVisibility = Math.max(
      BLOOM_PATCH_CONFIG.FLOWER_CARD_DECAY_MIN_VISIBILITY,
      smoothstepRange(
        value,
        BLOOM_PATCH_CONFIG.FLOWER_CARD_DECAY_VITALITY_FLOOR,
        1,
      ),
    );
    const visibility =
      reveal *
      decayVisibility *
      BLOOM_PATCH_CONFIG.FLOWER_CARD_MAX_VISIBILITY;
    const brightness = 0.72 + value * 0.28;
    this.vitalityColor.setRGB(
      brightness,
      brightness * 0.96,
      brightness,
    );
    this.variantBatches[variantIndex].meshes.forEach((mesh) => {
      mesh.setColorAt(localIndex, this.vitalityColor);
      mesh.geometry
        .getAttribute("instanceOpacity")
        .setX(localIndex, visibility);
    });
  }

  releaseInstance(globalIndex) {
    const variantIndex = this.variantAssignments[globalIndex];
    if (variantIndex === UNASSIGNED_VARIANT) {
      return false;
    }

    const localIndex = this.localIndices[globalIndex];
    this.variantBatches[variantIndex].meshes.forEach((mesh) => {
      mesh.setMatrixAt(localIndex, this.hiddenMatrix);
      mesh.setColorAt(localIndex, this.vitalityColor.setRGB(0, 0, 0));
      mesh.geometry.getAttribute("instanceOpacity").setX(localIndex, 0);
    });
    this.freeLocalIndices[variantIndex].push(localIndex);
    this.variantAssignments[globalIndex] = UNASSIGNED_VARIANT;
    this.localIndices[globalIndex] = 0;
    return true;
  }

  commit() {
    this.meshes.forEach((mesh) => {
      if (mesh.count > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.geometry.getAttribute("instanceOpacity").needsUpdate = true;
      }
    });
  }

  reset() {
    this.globalCount = 0;
    this.batchCounts.fill(0);
    this.variantAssignments.fill(UNASSIGNED_VARIANT);
    this.localIndices.fill(0);
    this.freeLocalIndices.forEach((indices) => {
      indices.length = 0;
    });
    this.meshes.forEach((mesh) => {
      mesh.count = 0;
      mesh.instanceColor.array.fill(1);
      mesh.geometry.getAttribute("instanceOpacity").array.fill(0);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.geometry.getAttribute("instanceOpacity").needsUpdate = true;
    });
  }

  dispose() {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
  }
}

export async function createPNGFlowerRenderer(renderer) {
  const loadingManager = new THREE.LoadingManager();
  loadingManager.onError = (url) => {
    console.warn(`PNG flower variant could not be loaded: ${url}`);
  };

  const loader = new THREE.TextureLoader(loadingManager);
  const settledTextures = await Promise.allSettled(
    PNG_FLOWER_CONFIG.PNG_FLOWER_PATHS.map(async (path, variantIndex) => {
      const texture = await loader.loadAsync(path);
      configureTexture(texture, renderer, variantIndex);
      const image = texture.image ?? texture.source?.data;
      return {
        path,
        texture,
        textureWidth: image?.naturalWidth ?? image?.width ?? 0,
        textureHeight: image?.naturalHeight ?? image?.height ?? 0,
        particleSampleSet: (() => {
          const width = image?.naturalWidth ?? image?.width ?? 0;
          const height = image?.naturalHeight ?? image?.height ?? 0;
          const aspect = width / height;
          try {
            return createFlowerParticleSampleSetFromImage(
              image,
              aspect,
              variantIndex,
              PNG_FLOWER_CONFIG.FLOWER_CARD_HEIGHT,
            );
          } catch {
            return createFallbackFlowerParticleSampleSet(
              aspect,
              variantIndex,
              PNG_FLOWER_CONFIG.FLOWER_CARD_HEIGHT,
            );
          }
        })(),
      };
    }),
  );
  const failures = settledTextures.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    settledTextures.forEach((result) => {
      if (result.status === "fulfilled") {
        result.value.texture.dispose();
      }
    });
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `Failed to load ${failures.length} PNG flower variant(s).`,
    );
  }

  return new PNGFlowerRenderer(
    settledTextures.map((result) => result.value),
  );
}

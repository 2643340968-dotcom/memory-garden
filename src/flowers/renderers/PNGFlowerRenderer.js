import * as THREE from "three";
import { PNG_FLOWER_CONFIG } from "./PNGFlowerConfig.js";

const UNASSIGNED_VARIANT = 255;

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
    this.textures = textureRecords.map((record) => record.texture);
    this.materials = [];
    this.geometries = [];
    this.variantBatches = [];

    textureRecords.forEach((record, variantIndex) => {
      const aspect = record.textureWidth / record.textureHeight;
      if (!Number.isFinite(aspect) || aspect <= 0) {
        this.dispose();
        throw new Error(
          `PNG flower variant ${variantIndex + 1} has invalid image dimensions.`,
        );
      }

      const material = createCardMaterial(record.texture, variantIndex);
      const geometries = createBottomAnchoredGeometry(
        aspect,
        PNG_FLOWER_CONFIG.FLOWER_CARD_MODE,
      );
      const meshes = geometries.map((geometry, cardIndex) => {
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
        return mesh;
      });

      this.materials.push(material);
      this.geometries.push(...geometries);
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
    const localIndex = this.batchCounts[variantIndex];
    this.variantAssignments[globalIndex] = variantIndex;
    this.localIndices[globalIndex] = localIndex;
    this.batchCounts[variantIndex] += 1;
    this.variantBatches[variantIndex].meshes.forEach((mesh) => {
      mesh.count = this.batchCounts[variantIndex];
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

  commit() {
    this.meshes.forEach((mesh) => {
      if (mesh.count > 0) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    });
  }

  reset() {
    this.globalCount = 0;
    this.batchCounts.fill(0);
    this.variantAssignments.fill(UNASSIGNED_VARIANT);
    this.meshes.forEach((mesh) => {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
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

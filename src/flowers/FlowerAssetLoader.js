import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CONFIG } from "../config.js";

function countTriangles(geometry) {
  const elementCount = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
  return Math.floor(elementCount / 3);
}

function collectMaterialResources(material, materials, textures) {
  const sourceMaterials = Array.isArray(material) ? material : [material];

  for (const sourceMaterial of sourceMaterials) {
    if (!sourceMaterial?.isMaterial) {
      continue;
    }

    materials.add(sourceMaterial);
    for (const value of Object.values(sourceMaterial)) {
      if (value?.isTexture) {
        textures.add(value);
      }
    }
  }
}

function preserveOrFallbackMaterial(material, fallbackMaterial) {
  if (Array.isArray(material)) {
    return material.map((entry) =>
      entry?.isMaterial ? entry : fallbackMaterial,
    );
  }

  return material?.isMaterial ? material : fallbackMaterial;
}

function prepareFlowerAsset(gltf, renderer) {
  gltf.scene.updateMatrixWorld(true);

  const sourceParts = [];
  const sourceBounds = new THREE.Box3();
  const materials = new Set();
  const textures = new Set();
  const fallbackMaterial = new THREE.MeshStandardMaterial({
    name: "ZijincaoFallbackMaterial",
    color: 0x8e6fc1,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  let fallbackMaterialUsed = false;
  let sourceMeshCount = 0;
  let triangleCount = 0;

  gltf.scene.traverse((object) => {
    if (!object.isMesh) {
      return;
    }

    if (object.isSkinnedMesh) {
      throw new Error(
        `Zijincao mesh "${object.name}" is skinned and cannot use the static instance pipeline.`,
      );
    }

    sourceMeshCount += 1;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }
    geometry.computeBoundingBox();
    sourceBounds.union(geometry.boundingBox);
    triangleCount += countTriangles(geometry);

    const material = preserveOrFallbackMaterial(object.material, fallbackMaterial);
    const materialEntries = Array.isArray(material) ? material : [material];
    if (materialEntries.includes(fallbackMaterial)) {
      fallbackMaterialUsed = true;
    }
    collectMaterialResources(material, materials, textures);

    sourceParts.push({
      geometry,
      material,
      sourceName: object.name || `ZijincaoPart-${sourceMeshCount}`,
    });
  });

  if (sourceParts.length === 0 || sourceBounds.isEmpty()) {
    fallbackMaterial.dispose();
    throw new Error("Zijincao GLB does not contain a reusable Mesh geometry.");
  }

  if (!fallbackMaterialUsed) {
    fallbackMaterial.dispose();
  }

  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(sourceSize.y) || sourceSize.y <= Number.EPSILON) {
    throw new Error("Zijincao GLB has an invalid zero-height bounding box.");
  }

  const groundCorrection = -sourceBounds.min.y;
  const groundCorrectionMatrix = new THREE.Matrix4().makeTranslation(
    0,
    groundCorrection,
    0,
  );
  const normalizationScale = CONFIG.FLOWER_BASE_HEIGHT / sourceSize.y;
  const maximumAnisotropy = Math.min(
    4,
    renderer.capabilities.getMaxAnisotropy(),
  );

  textures.forEach((texture) => {
    texture.anisotropy = maximumAnisotropy;
  });
  let largestTextureWidth = 0;
  let largestTextureHeight = 0;
  textures.forEach((texture) => {
    const image = texture.image ?? texture.source?.data;
    const width = image?.naturalWidth ?? image?.videoWidth ?? image?.width ?? 0;
    const height = image?.naturalHeight ?? image?.videoHeight ?? image?.height ?? 0;
    if (width * height > largestTextureWidth * largestTextureHeight) {
      largestTextureWidth = width;
      largestTextureHeight = height;
    }
  });

  const meshes = sourceParts.map((part, index) => {
    part.geometry.applyMatrix4(groundCorrectionMatrix);
    part.geometry.computeBoundingBox();
    part.geometry.computeBoundingSphere();

    const mesh = new THREE.InstancedMesh(
      part.geometry,
      part.material,
      CONFIG.MAX_FLOWERS,
    );
    mesh.name = `InstancedZijincao-${index + 1}-${part.sourceName}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.userData.instanceCapacity = CONFIG.MAX_FLOWERS;
    mesh.userData.sourceName = part.sourceName;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  });

  const drawCalls = sourceParts.reduce((total, part) => {
    if (!Array.isArray(part.material)) {
      return total + 1;
    }
    return total + Math.max(1, part.geometry.groups.length);
  }, 0);
  const summary = Object.freeze({
    meshCount: sourceMeshCount,
    geometryCount: sourceParts.length,
    materialCount: materials.size,
    textureCount: textures.size,
    triangleCount,
    sourceBounds: Object.freeze({
      min: Object.freeze(sourceBounds.min.toArray()),
      max: Object.freeze(sourceBounds.max.toArray()),
      size: Object.freeze(sourceSize.toArray()),
    }),
    sourceHeight: sourceSize.y,
    groundCorrection,
    normalizationScale,
    batchCount: meshes.length,
    drawCalls,
    animationCount: gltf.animations.length,
    largestTextureSize: Object.freeze([
      largestTextureWidth,
      largestTextureHeight,
    ]),
  });

  console.info(
    [
      "Zijincao asset loaded",
      `Meshes: ${summary.meshCount}`,
      `Materials: ${summary.materialCount}`,
      `Textures: ${summary.textureCount}`,
      `Height: ${summary.sourceHeight.toFixed(5)}`,
      `Triangles: ${summary.triangleCount}`,
      `Normalization scale: ${summary.normalizationScale.toFixed(5)}`,
      `Ground correction: ${summary.groundCorrection.toFixed(5)}`,
      `Instance batches: ${summary.batchCount}`,
      `Flower draw calls: ${summary.drawCalls}`,
      `Largest texture: ${largestTextureWidth}x${largestTextureHeight}`,
    ].join("\n"),
  );

  if (largestTextureWidth > 4096 || largestTextureHeight > 4096) {
    console.warn(
      `Zijincao uses a ${largestTextureWidth}x${largestTextureHeight} texture. ` +
        "It is shared by all instances, but should be reduced in Blender for the final build.",
    );
  }

  return {
    meshes,
    summary,
    normalizationScale,
    assetMode: `GLB · ${meshes.length} BATCH`,
    dispose() {
      sourceParts.forEach((part) => part.geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}

export async function loadFlowerVisual(renderer) {
  const loadingManager = new THREE.LoadingManager();
  loadingManager.onError = (url) => {
    console.warn(
      `Zijincao asset dependency could not be loaded: ${url}. ` +
        "The loader will preserve any usable model material or report a startup error.",
    );
  };

  const loader = new GLTFLoader(loadingManager);
  const gltf = await loader.loadAsync(CONFIG.FLOWER_MODEL_PATH);
  return prepareFlowerAsset(gltf, renderer);
}

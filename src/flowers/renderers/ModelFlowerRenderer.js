import { CONFIG } from "../../config.js";
import { loadFlowerVisual } from "../FlowerAssetLoader.js";

function getInstanceCapacity(mesh) {
  return mesh.userData?.instanceCapacity ?? mesh.instanceMatrix?.count ?? 0;
}

export class ModelFlowerRenderer {
  constructor(visual) {
    if (!visual?.meshes?.length) {
      throw new Error("ModelFlowerRenderer requires at least one GLB mesh batch.");
    }

    this.type = "model";
    this.visual = visual;
    this.meshes = visual.meshes;
    this.summary = visual.summary;
    this.assetMode = visual.assetMode;
    this.normalizationScale = visual.normalizationScale;
    this.maxFlowers = Math.min(...this.meshes.map(getInstanceCapacity));
  }

  addToScene(scene) {
    scene.add(...this.meshes);
  }

  setCount(count) {
    this.meshes.forEach((mesh) => {
      mesh.count = count;
    });
  }

  setMatrixAt(index, matrix) {
    this.meshes.forEach((mesh) => mesh.setMatrixAt(index, matrix));
  }

  commit() {
    this.meshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  reset() {
    this.setCount(0);
    this.commit();
  }

  dispose() {
    this.visual.dispose();
  }
}

export async function createModelFlowerRenderer(renderer) {
  const visual = await loadFlowerVisual(renderer);
  const modelRenderer = new ModelFlowerRenderer(visual);

  if (modelRenderer.maxFlowers < CONFIG.MAX_FLOWERS) {
    modelRenderer.dispose();
    throw new Error(
      `GLB flower batches provide ${modelRenderer.maxFlowers} slots; ` +
        `${CONFIG.MAX_FLOWERS} are required.`,
    );
  }

  return modelRenderer;
}

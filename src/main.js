import * as THREE from "three";
import "./styles.css";
import { CONFIG } from "./config.js";
import { createScene } from "./scene/createScene.js";
import { createCamera } from "./scene/createCamera.js";
import { createRenderer } from "./scene/createRenderer.js";
import { createLights } from "./scene/createLights.js";
import { createGround } from "./scene/createGround.js";
import { createGrass } from "./scene/createGrass.js";
import { createHitMarker } from "./scene/createHitMarker.js";
import { PointerController } from "./input/PointerController.js";
import { MouseInput } from "./input/MouseInput.js";
import { GroundRaycaster } from "./interaction/GroundRaycaster.js";
import { loadFlowerVisual } from "./flowers/FlowerAssetLoader.js";
import { FlowerSystem } from "./flowers/FlowerSystem.js";
import { FlowerSpawner } from "./flowers/FlowerSpawner.js";

async function bootstrap() {
  const canvas = document.querySelector("#scene");
  const resetButton = document.querySelector("#reset-button");
  const flowerCount = document.querySelector("#flower-count");
  const inputState = document.querySelector("#input-state");
  const assetMode = document.querySelector("#asset-mode");

  const scene = createScene();
  const camera = createCamera();
  const renderer = createRenderer(canvas);
  createLights(scene);
  const ground = createGround(scene, renderer);
  createGrass(scene);
  const hitMarker = createHitMarker(scene);

  const pointerController = new PointerController();
  new MouseInput(canvas, pointerController);
  const groundRaycaster = new GroundRaycaster(camera, CONFIG.GROUND_SIZE);
  let flowerAssetReady = false;
  inputState.textContent = "FLOWER ASSET · LOADING";
  assetMode.textContent = "LOADING";
  const flowerVisual = await loadFlowerVisual(renderer);
  flowerAssetReady = true;
  const flowerSystem = new FlowerSystem(
    scene,
    camera,
    flowerVisual,
    groundRaycaster,
    canvas,
  );
  const flowerSpawner = new FlowerSpawner(flowerSystem);
  const hitPoint = new THREE.Vector3();

  assetMode.textContent = flowerVisual.assetMode;
  inputState.textContent = "MOUSE INPUT · READY";

  let lastDisplayedCount = -1;
  let lastPlantingState = false;
  let performanceSampleStart = performance.now();
  let performanceSampleFrames = 0;
  const flowerCountDigits = String(CONFIG.MAX_FLOWERS).length;

  function formatFlowerCount(count) {
    return `${String(count).padStart(flowerCountDigits, "0")} / ${CONFIG.MAX_FLOWERS}`;
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.MAX_PIXEL_RATIO));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function resetField() {
    flowerSystem.reset();
    flowerSpawner.reset();
    flowerCount.textContent = formatFlowerCount(0);
    inputState.textContent = "MOUSE INPUT · READY";
    document.body.classList.remove("is-planting");
    lastDisplayedCount = 0;
    lastPlantingState = false;
  }

  function render(timeMilliseconds) {
    const timeSeconds = timeMilliseconds * 0.001;
    const pointer = pointerController.getState();
    const hasGroundHit =
      pointer.hasPosition &&
      groundRaycaster.getGroundPoint(pointer.x, pointer.y, hitPoint);
    const isPlanting =
      flowerAssetReady &&
      hasGroundHit &&
      pointer.active &&
      !flowerSystem.isFull();

    hitMarker.visible = hasGroundHit;
    if (hasGroundHit) {
      hitMarker.position.set(hitPoint.x, 0.018, hitPoint.z);
      hitMarker.setPlanting(isPlanting);
    }

    flowerSpawner.update(hasGroundHit ? hitPoint : null, isPlanting, timeSeconds);
    flowerSystem.update(timeSeconds);

    if (flowerSystem.count !== lastDisplayedCount) {
      flowerCount.textContent = formatFlowerCount(flowerSystem.count);
      lastDisplayedCount = flowerSystem.count;
    }

    if (isPlanting !== lastPlantingState) {
      document.body.classList.toggle("is-planting", isPlanting);
      inputState.textContent = isPlanting
        ? "MOUSE INPUT · PLANTING"
        : flowerSystem.isFull()
          ? "FLOWER LIMIT · REACHED"
          : "MOUSE INPUT · READY";
      lastPlantingState = isPlanting;
    }

    renderer.render(scene, camera);

    performanceSampleFrames += 1;
    const performanceSampleDuration = timeMilliseconds - performanceSampleStart;
    if (performanceSampleDuration >= 1000) {
      canvas.dataset.fps = (
        (performanceSampleFrames * 1000) /
        performanceSampleDuration
      ).toFixed(1);
      canvas.dataset.renderCalls = String(renderer.info.render.calls);
      canvas.dataset.renderTriangles = String(renderer.info.render.triangles);
      canvas.dataset.memoryGeometries = String(renderer.info.memory.geometries);
      canvas.dataset.memoryTextures = String(renderer.info.memory.textures);
      performanceSampleStart = timeMilliseconds;
      performanceSampleFrames = 0;
    }
  }

  window.addEventListener("resize", resize);
  resetButton.addEventListener("click", resetField);
  renderer.setAnimationLoop(render);

  // Keep references reachable for debugging without coupling modules together.
  window.__flowerField = {
    scene,
    camera,
    renderer,
    ground,
    flowerVisual,
    flowerSystem,
    flowerSpawner,
  };
}

bootstrap().catch((error) => {
  console.error("The flower field failed to start.", error);
  document.querySelector("#fatal-error").hidden = false;
});

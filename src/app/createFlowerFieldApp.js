import * as THREE from "three";
import { CONFIG } from "../config.js";
import { createScene } from "../scene/createScene.js";
import { createCamera } from "../scene/createCamera.js";
import { createRenderer } from "../scene/createRenderer.js";
import { createLights } from "../scene/createLights.js";
import { createGround } from "../scene/createGround.js";
import { createGrass } from "../scene/createGrass.js";
import { createHitMarker } from "../scene/createHitMarker.js";
import { PointerController } from "../input/PointerController.js";
import { MouseInput } from "../input/MouseInput.js";
import { GroundRaycaster } from "../interaction/GroundRaycaster.js";
import { FlowerSystem } from "../flowers/FlowerSystem.js";
import { FlowerSpawner } from "../flowers/FlowerSpawner.js";

export async function createFlowerFieldApp({
  createFlowerRenderer,
  version,
  sceneConfig,
  interactionEnabled = true,
  counterMode = "flowers",
  createPatchSystem = null,
  createRenderPipeline = null,
  createAtmosphereSystem = null,
}) {
  if (typeof createFlowerRenderer !== "function") {
    throw new TypeError("createFlowerFieldApp requires a flower renderer factory.");
  }

  const canvas = document.querySelector("#scene");
  const resetButton = document.querySelector("#reset-button");
  const flowerCount = document.querySelector("#flower-count");
  const inputState = document.querySelector("#input-state");
  const assetMode = document.querySelector("#asset-mode");

  const resolvedSceneConfig = {
    ...CONFIG,
    ...sceneConfig,
    FOG: {
      ...CONFIG.FOG,
      ...sceneConfig?.FOG,
    },
  };

  const scene = createScene(resolvedSceneConfig);
  const camera = createCamera();
  const renderer = createRenderer(canvas, resolvedSceneConfig);
  const lights = createLights(scene, resolvedSceneConfig);
  const ground = createGround(scene, renderer, resolvedSceneConfig);
  createGrass(scene, resolvedSceneConfig);
  const hitMarker = createHitMarker(scene);

  const pointerController = new PointerController();
  const mouseInput = new MouseInput(canvas, pointerController);
  const groundRaycaster = new GroundRaycaster(camera, CONFIG.GROUND_SIZE);
  const hitPoint = new THREE.Vector3();

  inputState.textContent = "FLOWER ASSET · LOADING";
  assetMode.textContent = "LOADING";

  const flowerRenderer = await createFlowerRenderer(renderer);
  const flowerSystem = new FlowerSystem(
    scene,
    camera,
    flowerRenderer,
    groundRaycaster,
    canvas,
  );
  const flowerSpawner = new FlowerSpawner(flowerSystem);
  const bloomPatchSystem =
    typeof createPatchSystem === "function"
      ? createPatchSystem({ scene, renderer, flowerSystem })
      : null;
  const renderPipeline =
    typeof createRenderPipeline === "function"
      ? createRenderPipeline({ renderer, scene, camera })
      : null;
  const atmosphereSystem =
    typeof createAtmosphereSystem === "function"
      ? createAtmosphereSystem({
          scene,
          camera,
          renderer,
          flowerRenderer,
        })
      : null;
  const maxFlowers = flowerSystem.maxFlowers;

  assetMode.textContent = flowerRenderer.assetMode;
  let inputEnabled = Boolean(interactionEnabled);
  inputState.textContent = inputEnabled
    ? "MOUSE INPUT · READY"
    : "MOUSE INPUT · WAITING";

  let lastDisplayedCount = -1;
  let lastPlantingState = false;
  let performanceSampleStart = performance.now();
  let performanceSampleFrames = 0;
  let previousFrameTimeSeconds = null;
  let resetCount = 0;
  const flowerCountDigits = String(maxFlowers).length;

  function getDisplayedCount() {
    return counterMode === "blooms"
      ? flowerSystem.blooms.length
      : flowerSystem.count;
  }

  function formatFlowerCount(count) {
    const digits = String(count).padStart(flowerCountDigits, "0");
    return counterMode === "blooms" ? digits : `${digits} / ${maxFlowers}`;
  }

  function setInputEnabled(enabled) {
    inputEnabled = Boolean(enabled);
    if (!inputEnabled) {
      pointerController.setActive(false);
      document.body.classList.remove("is-planting");
      lastPlantingState = false;
    }
    inputState.textContent = inputEnabled
      ? "MOUSE INPUT · READY"
      : "MOUSE INPUT · WAITING";
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.MAX_PIXEL_RATIO));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderPipeline?.resize(
      window.innerWidth,
      window.innerHeight,
      renderer.getPixelRatio(),
    );
    bloomPatchSystem?.setPixelRatio(renderer.getPixelRatio());
    atmosphereSystem?.resize?.(
      window.innerWidth,
      window.innerHeight,
      renderer.getPixelRatio(),
    );
  }

  function resetField() {
    resetCount += 1;
    bloomPatchSystem?.reset();
    flowerSystem.reset();
    flowerSpawner.reset();
    flowerCount.textContent = formatFlowerCount(0);
    inputState.textContent = inputEnabled
      ? "MOUSE INPUT · READY"
      : "MOUSE INPUT · WAITING";
    document.body.classList.remove("is-planting");
    lastDisplayedCount = 0;
    lastPlantingState = false;
  }

  function render(timeMilliseconds) {
    const timeSeconds = timeMilliseconds * 0.001;
    const deltaSeconds =
      previousFrameTimeSeconds === null
        ? 0
        : Math.max(0, timeSeconds - previousFrameTimeSeconds);
    previousFrameTimeSeconds = timeSeconds;
    const pointer = pointerController.getState();
    const hasGroundHit =
      pointer.hasPosition &&
      groundRaycaster.getGroundPoint(pointer.x, pointer.y, hitPoint);
    const isPlanting =
      inputEnabled && hasGroundHit && pointer.active && !flowerSystem.isFull();

    hitMarker.visible = hasGroundHit;
    if (hasGroundHit) {
      hitMarker.position.set(hitPoint.x, 0.018, hitPoint.z);
      hitMarker.setPlanting(isPlanting);
    }

    flowerSpawner.update(hasGroundHit ? hitPoint : null, isPlanting, timeSeconds);
    flowerSystem.update(timeSeconds);
    bloomPatchSystem?.update(
      timeSeconds,
      deltaSeconds,
      hasGroundHit ? hitPoint : null,
    );
    atmosphereSystem?.update?.(timeSeconds, deltaSeconds);

    const displayedCount = getDisplayedCount();
    if (displayedCount !== lastDisplayedCount) {
      flowerCount.textContent = formatFlowerCount(displayedCount);
      lastDisplayedCount = displayedCount;
    }

    if (isPlanting !== lastPlantingState) {
      document.body.classList.toggle("is-planting", isPlanting);
      inputState.textContent = isPlanting
        ? "MOUSE INPUT · PLANTING"
        : flowerSystem.isFull()
          ? "FLOWER LIMIT · REACHED"
          : inputEnabled
            ? "MOUSE INPUT · READY"
            : "MOUSE INPUT · WAITING";
      lastPlantingState = isPlanting;
    }

    if (renderPipeline) {
      renderPipeline.render(timeSeconds);
    } else {
      renderer.render(scene, camera);
    }

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
      canvas.dataset.flowerInstances = String(flowerSystem.count);
      canvas.dataset.bloomEvents = String(flowerSystem.blooms.length);
      canvas.dataset.resetCount = String(resetCount);
      canvas.dataset.activePatches = String(
        bloomPatchSystem?.patches.length ?? 0,
      );
      canvas.dataset.effectParticles = String(
        bloomPatchSystem?.particleSystem.activeParticleCount ?? 0,
      );
      canvas.dataset.particleDrawCount = String(
        bloomPatchSystem?.particleSystem.geometry?.drawRange?.count ?? 0,
      );
      canvas.dataset.degradedParticlePatches = String(
        bloomPatchSystem?.particleSystem.degradedPatchCount ?? 0,
      );
      const particleDiagnostics =
        bloomPatchSystem?.particleSystem.diagnostics ?? null;
      canvas.dataset.particleMotion =
        particleDiagnostics?.mode ?? "not-applicable";
      canvas.dataset.particleCpuUpdates = String(
        particleDiagnostics?.particleCpuUpdatesPerFrame ?? 0,
      );
      canvas.dataset.particleMatrixUpdates = String(
        particleDiagnostics?.flowerMatrixUpdatesPerFrame ?? 0,
      );
      canvas.dataset.particlePatchUpdates = String(
        particleDiagnostics?.patchStateUpdatesPerFrame ?? 0,
      );
      canvas.dataset.particleDynamicBytes = String(
        particleDiagnostics?.dynamicTextureBytes ?? 0,
      );
      canvas.dataset.renderPipeline = renderPipeline?.type ?? "direct";
      canvas.dataset.bloomEnabled = String(
        renderPipeline?.diagnostics?.enabled ?? false,
      );
      canvas.dataset.bloomInternalBytes = String(
        renderPipeline?.diagnostics?.internalBytes ?? 0,
      );
      if (bloomPatchSystem) {
        const patchStates = { growing: 0, alive: 0, decaying: 0 };
        let oldestPatchAge = 0;
        let minimumAttention = 1;
        bloomPatchSystem.patches.forEach((patch) => {
          patchStates[patch.state] = (patchStates[patch.state] ?? 0) + 1;
          oldestPatchAge = Math.max(oldestPatchAge, patch.age);
          minimumAttention = Math.min(minimumAttention, patch.attention);
        });
        canvas.dataset.patchStates = [
          patchStates.growing,
          patchStates.alive,
          patchStates.decaying,
        ].join("/");
        canvas.dataset.oldestPatchAge = oldestPatchAge.toFixed(2);
        canvas.dataset.minimumPatchAttention = minimumAttention.toFixed(3);
        canvas.dataset.decayStartedCount = String(
          bloomPatchSystem.decayStartedCount,
        );
        canvas.dataset.deadPatchCount = String(bloomPatchSystem.deadPatchCount);
      }
      performanceSampleStart = timeMilliseconds;
      performanceSampleFrames = 0;
    }
  }

  window.addEventListener("resize", resize);
  resetButton.addEventListener("click", resetField);
  renderer.setAnimationLoop(render);

  const app = {
    version,
    scene,
    camera,
    renderer,
    lights,
    ground,
    groundRaycaster,
    pointerController,
    mouseInput,
    flowerRenderer,
    // Preserve the old debug name for existing GLB inspection workflows.
    flowerVisual: flowerRenderer,
    flowerSystem,
    flowerSpawner,
    bloomPatchSystem,
    renderPipeline,
    atmosphereSystem,
    resetField,
    setInputEnabled,
    isInputEnabled: () => inputEnabled,
  };
  window.__flowerField = app;
  return app;
}

export function mountFlowerField(options) {
  return createFlowerFieldApp(options).catch((error) => {
    console.error("The flower field failed to start.", error);
    document.querySelector("#fatal-error").hidden = false;
    return null;
  });
}

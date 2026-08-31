import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BLOOM_PATCH_CONFIG } from "../flowers/BloomPatchConfig.js";

const BLOOM_SCALE = 0.5;
const BLOOM_MIP_COUNT = 5;
const RGBA16F_BYTES_PER_TEXEL = 8;

export function estimatePNGBloomWork(
  width,
  height,
  pixelRatio = 1,
  bloomScale = BLOOM_SCALE,
) {
  const physicalWidth = Math.max(1, Math.floor(width * pixelRatio));
  const physicalHeight = Math.max(1, Math.floor(height * pixelRatio));
  const baseWidth = Math.max(1, Math.floor(physicalWidth * bloomScale));
  const baseHeight = Math.max(1, Math.floor(physicalHeight * bloomScale));
  const levels = Array.from({ length: BLOOM_MIP_COUNT }, (_, index) => ({
    width: Math.max(1, Math.floor(baseWidth / 2 ** index)),
    height: Math.max(1, Math.floor(baseHeight / 2 ** index)),
  }));
  const levelAreas = levels.map((level) => level.width * level.height);
  const baseArea = levelAreas[0];
  const internalBytes =
    RGBA16F_BYTES_PER_TEXEL *
    (baseArea + 2 * levelAreas.reduce((sum, area) => sum + area, 0));

  return {
    physicalWidth,
    physicalHeight,
    bloomScale,
    levels,
    deepestMinimumDimension: Math.min(
      levels.at(-1).width,
      levels.at(-1).height,
    ),
    internalBytes,
    fullscreenDraws: 12,
    eligible: Math.min(baseWidth, baseHeight) >= 16,
  };
}

// The PNG page keeps one opaque, full-scene HDR beauty path. A high threshold
// admits only the deliberately hot flower particles, avoiding an extra
// selective attachment and keeping grass, ground, and UI out of the glare.
export function createPNGBloomPipeline({ renderer, scene, camera }) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    BLOOM_PATCH_CONFIG.BLOOM_STRENGTH,
    BLOOM_PATCH_CONFIG.BLOOM_RADIUS,
    BLOOM_PATCH_CONFIG.BLOOM_THRESHOLD,
  );
  bloomPass.name = "MemoryGardenParticleBloom";
  const outputPass = new OutputPass();

  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);
  renderer.info.autoReset = false;
  let requestedBloomEnabled = true;
  let budget = estimatePNGBloomWork(1, 1, 1);

  function applyBloomState() {
    bloomPass.enabled = requestedBloomEnabled && budget.eligible;
  }

  const initialSize = renderer.getSize(new THREE.Vector2());
  budget = estimatePNGBloomWork(
    initialSize.x,
    initialSize.y,
    renderer.getPixelRatio(),
  );
  applyBloomState();

  return {
    type: "png-full-scene-hdr-bloom",
    bloomPass,
    get diagnostics() {
      return {
        signal: "full-scene-linear-hdr",
        output: "opaque-composited",
        enabled: bloomPass.enabled,
        requested: requestedBloomEnabled,
        threshold: bloomPass.threshold,
        strength: bloomPass.strength,
        radius: bloomPass.radius,
        ...budget,
      };
    },
    setBloomEnabled(enabled) {
      requestedBloomEnabled = Boolean(enabled);
      applyBloomState();
    },
    isBloomEnabled() {
      return bloomPass.enabled;
    },
    render() {
      renderer.info.reset();
      composer.render();
    },
    resize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      budget = estimatePNGBloomWork(width, height, pixelRatio);
      applyBloomState();
    },
    dispose() {
      renderer.info.autoReset = true;
      bloomPass.dispose();
      composer.dispose();
    },
  };
}

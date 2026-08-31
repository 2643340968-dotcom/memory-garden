import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BLOOM_PATCH_CONFIG } from "../flowers/BloomPatchConfig.js";

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

  return {
    type: "png-full-scene-hdr-bloom",
    bloomPass,
    render() {
      renderer.info.reset();
      composer.render();
    },
    resize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    dispose() {
      renderer.info.autoReset = true;
      bloomPass.dispose();
      composer.dispose();
    },
  };
}

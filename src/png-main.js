import "./styles.css";
import { mountFlowerField } from "./app/createFlowerFieldApp.js";
import { PNG_SCENE_CONFIG } from "./flowers/renderers/PNGFlowerConfig.js";
import { createPNGFlowerRenderer } from "./flowers/renderers/PNGFlowerRenderer.js";
import { MemoryExperience } from "./memory/MemoryExperience.js";
import { createBloomPatchSystem } from "./flowers/BloomPatchSystem.js";
import { createPNGBloomPipeline } from "./effects/PNGBloomPipeline.js";
import { createAirborneFlowerSystem } from "./effects/AirborneFlowerSystem.js";

mountFlowerField({
  version: "png",
  createFlowerRenderer: createPNGFlowerRenderer,
  sceneConfig: PNG_SCENE_CONFIG,
  interactionEnabled: false,
  counterMode: "blooms",
  createPatchSystem: createBloomPatchSystem,
  createRenderPipeline: createPNGBloomPipeline,
  createAtmosphereSystem: createAirborneFlowerSystem,
}).then((app) => {
  if (!app) {
    return;
  }

  const memoryExperience = new MemoryExperience(app).start();
  app.memoryExperience = memoryExperience;
});

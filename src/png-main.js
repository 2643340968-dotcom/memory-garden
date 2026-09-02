import "./styles.css";
import { mountFlowerField } from "./app/createFlowerFieldApp.js";
import { PNG_SCENE_CONFIG } from "./flowers/renderers/PNGFlowerConfig.js";
import { createPNGFlowerRenderer } from "./flowers/renderers/PNGFlowerRenderer.js";
import { MemoryExperience } from "./memory/MemoryExperience.js";
import { createBloomPatchSystem } from "./flowers/BloomPatchSystem.js";
import { createPNGBloomPipeline } from "./effects/PNGBloomPipeline.js";
import { createAirborneFlowerSystem } from "./effects/AirborneFlowerSystem.js";
import { AudioManager } from "./audio/AudioManager.js";

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

  const audioManager = new AudioManager(app.camera).start();
  app.audioManager = audioManager;
  audioManager.subscribe((diagnostics) => {
    const { dataset } = app.renderer.domElement;
    dataset.audioUnlocked = String(diagnostics.unlocked);
    dataset.audioMuted = String(diagnostics.muted);
    dataset.audioContextState = diagnostics.contextState;
    dataset.bgmConfigured = String(diagnostics.bgmConfigured);
    dataset.bgmPlaying = String(diagnostics.bgmPlaying);
    dataset.bgmLoop = String(diagnostics.bgmLoop);
    dataset.bgmTargetVolume = diagnostics.bgmTargetVolume.toFixed(2);
    dataset.bgmStartCount = String(diagnostics.bgmStartCount);
    dataset.voicePlaying = String(diagnostics.voicePlaying);
    dataset.currentVoiceId = diagnostics.currentVoiceId ?? "";
    dataset.voiceStartCount = String(diagnostics.voiceStartCount);
    dataset.voiceReplacementCount = String(diagnostics.voiceReplacementCount);
    dataset.currentVoiceDuration = String(
      Math.round(diagnostics.currentVoiceDurationMs),
    );
    dataset.lastVoiceEndReason = diagnostics.lastVoiceEndReason ?? "";
    dataset.lastVoiceElapsed = String(Math.round(diagnostics.lastVoiceElapsedMs));
    dataset.audioBufferCount = String(diagnostics.loadedBufferCount);
    dataset.audioLoadErrorCount = String(diagnostics.loadErrorCount);
  });
  const memoryExperience = new MemoryExperience(app).start();
  app.memoryExperience = memoryExperience;
});

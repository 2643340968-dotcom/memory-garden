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
  inputStatusLabels: {
    waiting: "GAZE INPUT · WAITING",
    ready: "GAZE INPUT · READY",
    active: "GAZE INPUT · READY",
  },
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
    dataset.bgmUserVolume = diagnostics.bgmUserVolume.toFixed(2);
    dataset.bgmSliderPercent = String(diagnostics.bgmSliderPercent);
    dataset.bgmDuckRatio = diagnostics.bgmDuckRatio.toFixed(2);
    dataset.bgmStartCount = String(diagnostics.bgmStartCount);
    dataset.voicePlaying = String(diagnostics.voicePlaying);
    dataset.voiceBusy = String(diagnostics.voiceBusy);
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
    dataset.archiveVoiceGain = diagnostics.archiveVoiceGain.toFixed(2);
    dataset.voiceFadeIn = diagnostics.voiceFadeInDuration.toFixed(2);
    dataset.voiceFadeOut = diagnostics.voiceFadeOutDuration.toFixed(2);
    dataset.masterLimiterActive = String(diagnostics.masterLimiterActive);
    dataset.masterLimiterThreshold = String(
      diagnostics.masterLimiterThresholdDb,
    );
    dataset.masterOutputGain = diagnostics.masterOutputGain.toFixed(2);
  });
  const memoryExperience = new MemoryExperience(app).start();
  app.memoryExperience = memoryExperience;
});

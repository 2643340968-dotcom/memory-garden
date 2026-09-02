import * as THREE from "three";
import { AUDIO_CONFIG, getBGMTargetVolume } from "./AudioConfig.js";

const delay = (durationMilliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, durationMilliseconds));

function getSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredBGMVolume(storage, config) {
  const rawValue = storage?.getItem(config.BGM_SESSION_STORAGE_KEY);
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return config.BGM_VOLUME;
  }
  const storedValue = Number(rawValue);
  if (!Number.isFinite(storedValue)) {
    return config.BGM_VOLUME;
  }
  return THREE.MathUtils.clamp(storedValue, 0, config.BGM_MAX_VOLUME);
}

export class AudioManager {
  constructor(
    camera,
    {
      config = AUDIO_CONFIG,
      toggleButton = document.querySelector("#audio-toggle"),
      bgmSlider = document.querySelector("#bgm-volume"),
      storage = getSessionStorage(),
    } = {},
  ) {
    this.camera = camera;
    this.config = config;
    this.toggleButton = toggleButton;
    this.toggleLabel = toggleButton?.querySelector("#audio-toggle-label") ?? null;
    this.bgmSlider = bgmSlider;
    this.storage = storage;
    this.listener = new THREE.AudioListener();
    this.loader = new THREE.AudioLoader();
    this.bgm = new THREE.Audio(this.listener);
    this.voice = new THREE.Audio(this.listener);
    this.masterLimiter = this.context.createDynamicsCompressor();
    this.masterOutput = this.context.createGain();
    this.configureMasterOutput();
    this.bufferCache = new Map();
    this.stateListeners = new Set();
    this.unlocked = false;
    this.muted = false;
    this.pageHidden = document.hidden;
    this.unlockPromise = null;
    this.bgmLoadToken = 0;
    this.voiceRequestId = 0;
    this.pendingVoiceRequestId = 0;
    this.currentVoice = null;
    this.bgmStartCount = 0;
    this.voiceStartCount = 0;
    this.voiceReplacementCount = 0;
    this.lastVoiceEndReason = null;
    this.lastVoiceElapsedMs = 0;
    this.loadErrorCount = 0;
    this.userBGMVolume = readStoredBGMVolume(this.storage, this.config);

    this.handleToggle = this.handleToggle.bind(this);
    this.handleBGMVolumeInput = this.handleBGMVolumeInput.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  configureMasterOutput() {
    const now = this.context.currentTime;
    this.masterLimiter.threshold.setValueAtTime(
      this.config.MASTER_LIMITER_THRESHOLD_DB,
      now,
    );
    this.masterLimiter.knee.setValueAtTime(
      this.config.MASTER_LIMITER_KNEE_DB,
      now,
    );
    this.masterLimiter.ratio.setValueAtTime(
      this.config.MASTER_LIMITER_RATIO,
      now,
    );
    this.masterLimiter.attack.setValueAtTime(
      this.config.MASTER_LIMITER_ATTACK_SECONDS,
      now,
    );
    this.masterLimiter.release.setValueAtTime(
      this.config.MASTER_LIMITER_RELEASE_SECONDS,
      now,
    );
    this.masterOutput.gain.setValueAtTime(this.config.MASTER_OUTPUT_GAIN, now);
    this.listener.gain.disconnect();
    this.listener.gain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterOutput);
    this.masterOutput.connect(this.context.destination);
  }

  start() {
    this.camera.add(this.listener);
    this.bgm.setLoop(true);
    this.bgm.setVolume(0);
    this.voice.setLoop(false);
    this.voice.setVolume(0);
    this.listener.setMasterVolume(0);
    this.toggleButton?.addEventListener("click", this.handleToggle);
    this.bgmSlider?.addEventListener("input", this.handleBGMVolumeInput);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.updateBGMControl();
    this.updateToggle();
    this.notifyState();
    return this;
  }

  get context() {
    return this.listener.context;
  }

  get diagnostics() {
    return Object.freeze({
      unlocked: this.unlocked,
      muted: this.muted,
      contextState: this.context.state,
      bgmConfigured: Boolean(this.config.BGM_URL),
      bgmPlaying: this.bgm.isPlaying,
      bgmLoop: this.bgm.getLoop(),
      bgmTargetVolume: getBGMTargetVolume(
        Boolean(this.currentVoice),
        this.userBGMVolume,
        this.config,
      ),
      bgmUserVolume: this.userBGMVolume,
      bgmDuckRatio: this.config.BGM_DUCK_RATIO,
      bgmSliderPercent: this.getBGMSliderPercent(),
      bgmStartCount: this.bgmStartCount,
      voicePlaying: this.voice.isPlaying,
      voiceBusy: this.archiveVoiceBusy,
      currentVoiceId: this.currentVoice?.memoryId ?? null,
      voiceStartCount: this.voiceStartCount,
      voiceReplacementCount: this.voiceReplacementCount,
      currentVoiceDurationMs: this.currentVoice?.durationMs ?? 0,
      lastVoiceEndReason: this.lastVoiceEndReason,
      lastVoiceElapsedMs: this.lastVoiceElapsedMs,
      loadedBufferCount: this.bufferCache.size,
      loadErrorCount: this.loadErrorCount,
      archiveVoiceGain: this.config.ARCHIVE_VOICE_GAIN,
      voiceFadeInDuration: this.config.VOICE_FADE_IN_DURATION,
      voiceFadeOutDuration: this.config.VOICE_FADE_OUT_DURATION,
      masterLimiterActive: true,
      masterLimiterThresholdDb: this.config.MASTER_LIMITER_THRESHOLD_DB,
      masterLimiterRatio: this.config.MASTER_LIMITER_RATIO,
      masterOutputGain: this.config.MASTER_OUTPUT_GAIN,
    });
  }

  get archiveVoiceBusy() {
    return Boolean(this.currentVoice || this.pendingVoiceRequestId);
  }

  getBGMSliderPercent() {
    if (this.config.BGM_MAX_VOLUME <= 0) {
      return 0;
    }
    return Math.round((this.userBGMVolume / this.config.BGM_MAX_VOLUME) * 100);
  }

  updateBGMControl() {
    if (!this.bgmSlider) {
      return;
    }
    const sliderPercent = this.getBGMSliderPercent();
    this.bgmSlider.value = String(sliderPercent);
    this.bgmSlider.style.setProperty("--bgm-level", `${sliderPercent}%`);
    this.bgmSlider.setAttribute(
      "aria-valuetext",
      `Ambience ${sliderPercent}%`,
    );
  }

  handleBGMVolumeInput() {
    const sliderPercent = THREE.MathUtils.clamp(
      Number(this.bgmSlider?.value) || 0,
      0,
      100,
    );
    this.setBGMVolume(
      (sliderPercent / 100) * this.config.BGM_MAX_VOLUME,
      true,
    );
  }

  setBGMVolume(volume, persist = false) {
    this.userBGMVolume = THREE.MathUtils.clamp(
      Number(volume) || 0,
      0,
      this.config.BGM_MAX_VOLUME,
    );
    if (persist) {
      try {
        this.storage?.setItem(
          this.config.BGM_SESSION_STORAGE_KEY,
          String(this.userBGMVolume),
        );
      } catch {
        // Session storage is optional; audio remains fully functional without it.
      }
    }
    this.updateBGMControl();
    if (this.bgm.isPlaying) {
      this.rampAudioVolume(
        this.bgm,
        getBGMTargetVolume(
          Boolean(this.currentVoice),
          this.userBGMVolume,
          this.config,
        ),
        this.config.BGM_VOLUME_RAMP_DURATION,
      );
    }
    this.notifyState();
  }

  subscribe(listener) {
    this.stateListeners.add(listener);
    listener(this.diagnostics);
    return () => this.stateListeners.delete(listener);
  }

  notifyState() {
    const state = this.diagnostics;
    this.stateListeners.forEach((listener) => listener(state));
    this.updateToggle();
  }

  updateToggle() {
    if (!this.toggleButton || !this.toggleLabel) {
      return;
    }

    const state = !this.unlocked ? "waiting" : this.muted ? "muted" : "active";
    const label =
      state === "waiting"
        ? "SOUND OFF"
        : state === "muted"
          ? "SOUND OFF"
          : "SOUND ON";
    this.toggleButton.dataset.audioState = state;
    this.toggleButton.classList.toggle(
      "is-voice-playing",
      Boolean(this.currentVoice),
    );
    this.toggleButton.disabled = !this.unlocked;
    this.toggleButton.setAttribute("aria-pressed", String(this.unlocked && !this.muted));
    this.toggleLabel.textContent = label;
  }

  async unlock() {
    if (this.unlockPromise) {
      return this.unlockPromise;
    }

    this.unlockPromise = (async () => {
      try {
        if (this.context.state !== "running") {
          await this.context.resume();
        }
        this.unlocked = true;
        this.rampMasterVolume(this.muted || this.pageHidden ? 0 : 1, 0.08);
        this.notifyState();
        void this.startBGM();
        return true;
      } catch (error) {
        this.unlocked = false;
        this.notifyState();
        console.warn("Audio could not be unlocked after the visitor gesture.", error);
        return false;
      } finally {
        this.unlockPromise = null;
      }
    })();

    return this.unlockPromise;
  }

  async loadBuffer(url) {
    if (!url) {
      return null;
    }
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url);
    }

    const loadPromise = this.loader
      .loadAsync(url)
      .catch((error) => {
        this.bufferCache.delete(url);
        this.loadErrorCount += 1;
        console.warn(`Audio asset could not be loaded: ${url}`, error);
        return null;
      })
      .finally(() => this.notifyState());
    this.bufferCache.set(url, loadPromise);
    return loadPromise;
  }

  preloadArchiveVoice(archive) {
    if (!this.unlocked || !archive?.audio) {
      return Promise.resolve(null);
    }
    return this.loadBuffer(archive.audio);
  }

  rampAudioVolume(audio, targetVolume, durationSeconds, startTime = null) {
    const parameter = audio.gain.gain;
    const now = this.context.currentTime;
    const rampStart = startTime ?? now;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    if (rampStart > now) {
      parameter.setValueAtTime(parameter.value, rampStart);
    }
    parameter.linearRampToValueAtTime(
      Math.max(0, targetVolume),
      rampStart + Math.max(0.001, durationSeconds),
    );
  }

  rampMasterVolume(targetVolume, durationSeconds) {
    const parameter = this.listener.gain.gain;
    const now = this.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    parameter.linearRampToValueAtTime(
      Math.max(0, targetVolume),
      now + Math.max(0.001, durationSeconds),
    );
  }

  scheduleVoiceEnvelope(startTime, mediaDurationSeconds) {
    const parameter = this.voice.gain.gain;
    const now = this.context.currentTime;
    const mediaEnd = startTime + mediaDurationSeconds;
    const fadeInDuration = Math.min(
      this.config.VOICE_FADE_IN_DURATION,
      mediaDurationSeconds * 0.4,
    );
    const fadeOutDuration = Math.min(
      this.config.VOICE_FADE_OUT_DURATION,
      mediaDurationSeconds * 0.4,
    );
    const fadeInEnd = startTime + fadeInDuration;
    const fadeOutStart = Math.max(fadeInEnd, mediaEnd - fadeOutDuration);
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(0, now);
    parameter.setValueAtTime(0, startTime);
    parameter.linearRampToValueAtTime(
      this.config.ARCHIVE_VOICE_GAIN,
      fadeInEnd,
    );
    if (fadeOutStart < mediaEnd) {
      parameter.setValueAtTime(this.config.ARCHIVE_VOICE_GAIN, fadeOutStart);
      parameter.linearRampToValueAtTime(0, mediaEnd);
    }
  }

  async startBGM(url = this.config.BGM_URL) {
    if (!this.unlocked || !url) {
      return false;
    }
    if (this.bgm.isPlaying) {
      return true;
    }

    const token = ++this.bgmLoadToken;
    const buffer = await this.loadBuffer(url);
    if (!buffer || token !== this.bgmLoadToken || this.bgm.isPlaying) {
      return false;
    }

    this.bgm.setBuffer(buffer);
    this.bgm.setLoop(true);
    this.bgm.gain.gain.setValueAtTime(0, this.context.currentTime);
    this.bgm.play();
    this.bgmStartCount += 1;
    this.rampAudioVolume(
      this.bgm,
      getBGMTargetVolume(
        Boolean(this.currentVoice),
        this.userBGMVolume,
        this.config,
      ),
      this.config.BGM_FADE_IN_DURATION,
    );
    this.notifyState();
    return true;
  }

  async stopBGM() {
    this.bgmLoadToken += 1;
    if (!this.bgm.isPlaying) {
      return;
    }
    this.rampAudioVolume(this.bgm, 0, this.config.BGM_FADE_OUT_DURATION);
    await delay(this.config.BGM_FADE_OUT_DURATION * 1000);
    if (this.bgm.isPlaying) {
      this.bgm.stop();
    }
    this.notifyState();
  }

  setBGMDucked(ducked) {
    this.rampAudioVolume(
      this.bgm,
      getBGMTargetVolume(ducked, this.userBGMVolume, this.config),
      ducked
        ? this.config.DUCK_FADE_DURATION
        : this.config.RESTORE_FADE_DURATION,
    );
  }

  async playArchiveVoice(archive, { signal } = {}) {
    if (!this.unlocked || !archive?.audio || signal?.aborted) {
      return null;
    }

    const requestId = ++this.voiceRequestId;
    this.pendingVoiceRequestId = requestId;
    this.notifyState();
    const buffer = await this.loadBuffer(archive.audio);
    if (this.pendingVoiceRequestId === requestId) {
      this.pendingVoiceRequestId = 0;
    }
    if (!buffer || requestId !== this.voiceRequestId || signal?.aborted) {
      this.notifyState();
      return null;
    }

    const replacingVoice = Boolean(this.currentVoice);
    if (replacingVoice) {
      this.voiceReplacementCount += 1;
      await this.stopCurrentVoice("replaced", false);
    }
    if (requestId !== this.voiceRequestId || signal?.aborted) {
      return null;
    }

    this.voice.setBuffer(buffer);
    this.voice.setLoop(false);
    const delaySeconds = this.config.VOICE_START_DELAY * 0.001;
    const now = this.context.currentTime;

    let finishVoice;
    const finished = new Promise((resolve) => {
      finishVoice = resolve;
    });
    const activeVoice = {
      requestId,
      memoryId: archive.id ?? archive.audioId ?? archive.audio,
      startedAt: performance.now(),
      durationMs: (delaySeconds + buffer.duration) * 1000,
      finish: finishVoice,
    };
    this.currentVoice = activeVoice;
    this.setBGMDucked(true);
    this.voice.play(delaySeconds);
    this.scheduleVoiceEnvelope(now + delaySeconds, buffer.duration);
    const source = this.voice.source;
    const threeOnEnded = source.onended;
    source.onended = (event) => {
      threeOnEnded?.(event);
      this.completeVoice(activeVoice, "ended", true);
    };
    this.voiceStartCount += 1;
    this.notifyState();

    return Object.freeze({
      id: activeVoice.memoryId,
      durationMs: activeVoice.durationMs,
      mediaDurationMs: buffer.duration * 1000,
      finished,
    });
  }

  completeVoice(activeVoice, reason, restoreBGM) {
    if (this.currentVoice !== activeVoice) {
      return;
    }
    this.currentVoice = null;
    this.lastVoiceEndReason = reason;
    this.lastVoiceElapsedMs = Math.max(0, performance.now() - activeVoice.startedAt);
    activeVoice.finish(Object.freeze({ reason }));
    if (restoreBGM) {
      this.setBGMDucked(false);
    }
    this.notifyState();
  }

  async stopCurrentVoice(reason = "stopped", restoreBGM = true) {
    const activeVoice = this.currentVoice;
    if (!activeVoice) {
      return;
    }

    const fadeDuration = reason === "replaced"
      ? this.config.VOICE_REPLACE_FADE_DURATION
      : this.config.VOICE_FADE_OUT_DURATION;
    this.rampAudioVolume(this.voice, 0, fadeDuration);
    await delay(fadeDuration * 1000);
    if (this.currentVoice !== activeVoice) {
      return;
    }
    if (this.voice.isPlaying) {
      this.voice.stop();
    }
    this.completeVoice(activeVoice, reason, restoreBGM);
  }

  stopArchiveVoice(memoryId, reason = "indicator-dismissed") {
    if (!this.currentVoice || this.currentVoice.memoryId !== memoryId) {
      return Promise.resolve();
    }
    this.voiceRequestId += 1;
    return this.stopCurrentVoice(reason, true);
  }

  resetArchiveAudio() {
    this.voiceRequestId += 1;
    this.pendingVoiceRequestId = 0;
    return this.stopCurrentVoice("reset", true);
  }

  handleToggle() {
    if (!this.unlocked) {
      return;
    }
    this.setMuted(!this.muted);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.rampMasterVolume(
      this.muted || this.pageHidden ? 0 : 1,
      this.config.MASTER_FADE_DURATION,
    );
    this.notifyState();
  }

  handleVisibilityChange() {
    this.pageHidden = document.hidden;
    if (!this.unlocked) {
      return;
    }
    if (!this.pageHidden && this.context.state !== "running") {
      void this.context.resume();
    }
    this.rampMasterVolume(
      this.pageHidden || this.muted ? 0 : 1,
      this.config.VISIBILITY_FADE_DURATION,
    );
  }

  destroy() {
    this.toggleButton?.removeEventListener("click", this.handleToggle);
    this.bgmSlider?.removeEventListener("input", this.handleBGMVolumeInput);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.voiceRequestId += 1;
    this.pendingVoiceRequestId = 0;
    void this.stopCurrentVoice("destroyed", false);
    void this.stopBGM();
    this.camera.remove(this.listener);
    this.masterLimiter.disconnect();
    this.masterOutput.disconnect();
    this.stateListeners.clear();
  }
}

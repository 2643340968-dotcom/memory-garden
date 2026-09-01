import * as THREE from "three";
import {
  AUDIO_CONFIG,
  getBGMTargetVolume,
  shouldTriggerBloomSfx,
} from "./AudioConfig.js";

const delay = (durationMilliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, durationMilliseconds));

export class AudioManager {
  constructor(
    camera,
    {
      config = AUDIO_CONFIG,
      random = Math.random,
      toggleButton = document.querySelector("#audio-toggle"),
    } = {},
  ) {
    this.camera = camera;
    this.config = config;
    this.random = random;
    this.toggleButton = toggleButton;
    this.toggleLabel = toggleButton?.querySelector("#audio-toggle-label") ?? null;
    this.listener = new THREE.AudioListener();
    this.loader = new THREE.AudioLoader();
    this.bgm = new THREE.Audio(this.listener);
    this.voice = new THREE.Audio(this.listener);
    this.bufferCache = new Map();
    this.stateListeners = new Set();
    this.unlocked = false;
    this.muted = false;
    this.pageHidden = document.hidden;
    this.unlockPromise = null;
    this.bgmLoadToken = 0;
    this.voiceRequestId = 0;
    this.currentVoice = null;
    this.noiseBuffer = null;
    this.lastBloomSfxAt = Number.NEGATIVE_INFINITY;
    this.lastMemorySfxAt = Number.NEGATIVE_INFINITY;
    this.bgmStartCount = 0;
    this.voiceStartCount = 0;
    this.voiceReplacementCount = 0;
    this.lastVoiceEndReason = null;
    this.lastVoiceElapsedMs = 0;
    this.bloomSfxCount = 0;
    this.memorySfxCount = 0;
    this.loadErrorCount = 0;

    this.handleToggle = this.handleToggle.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  start() {
    this.camera.add(this.listener);
    this.bgm.setLoop(true);
    this.bgm.setVolume(0);
    this.voice.setLoop(false);
    this.voice.setVolume(0);
    this.listener.setMasterVolume(0);
    this.toggleButton?.addEventListener("click", this.handleToggle);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
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
        this.config,
      ),
      bgmStartCount: this.bgmStartCount,
      voicePlaying: this.voice.isPlaying,
      currentVoiceId: this.currentVoice?.memoryId ?? null,
      voiceStartCount: this.voiceStartCount,
      voiceReplacementCount: this.voiceReplacementCount,
      currentVoiceDurationMs: this.currentVoice?.durationMs ?? 0,
      lastVoiceEndReason: this.lastVoiceEndReason,
      lastVoiceElapsedMs: this.lastVoiceElapsedMs,
      bloomSfxCount: this.bloomSfxCount,
      memorySfxCount: this.memorySfxCount,
      loadedBufferCount: this.bufferCache.size,
      loadErrorCount: this.loadErrorCount,
    });
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
        ? "SOUND · WAITING"
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

  preloadMemoryVoices(memories) {
    if (!this.unlocked) {
      return Promise.resolve([]);
    }
    const urls = [...new Set(memories.map((memory) => memory.audio).filter(Boolean))];
    return Promise.all(urls.map((url) => this.loadBuffer(url)));
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
      getBGMTargetVolume(Boolean(this.currentVoice), this.config),
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
      getBGMTargetVolume(ducked, this.config),
      ducked
        ? this.config.DUCK_FADE_DURATION
        : this.config.RESTORE_FADE_DURATION,
    );
  }

  async playMemoryVoice(memory, { signal } = {}) {
    if (!this.unlocked || !memory?.audio || signal?.aborted) {
      return null;
    }

    const requestId = ++this.voiceRequestId;
    const buffer = await this.loadBuffer(memory.audio);
    if (!buffer || requestId !== this.voiceRequestId || signal?.aborted) {
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
    this.voice.gain.gain.cancelScheduledValues(now);
    this.voice.gain.gain.setValueAtTime(0, now);

    let finishVoice;
    const finished = new Promise((resolve) => {
      finishVoice = resolve;
    });
    const activeVoice = {
      requestId,
      memoryId: memory.id ?? memory.audioId ?? memory.audio,
      startedAt: performance.now(),
      durationMs: (delaySeconds + buffer.duration) * 1000,
      finish: finishVoice,
    };
    this.currentVoice = activeVoice;
    this.setBGMDucked(true);
    this.voice.play(delaySeconds);
    this.rampAudioVolume(
      this.voice,
      this.config.VOICE_VOLUME,
      this.config.VOICE_FADE_IN_DURATION,
      now + delaySeconds,
    );
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

    this.rampAudioVolume(this.voice, 0, this.config.VOICE_REPLACE_FADE_DURATION);
    await delay(this.config.VOICE_REPLACE_FADE_DURATION * 1000);
    if (this.currentVoice !== activeVoice) {
      return;
    }
    if (this.voice.isPlaying) {
      this.voice.stop();
    }
    this.completeVoice(activeVoice, reason, restoreBGM);
  }

  stopMemoryVoice(memoryId, reason = "card-dismissed") {
    if (!this.currentVoice || this.currentVoice.memoryId !== memoryId) {
      return Promise.resolve();
    }
    this.voiceRequestId += 1;
    return this.stopCurrentVoice(reason, true);
  }

  resetMemoryAudio() {
    this.voiceRequestId += 1;
    return this.stopCurrentVoice("reset", true);
  }

  getNoiseBuffer() {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }
    const frameCount = Math.ceil(this.context.sampleRate * 0.72);
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  playBloomSfx(nowMilliseconds = performance.now()) {
    if (!this.unlocked || this.muted || this.pageHidden) {
      return false;
    }
    if (
      !shouldTriggerBloomSfx(
        nowMilliseconds,
        this.lastBloomSfxAt,
        this.random(),
        this.config,
      )
    ) {
      return false;
    }

    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.getNoiseBuffer();
    source.playbackRate.value = 0.84 + this.random() * 0.18;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520 + this.random() * 180, now);
    filter.Q.value = 0.38;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.config.BLOOM_SFX_VOLUME, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.listener.getInput());
    source.start(now);
    source.stop(now + 0.66);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    this.lastBloomSfxAt = nowMilliseconds;
    this.bloomSfxCount += 1;
    return true;
  }

  playMemorySfx(nowMilliseconds = performance.now()) {
    if (
      !this.unlocked ||
      this.muted ||
      this.pageHidden ||
      nowMilliseconds - this.lastMemorySfxAt < this.config.MEMORY_SFX_COOLDOWN
    ) {
      return false;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(390, now);
    oscillator.frequency.exponentialRampToValueAtTime(330, now + 0.24);
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.config.MEMORY_SFX_VOLUME, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.listener.getInput());
    oscillator.start(now);
    oscillator.stop(now + 0.28);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    this.lastMemorySfxAt = nowMilliseconds;
    this.memorySfxCount += 1;
    return true;
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
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.voiceRequestId += 1;
    void this.stopCurrentVoice("destroyed", false);
    void this.stopBGM();
    this.camera.remove(this.listener);
    this.stateListeners.clear();
  }
}

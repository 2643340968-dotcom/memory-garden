export const AUDIO_CONFIG = Object.freeze({
  // Intentionally empty until a suitable ambient track is supplied.
  BGM_URL: null,
  BGM_VOLUME: 0.18,
  BGM_DUCK_VOLUME: 0.06,
  BGM_FADE_IN_DURATION: 5,
  BGM_FADE_OUT_DURATION: 1.4,
  DUCK_FADE_DURATION: 0.65,
  RESTORE_FADE_DURATION: 1.6,
  VOICE_VOLUME: 0.72,
  VOICE_FADE_IN_DURATION: 0.18,
  VOICE_REPLACE_FADE_DURATION: 0.28,
  VOICE_START_DELAY: 480,
  VOICE_CARD_TAIL_DURATION: 900,
  VOICE_CARD_MAX_DURATION: 24000,
  BLOOM_SFX_VOLUME: 0.018,
  BLOOM_SFX_COOLDOWN: 850,
  BLOOM_SFX_PROBABILITY: 0.38,
  MEMORY_SFX_VOLUME: 0.012,
  MEMORY_SFX_COOLDOWN: 360,
  MASTER_FADE_DURATION: 0.18,
  VISIBILITY_FADE_DURATION: 0.28,
});

export function getBGMTargetVolume(
  voiceActive,
  config = AUDIO_CONFIG,
) {
  return voiceActive ? config.BGM_DUCK_VOLUME : config.BGM_VOLUME;
}

export function getVoiceCardVisibleDuration(
  audioDurationMilliseconds,
  defaultDurationMilliseconds,
  config = AUDIO_CONFIG,
) {
  const defaultDuration = Math.max(0, defaultDurationMilliseconds);
  const audioDuration = Math.max(0, audioDurationMilliseconds);
  return Math.min(
    config.VOICE_CARD_MAX_DURATION,
    Math.max(defaultDuration, audioDuration + config.VOICE_CARD_TAIL_DURATION),
  );
}

export function shouldTriggerBloomSfx(
  nowMilliseconds,
  lastTriggerMilliseconds,
  randomValue,
  config = AUDIO_CONFIG,
) {
  const cooldownElapsed =
    nowMilliseconds - lastTriggerMilliseconds >= config.BLOOM_SFX_COOLDOWN;
  return cooldownElapsed && randomValue < config.BLOOM_SFX_PROBABILITY;
}

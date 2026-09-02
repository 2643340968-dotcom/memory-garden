export const AUDIO_CONFIG = Object.freeze({
  BGM_URL: "./assets/memories/bgm/bgm.mp3",
  BGM_VOLUME: 0.28,
  BGM_MAX_VOLUME: 0.36,
  BGM_DUCK_RATIO: 0.33,
  BGM_VOLUME_RAMP_DURATION: 0.18,
  BGM_SESSION_STORAGE_KEY: "memory-garden-bgm-volume",
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
  VOICE_LIMITER_THRESHOLD_DB: -4.5,
  VOICE_LIMITER_KNEE_DB: 0,
  VOICE_LIMITER_RATIO: 12,
  VOICE_LIMITER_ATTACK_SECONDS: 0.003,
  VOICE_LIMITER_RELEASE_SECONDS: 0.18,
  MASTER_FADE_DURATION: 0.18,
  VISIBILITY_FADE_DURATION: 0.28,
});

export function getBGMTargetVolume(
  voiceActive,
  userVolume = AUDIO_CONFIG.BGM_VOLUME,
  config = AUDIO_CONFIG,
) {
  const baseVolume = Math.max(
    0,
    Math.min(config.BGM_MAX_VOLUME, Number(userVolume) || 0),
  );
  return voiceActive ? baseVolume * config.BGM_DUCK_RATIO : baseVolume;
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

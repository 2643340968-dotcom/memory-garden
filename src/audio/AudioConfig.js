export const AUDIO_CONFIG = Object.freeze({
  BGM_URL: "./assets/memories/bgm-normalized/bgm.mp3",
  BGM_VOLUME: 0.52,
  BGM_MAX_VOLUME: 0.64,
  BGM_DUCK_RATIO: 0.72,
  BGM_VOLUME_RAMP_DURATION: 0.18,
  BGM_SESSION_STORAGE_KEY: "memory-garden-bgm-volume-v2",
  BGM_FADE_IN_DURATION: 5,
  BGM_FADE_OUT_DURATION: 1.4,
  DUCK_FADE_DURATION: 0.65,
  RESTORE_FADE_DURATION: 1.6,
  ARCHIVE_VOICE_GAIN: 0.38,
  VOICE_FADE_IN_DURATION: 0.65,
  VOICE_FADE_OUT_DURATION: 0.75,
  VOICE_REPLACE_FADE_DURATION: 0.65,
  VOICE_START_DELAY: 480,
  VOICE_CARD_TAIL_DURATION: 900,
  VOICE_CARD_MAX_DURATION: 24000,
  MASTER_LIMITER_THRESHOLD_DB: -18,
  MASTER_LIMITER_KNEE_DB: 6,
  MASTER_LIMITER_RATIO: 4,
  MASTER_LIMITER_ATTACK_SECONDS: 0.01,
  MASTER_LIMITER_RELEASE_SECONDS: 0.22,
  MASTER_OUTPUT_GAIN: 0.82,
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

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
  BLOOM_SFX_VOLUME: 0.006,
  BLOOM_SFX_MIN_DURATION: 0.22,
  BLOOM_SFX_MAX_DURATION: 0.38,
  BLOOM_SFX_ATTACK_DURATION: 0.014,
  BLOOM_SFX_TONE_MIN_FREQUENCY: 1450,
  BLOOM_SFX_TONE_MAX_FREQUENCY: 1850,
  BLOOM_SFX_AIR_MIN_FREQUENCY: 2800,
  BLOOM_SFX_AIR_MAX_FREQUENCY: 4300,
  BLOOM_SFX_AIR_HIGHPASS_FREQUENCY: 1500,
  BLOOM_SFX_AIR_MIX_MIN: 0.48,
  BLOOM_SFX_AIR_MIX_MAX: 0.62,
  BLOOM_SFX_OVERTONE_RATIO: 2.04,
  BLOOM_SFX_OVERTONE_LEVEL: 0.14,
  BLOOM_SFX_COOLDOWN: 1050,
  BLOOM_SFX_PROBABILITY: 0.28,
  MEMORY_SFX_VOLUME: 0.012,
  MEMORY_SFX_COOLDOWN: 360,
  MASTER_FADE_DURATION: 0.18,
  VISIBILITY_FADE_DURATION: 0.28,
});

function clampUnit(value) {
  return Math.max(0, Math.min(0.999999, Number(value) || 0));
}

function vary(minimum, maximum, random) {
  return minimum + (maximum - minimum) * clampUnit(random());
}

export function getBloomSfxParameters(
  random = Math.random,
  config = AUDIO_CONFIG,
) {
  const durationSeconds = vary(
    config.BLOOM_SFX_MIN_DURATION,
    config.BLOOM_SFX_MAX_DURATION,
    random,
  );
  const toneFrequencyHz = vary(
    config.BLOOM_SFX_TONE_MIN_FREQUENCY,
    config.BLOOM_SFX_TONE_MAX_FREQUENCY,
    random,
  );
  const airFrequencyHz = vary(
    config.BLOOM_SFX_AIR_MIN_FREQUENCY,
    config.BLOOM_SFX_AIR_MAX_FREQUENCY,
    random,
  );
  const airMix = vary(
    config.BLOOM_SFX_AIR_MIX_MIN,
    config.BLOOM_SFX_AIR_MIX_MAX,
    random,
  );

  return Object.freeze({
    volume: config.BLOOM_SFX_VOLUME,
    durationSeconds,
    attackSeconds: Math.min(
      config.BLOOM_SFX_ATTACK_DURATION,
      durationSeconds * 0.2,
    ),
    toneFrequencyHz,
    overtoneFrequencyHz:
      toneFrequencyHz * config.BLOOM_SFX_OVERTONE_RATIO,
    airFrequencyHz,
    airHighpassFrequencyHz: config.BLOOM_SFX_AIR_HIGHPASS_FREQUENCY,
    airMix,
    toneMix: 1 - airMix,
    overtoneLevel: config.BLOOM_SFX_OVERTONE_LEVEL,
  });
}

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

export const BLOOM_PATCH_CONFIG = Object.freeze({
  // Cursor attention is measured in world-space ground units.
  ATTENTION_RADIUS: 2.65,
  ATTENTION_GAIN_RATE: 0.85,
  ATTENTION_DECAY_RATE: 0.075,
  DECAY_THRESHOLD: 0.2,
  ATTENTION_GRACE_DURATION: 3.2,

  // A patch remains fully present for at least this long, even when the
  // pointer never returns to it.
  MIN_PATCH_LIFETIME: 8,
  DECAY_DURATION: 4.6,

  // One shared Points pool carries birth dots, decay dots, and the soft
  // bloom aura. Values are intentionally restrained for the current scene.
  PARTICLE_POOL_CAPACITY: 4096,
  BLOOM_PARTICLE_COUNT: 96,
  BLOOM_PARTICLE_DURATION: 1.25,
  BLOOM_GLOW_INTENSITY: 0.3,
  BLOOM_GLOW_DURATION: 1.05,
  BLOOM_GLOW_SIZE_MIN: 112,
  BLOOM_GLOW_SIZE_MAX: 176,
  DECAY_PARTICLE_COUNT: 26,
  DECAY_PARTICLE_DURATION: 1.9,
});

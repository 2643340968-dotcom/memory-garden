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

  // A single stable-slot Points pool is the primary PNG flower renderer.
  // Every flower receives a cached alpha/color point cloud; no cursor trail or
  // ambient dust class exists. Under pressure the pool reduces samples evenly
  // per flower instead of dropping whole flowers from the particle rendering.
  PARTICLE_POOL_CAPACITY: 262144,
  FLOWER_PARTICLE_SAMPLE_LIBRARY_SIZE: 1024,
  FLOWER_PARTICLE_SAMPLE_COUNT: 128,
  FLOWER_PARTICLE_MIN_SAMPLES: 24,
  FLOWER_PARTICLE_ACTIVE_RATIO: 0.88,
  ACTIVE_PATCH_ENHANCED_RATIO: 1,
  FLOWER_PARTICLE_CENTER_EMPHASIS: 1.8,
  FLOWER_PARTICLE_EDGE_SAMPLE_RATIO: 0.24,
  FLOWER_PARTICLE_BIRTH_DURATION: 0.95,
  FLOWER_PARTICLE_BIRTH_HOLD_DURATION: 0.32,
  FLOWER_PARTICLE_SETTLE_DURATION: 0.72,
  FLOWER_PARTICLE_BIRTH_OPACITY: 0.96,
  FLOWER_PARTICLE_IDLE_OPACITY: 0.76,
  FLOWER_PARTICLE_ATTENDED_OPACITY: 0.94,
  FLOWER_PARTICLE_DECAY_OPACITY: 0.98,
  FLOWER_PARTICLE_IDLE_FADE_DURATION: 0.48,
  FLOWER_PARTICLE_DRIFT_AMOUNT: 0.003,
  FLOWER_PARTICLE_COLOR_VARIANCE: 0.025,
  FLOWER_PARTICLE_SIZE_MIN: 0.58,
  FLOWER_PARTICLE_SIZE_MAX: 1.08,
  FLOWER_PARTICLE_HDR_GAIN: 1.34,
  FLOWER_CENTER_HDR_GAIN: 2.35,
  FLOWER_CENTER_GLOW_INTENSITY: 0.15,
  FLOWER_CENTER_GLOW_RADIUS: 6.5,
  // The patch aura is distributed across the existing flower-center points;
  // there is deliberately no separate large circular glow sprite.
  PATCH_GLOW_INTENSITY: 0.006,
  DECAY_EDGE_BREAKUP_AMOUNT: 0.42,

  // The card stays subdued until the sampled point cloud has described the
  // flower, then becomes the quiet base layer of the hybrid rendering.
  FLOWER_CARD_REVEAL_DELAY: 0.58,
  FLOWER_CARD_REVEAL_DURATION: 0.88,
  FLOWER_CARD_MAX_VISIBILITY: 0.11,
  FLOWER_CARD_DECAY_VITALITY_FLOOR: 0.2,
  FLOWER_CARD_DECAY_MIN_VISIBILITY: 0,

  // PNG-only full-scene HDR glare. The high threshold means ordinary grass,
  // ground, and card color remain below extraction; hot flower particles own
  // the visible bloom signal.
  BLOOM_STRENGTH: 0.11,
  BLOOM_RADIUS: 0.12,
  BLOOM_THRESHOLD: 1.04,
});

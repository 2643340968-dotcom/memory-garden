export const CONFIG = Object.freeze({
  GROUND_SIZE: 32,
  GROUND_COLOR: 0x617a50,

  MAX_FLOWERS: 20000,
  BLOOM_TRIGGER_DISTANCE: 0.9,
  // Milliseconds between the scheduled starts of neighboring bloom events.
  BLOOM_TRIGGER_COOLDOWN: 160,
  BLOOM_RADIUS_MIN: 1,
  BLOOM_RADIUS_MAX: 1.45,
  // Converts the conceptual bloom radius to a screen-space brush radius.
  BLOOM_RADIUS_PX_SCALE: 68,
  FLOWERS_PER_BLOOM_MIN: 32,
  FLOWERS_PER_BLOOM_MAX: 48,
  BLOOM_LOBE_MIN: 3,
  BLOOM_LOBE_MAX: 5,
  // Maximum lobe-center offset as a fraction of the bloom radius.
  LOBE_OFFSET_RADIUS: 0.62,
  // Bloom animation values are seconds except for the cooldown above.
  BLOOM_DURATION_MIN: 0.42,
  BLOOM_DURATION_MAX: 0.68,
  BLOOM_DELAY_MAX: 0.07,
  BLOOM_OUTWARD_DELAY: 0.2,
  BLOOM_OVERSHOOT: 1.06,
  BLOOM_ANCHOR_JITTER: 0.3,
  BLOOM_START_SCALE: 0.045,
  BLOOM_START_Y_OFFSET: 0.12,
  BLOOM_EDGE_REJECTION: 0.16,
  MAX_BLOOMS_PER_FRAME: 3,

  FLOWER_MODEL_PATH: "./assets/flowers/zijincao.glb",
  // The loader normalizes the source GLB height to this world-space height.
  FLOWER_BASE_HEIGHT: 0.82,
  FLOWER_SCALE_MIN: 0.78,
  FLOWER_SCALE_MAX: 1.18,
  FLOWER_TILT_MAX: (Math.PI / 180) * 8,
  FLOWER_POSITION_JITTER: 0.035,

  SWAY_AMOUNT_MIN: 0.012,
  SWAY_AMOUNT_MAX: 0.034,
  SWAY_SPEED_MIN: 0.65,
  SWAY_SPEED_MAX: 1.08,
  // Mature flowers retain CPU sway, but only this many are refreshed per frame.
  SETTLED_SWAY_UPDATES_PER_FRAME: 2000,

  GRASS_ENABLED: true,
  GRASS_COUNT: 6500,
  GRASS_HEIGHT_MIN: 0.16,
  GRASS_HEIGHT_MAX: 0.42,
  GRASS_WIDTH_MIN: 0.012,
  GRASS_WIDTH_MAX: 0.026,
  GRASS_COLORS: [0x6f8c5c, 0x7f9b68, 0x8da872, 0x627e52],

  CAMERA_FOV: 44,
  CAMERA_NEAR: 0.12,
  CAMERA_FAR: 70,
  CAMERA_POSITION: Object.freeze({ x: 0, y: 3.05, z: 8.4 }),
  CAMERA_LOOK_AT: Object.freeze({ x: 0, y: 0.5, z: -6.2 }),

  FOG: Object.freeze({
    color: 0xdce8d6,
    near: 10,
    far: 33,
  }),

  MAX_PIXEL_RATIO: 1.75,
  HIT_MARKER_IDLE_COLOR: 0xf3f0df,
  HIT_MARKER_ACTIVE_COLOR: 0x9a6fe1,
});

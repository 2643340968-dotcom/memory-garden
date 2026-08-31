import { CONFIG } from "../../config.js";

export const PNG_FLOWER_CONFIG = Object.freeze({
  PNG_FLOWER_PATHS: Object.freeze([
    "/assets/flowers/png/zijincao_01.png",
    "/assets/flowers/png/zijincao_02.png",
    "/assets/flowers/png/zijincao_03.png",
    "/assets/flowers/png/zijincao_04.png",
    "/assets/flowers/png/zijincao_05.png",
  ]),

  FLOWER_CARD_HEIGHT: 0.86,
  FLOWER_SCALE_MIN: 0.72,
  FLOWER_SCALE_MAX: 1.12,
  FLOWER_YAW_MAX: (Math.PI / 180) * 20,
  FLOWER_TILT_MAX: (Math.PI / 180) * 5,
  FLOWER_ALPHA_TEST: 0.2,
  FLOWER_TINT: 0xececf5,
  FLOWER_OPACITY: 0.96,
  FLOWER_MIRROR_PROBABILITY: 0.4,
  FLOWER_CARD_MODE: "single",

  // The PNG page keeps the same bloom rhythm and brush radius while leaving
  // more ground visible inside each cluster.
  MAX_FLOWERS: CONFIG.MAX_FLOWERS,
  FLOWERS_PER_BLOOM_MIN: 22,
  FLOWERS_PER_BLOOM_MAX: 34,
});

export const PNG_SCENE_CONFIG = Object.freeze({
  GROUND_COLOR: 0x68746b,
  GROUND_VISUAL_SIZE: 52,
  GROUND_TEXTURE_REPEAT: 16,
  GROUND_TEXTURE_BASE: "#adb0a8",
  GROUND_TEXTURE_STROKE: "#847b8d",
  GROUND_EMISSIVE_COLOR: 0x36403b,
  GROUND_EMISSIVE_INTENSITY: 0.95,

  GRASS_COUNT: 7600,
  GRASS_FIELD_SIZE: 44,
  GRASS_FIELD_CENTER_Z: -4,
  GRASS_DENSITY_VARIATION: 0.42,
  GRASS_EDGE_FADE_WIDTH: 5,
  GRASS_EDGE_JITTER: 2.4,
  GRASS_DISTANCE_FADE_START: -8,
  GRASS_DISTANCE_FADE_END: -24,
  GRASS_DISTANCE_MIN_SCALE: 0.12,
  GRASS_HEIGHT_MIN: 0.14,
  GRASS_HEIGHT_MAX: 0.34,
  GRASS_WIDTH_MIN: 0.01,
  GRASS_WIDTH_MAX: 0.02,
  GRASS_OPACITY: 0.5,
  GRASS_TAPERED: true,
  GRASS_COLORS: Object.freeze([
    0x89958d,
    0x7e8b84,
    0x74817e,
    0x92908c,
  ]),

  TONE_MAPPING_EXPOSURE: 1.04,

  LIGHTING: Object.freeze({
    hemisphereSky: 0x5a486d,
    hemisphereGround: 0x26312d,
    hemisphereIntensity: 1.25,
    directionalColor: 0xa69ab6,
    directionalIntensity: 0.72,
    directionalPosition: Object.freeze({ x: -7, y: 10, z: 5 }),
    directionalTarget: Object.freeze({ x: 0, y: 0, z: -6 }),
    overheadGlow: Object.freeze({
      enabled: true,
      color: 0x9675b5,
      intensity: 92,
      distance: 26,
      angle: 0.85,
      penumbra: 0.97,
      decay: 1.55,
      position: Object.freeze({ x: 0, y: 9.5, z: -1 }),
      target: Object.freeze({ x: 0, y: 0, z: -5.5 }),
    }),
  }),

  FOG: Object.freeze({
    color: 0x2b2335,
    near: 9.5,
    far: 31,
  }),
});

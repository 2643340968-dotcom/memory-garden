import { BLOOM_PATCH_CONFIG } from "../BloomPatchConfig.js";
import { createSeededRandom, randomRange } from "../../utils/random.js";

const SAMPLE_ALPHA_THRESHOLD = 0.16;
const SAMPLE_CANVAS_MAX_WIDTH = 112;
const SAMPLE_CANVAS_MAX_HEIGHT = 256;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function srgbChannelToLinear(value) {
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

function alphaAt(data, width, height, x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return 0;
  }
  return data[(y * width + x) * 4 + 3] / 255;
}

function buildCumulativeWeights(
  candidates,
  weightKey = "weight",
  cumulativeKey = "cumulativeWeight",
) {
  let total = 0;
  for (const candidate of candidates) {
    total += candidate[weightKey];
    candidate[cumulativeKey] = total;
  }
  return total;
}

function pickWeighted(
  candidates,
  totalWeight,
  random,
  cumulativeKey = "cumulativeWeight",
) {
  let low = 0;
  let high = candidates.length - 1;
  const target = random() * totalWeight;

  while (low < high) {
    const middle = (low + high) >> 1;
    if (candidates[middle][cumulativeKey] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return candidates[low];
}

function freezeSample(candidate, cardWidth, cardHeight) {
  return Object.freeze({
    x: (candidate.u - 0.5) * cardWidth,
    y: (1 - candidate.v) * cardHeight,
    z: 0.008,
    u: candidate.u,
    v: candidate.v,
    alpha: candidate.alpha,
    edge: candidate.edge,
    center: candidate.centerSignal,
    color: Object.freeze([
      srgbChannelToLinear(candidate.red),
      srgbChannelToLinear(candidate.green),
      srgbChannelToLinear(candidate.blue),
    ]),
  });
}

export function sampleFlowerImageData(
  imageData,
  {
    sampleCount = BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_SAMPLE_LIBRARY_SIZE,
    cardWidth,
    cardHeight,
    random = Math.random,
  },
) {
  const { data, width, height } = imageData;
  if (!data || width <= 0 || height <= 0) {
    throw new TypeError("Flower particle sampling requires valid image data.");
  }

  const candidates = [];
  const edgeCandidates = [];
  let centerCandidate = null;
  let centerScoreMaximum = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3] / 255;
      if (alpha < SAMPLE_ALPHA_THRESHOLD) {
        continue;
      }

      const red = data[offset] / 255;
      const green = data[offset + 1] / 255;
      const blue = data[offset + 2] / 255;
      const u = (x + 0.5) / width;
      const v = (y + 0.5) / height;
      const localHeight = 1 - v;
      const nearestNeighborAlpha = Math.min(
        alphaAt(data, width, height, x - 1, y),
        alphaAt(data, width, height, x + 1, y),
        alphaAt(data, width, height, x, y - 1),
        alphaAt(data, width, height, x, y + 1),
      );
      const edge = clamp01(
        (alpha - nearestNeighborAlpha) * 1.4 + (1 - alpha) * 0.45,
      );
      const upperFlowerBias = 0.38 + Math.pow(localHeight, 1.45) * 1.35;
      const centerAxisBias = 0.76 + (1 - Math.abs(u - 0.5) * 2) * 0.42;
      const violetSignal = clamp01(
        (red + blue) * 0.7 - green * 0.45,
      );
      const centerSignal = clamp01(
        (Math.min(red, green) - blue * 0.55) * alpha,
      );
      const flowerStructureBias =
        0.55 +
        violetSignal * 1.15 +
        centerSignal * BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_CENTER_EMPHASIS;
      const weight =
        (0.3 + alpha * 0.7) *
        upperFlowerBias *
        centerAxisBias *
        flowerStructureBias;
      const centerScore =
        red * green * (1 - blue * 0.72) * alpha *
        (0.25 + localHeight * 0.75);
      const candidate = {
        u,
        v,
        red,
        green,
        blue,
        alpha,
        edge,
        centerSignal,
        weight,
        edgeWeight: weight * (0.2 + edge * 1.8),
        cumulativeWeight: 0,
        cumulativeEdgeWeight: 0,
      };

      candidates.push(candidate);
      if (edge > 0.18) {
        edgeCandidates.push(candidate);
      }
      if (centerScore > centerScoreMaximum) {
        centerScoreMaximum = centerScore;
        centerCandidate = candidate;
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error("The PNG flower texture has no visible alpha pixels.");
  }

  const totalWeight = buildCumulativeWeights(candidates);
  const edgeTotalWeight =
    edgeCandidates.length > 0
      ? buildCumulativeWeights(
          edgeCandidates,
          "edgeWeight",
          "cumulativeEdgeWeight",
        )
      : 0;
  const samples = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const useEdge =
      edgeTotalWeight > 0 &&
      random() < BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_EDGE_SAMPLE_RATIO;
    const candidate = useEdge
      ? pickWeighted(
          edgeCandidates,
          edgeTotalWeight,
          random,
          "cumulativeEdgeWeight",
        )
      : pickWeighted(candidates, totalWeight, random);
    samples.push(freezeSample(candidate, cardWidth, cardHeight));
  }

  return Object.freeze({
    source: "png-alpha",
    samples: Object.freeze(samples),
    center: freezeSample(
      centerCandidate ?? candidates[0],
      cardWidth,
      cardHeight,
    ),
    visiblePixelCount: candidates.length,
  });
}

export function createFallbackFlowerParticleSampleSet(
  aspect,
  variantIndex = 0,
  cardHeight = 1,
) {
  const cardWidth = cardHeight * aspect;
  const random = createSeededRandom((0xf10a900d ^ variantIndex) >>> 0);
  const samples = [];

  for (
    let index = 0;
    index < BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_SAMPLE_LIBRARY_SIZE;
    index += 1
  ) {
    const angle = randomRange(random, 0, Math.PI * 2);
    const radius = Math.sqrt(random());
    const u = 0.5 + Math.cos(angle) * radius * 0.34;
    const v = 0.4 + Math.sin(angle) * radius * 0.27;
    samples.push(
      Object.freeze({
        x: (u - 0.5) * cardWidth,
        y: (1 - v) * cardHeight,
        z: 0.008,
        u,
        v,
        alpha: 1,
        edge: clamp01((radius - 0.62) / 0.38),
        center: clamp01(1 - radius * 1.35),
        color: Object.freeze([0.48, 0.34, 0.78]),
      }),
    );
  }

  return Object.freeze({
    source: "fallback",
    samples: Object.freeze(samples),
    center: Object.freeze({
      x: 0,
      y: cardHeight * 0.6,
      z: 0.008,
      u: 0.5,
      v: 0.4,
      alpha: 1,
      edge: 0,
      center: 1,
      color: Object.freeze([0.8, 0.72, 0.94]),
    }),
    visiblePixelCount: 0,
  });
}

export function createFlowerParticleSampleSetFromImage(
  image,
  aspect,
  variantIndex,
  cardHeight = 1,
) {
  if (typeof document === "undefined") {
    return createFallbackFlowerParticleSampleSet(
      aspect,
      variantIndex,
      cardHeight,
    );
  }

  const sourceWidth = image?.naturalWidth ?? image?.width ?? 0;
  const sourceHeight = image?.naturalHeight ?? image?.height ?? 0;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return createFallbackFlowerParticleSampleSet(
      aspect,
      variantIndex,
      cardHeight,
    );
  }

  let width = Math.min(SAMPLE_CANVAS_MAX_WIDTH, sourceWidth);
  let height = Math.max(1, Math.round(width * (sourceHeight / sourceWidth)));
  if (height > SAMPLE_CANVAS_MAX_HEIGHT) {
    const scale = SAMPLE_CANVAS_MAX_HEIGHT / height;
    width = Math.max(1, Math.round(width * scale));
    height = SAMPLE_CANVAS_MAX_HEIGHT;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return createFallbackFlowerParticleSampleSet(
      aspect,
      variantIndex,
      cardHeight,
    );
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const random = createSeededRandom((0x51a77e11 ^ variantIndex) >>> 0);
  return sampleFlowerImageData(imageData, {
    sampleCount: BLOOM_PATCH_CONFIG.FLOWER_PARTICLE_SAMPLE_LIBRARY_SIZE,
    cardWidth: aspect * cardHeight,
    cardHeight,
    random,
  });
}

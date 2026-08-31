const REQUIRED_METHODS = Object.freeze([
  "addToScene",
  "setCount",
  "setMatrixAt",
  "commit",
  "reset",
  "dispose",
]);

/**
 * Runtime contract shared by the Bloom system and visual implementations.
 * A flower renderer owns GPU objects; FlowerSystem owns placement and timing.
 */
export function assertFlowerRenderer(renderer, requiredCapacity) {
  if (!renderer || typeof renderer !== "object") {
    throw new TypeError("Flower renderer must be an object.");
  }

  for (const method of REQUIRED_METHODS) {
    if (typeof renderer[method] !== "function") {
      throw new TypeError(`Flower renderer is missing ${method}().`);
    }
  }

  if (
    !Number.isFinite(renderer.normalizationScale) ||
    renderer.normalizationScale <= 0
  ) {
    throw new RangeError("Flower renderer normalizationScale must be positive.");
  }

  if (renderer.maxFlowers < requiredCapacity) {
    throw new RangeError(
      `Flower renderer has ${renderer.maxFlowers} slots; ` +
        `${requiredCapacity} are required.`,
    );
  }

  return renderer;
}

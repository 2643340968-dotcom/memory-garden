export const MEMORY_IMAGE_PRELOAD_CONFIG = Object.freeze({
  INITIAL_IMAGE_LIMIT: 2,
});

export function getMemoryImageUrls(memories) {
  return [
    ...new Set(memories.map((memory) => memory?.image).filter(Boolean)),
  ];
}

export class MemoryImagePreloader {
  constructor({
    ImageCtor = window.Image,
    windowRef = window,
    config = MEMORY_IMAGE_PRELOAD_CONFIG,
  } = {}) {
    this.ImageCtor = ImageCtor;
    this.windowRef = windowRef;
    this.config = config;
    this.cache = new Map();
  }

  preload(url) {
    if (!url) {
      return Promise.resolve(false);
    }
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    const load = new Promise((resolve) => {
      const image = new this.ImageCtor();
      image.decoding = "async";
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
    this.cache.set(url, load);
    return load;
  }

  scheduleInitial(memories) {
    const urls = getMemoryImageUrls(memories).slice(
      0,
      this.config.INITIAL_IMAGE_LIMIT,
    );
    const warm = () => urls.forEach((url) => void this.preload(url));

    if (typeof this.windowRef.requestIdleCallback === "function") {
      this.windowRef.requestIdleCallback(warm, { timeout: 1800 });
    } else {
      this.windowRef.setTimeout(warm, 450);
    }
    return urls;
  }
}

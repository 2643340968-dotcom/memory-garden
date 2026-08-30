export function createSeededRandom(seed = 0x6d2b79f5) {
  let state = seed >>> 0;

  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(random, min, max) {
  return min + (max - min) * random();
}

export function randomIntInclusive(random, min, max) {
  return Math.floor(randomRange(random, min, max + 1));
}


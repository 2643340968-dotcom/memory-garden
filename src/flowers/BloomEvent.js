export class BloomEvent {
  constructor({
    anchorPosition,
    startTime,
    duration,
    radius,
    flowerCount,
    firstFlowerIndex,
    flowerIndices,
    randomSeed,
    lobeCentersScreen,
    memoryId = null,
  }) {
    this.anchorPosition = anchorPosition.clone();
    this.startTime = startTime;
    this.duration = duration;
    this.radius = radius;
    this.flowerCount = flowerCount;
    this.firstFlowerIndex = firstFlowerIndex;
    this.flowerIndices = new Uint32Array(flowerIndices);
    this.randomSeed = randomSeed;
    this.lobeCentersScreen = lobeCentersScreen;
    this.memoryId = memoryId;
  }
}

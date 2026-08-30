export class BloomEvent {
  constructor({
    anchorPosition,
    startTime,
    duration,
    radius,
    flowerCount,
    firstFlowerIndex,
    randomSeed,
    lobeCentersScreen,
  }) {
    this.anchorPosition = anchorPosition.clone();
    this.startTime = startTime;
    this.duration = duration;
    this.radius = radius;
    this.flowerCount = flowerCount;
    this.firstFlowerIndex = firstFlowerIndex;
    this.randomSeed = randomSeed;
    this.lobeCentersScreen = lobeCentersScreen;
  }
}

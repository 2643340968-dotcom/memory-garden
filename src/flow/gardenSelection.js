// Separate the large, dated flowers from the smaller notes and archive fragments.
// Each ring starts where the last selection ended, even across a return visit.
const eventLimit = 3;
const memoryLimit = 6;

function advanceRing(cards, count) {
  if (cards.length > count) cards.push(...cards.splice(0, count));
}

export class GardenSelection {
  constructor(events, collection) {
    this.events = events.map(record => record.id);
    const texts = [], images = [], voices = [];
    for (const record of collection.memories) {
      if (record.label === "writing-prompt") continue;
      if (collection.featuredLabels[record.id] && !/-(record|position)$/.test(record.id)) continue;
      const group = record.image ? images : record.audio ? voices : texts;
      group.push(record.id);
    }
    this.memories = [];
    for (let i = 0; i < Math.max(texts.length, images.length, voices.length); i++) {
      for (const group of [texts, images, voices]) {
        if (i < group.length) this.memories.push(group[i]);
      }
    }
  }

  get featured() { return this.events.slice(0, eventLimit); }
  get regular() { return this.memories.slice(0, memoryLimit); }
  get hasMore() { return this.events.length > eventLimit || this.memories.length > memoryLimit; }

  advance() {
    advanceRing(this.events, eventLimit);
    advanceRing(this.memories, memoryLimit);
  }

  includeVisitor(id) {
    this.memories.unshift(id);
  }
}

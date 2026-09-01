# Memory asset intake

Only place content here after its provenance and public-use permission have been checked.

- `images/`: verified photographs or archival images bound to one memory entry.
- `audio/`: verified voice excerpts bound to the same memory entry as their text/image.
- `bgm/`: an approved ambient bed. Configure its document-relative URL in `src/audio/AudioConfig.js`.

Prefer stable names that share the memory ID, for example `memory_001.jpg` and `memory_001.mp3`. The pairing is declared in `src/data/memoryPool.js`; filenames alone never create a relationship.

Each verified entry should include concise display metadata plus internal provenance fields:

```js
createMemoryItem({
  id: "memory_001",
  image: "./assets/memories/images/memory_001.jpg",
  caption: "Provided, verified caption",
  date: "Provided date",
  location: "Provided location",
  source: "Short display source",
  sourceUrl: "Full source URL",
  audio: "./assets/memories/audio/memory_001.mp3",
  audioCaption: "Short display audio label",
  audioSource: "Audio archive or rights holder",
  audioSourceUrl: "Full audio source URL",
  verified: true,
  isPrototype: false,
});
```

Do not infer testimony, quotations, dates, captions, archive names, or recording identity from a filename. Prototype entries must keep `verified: false` and `isPrototype: true`.

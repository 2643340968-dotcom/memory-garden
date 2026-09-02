# Memory asset intake

This folder contains deploy-safe derivatives or copies of media supplied by the project owner. Provenance and public-use permission still need to be recorded separately before the material is treated as verified archive content.

- `images/`: 21 optimized independent image derivatives (`nanjing-memory-283.jpg` through `nanjing-memory-303.jpg`).
- `audio/`: 10 independent source copies (`archive-voice-01.mp3` through `archive-voice-10.mp3`); these are preserved and are not used directly at runtime.
- `audio-normalized/`: non-destructive runtime derivatives normalized toward `-18 LUFS` with a `-1.5 dBTP` ceiling, plus `loudness-report.json` with before/after measurements and hashes.
- `bgm/`: the separate ambient bed at `bgm.mp3`, configured with a document-relative URL in `src/audio/AudioConfig.js`.

The runtime records for the supplied image and audio sets use `verified: false`, `isPrototype: false`, and `relationship: "independent"`. Their captions, dates, locations, speakers, and sources remain empty until verified metadata is supplied. Neutral sequence labels are identifiers only; they do not imply a relationship between files.

Images, audio, and text are independent by default. Similar filenames, dates, subjects, or locations do not create a relationship. Never combine them in one card unless the relationship itself has been verified.

## Independent image example

```js
createMemoryItem({
  id: "image_001",
  kind: MEMORY_KINDS.IMAGE_ARCHIVE,
  image: "./assets/memories/images/image_001.jpg",
  caption: "Provided, verified caption",
  date: "Provided date",
  location: "Provided location",
  source: "Image archive or rights holder",
  sourceUrl: "Full image source URL",
  verified: true,
  isPrototype: false,
  relationship: MEMORY_RELATIONSHIPS.INDEPENDENT,
});
```

## Independent audio example

```js
createMemoryItem({
  id: "voice_001",
  kind: MEMORY_KINDS.AUDIO_ARCHIVE,
  audio: "./assets/memories/audio-normalized/voice_001.mp3",
  audioCaption: "Short archive-voice label",
  date: "Provided date",
  location: "Provided location",
  audioSource: "Audio archive or rights holder",
  audioSourceUrl: "Full audio source URL",
  verified: true,
  isPrototype: false,
  relationship: MEMORY_RELATIONSHIPS.INDEPENDENT,
});
```

## Verified pair example

Use a paired record only when the media relationship is explicitly verified. This requires `PAIRED_MEMORY`, `verified: true`, `isPrototype: false`, and `relationship: "verified-pair"`.

```js
createMemoryItem({
  id: "pair_001",
  kind: MEMORY_KINDS.PAIRED_MEMORY,
  image: "./assets/memories/images/pair_001.jpg",
  audio: "./assets/memories/audio-normalized/pair_001.mp3",
  caption: "Verified shared context",
  source: "Image source",
  audioSource: "Audio source",
  verified: true,
  isPrototype: false,
  relationship: MEMORY_RELATIONSHIPS.VERIFIED_PAIR,
});
```

Do not infer testimony, quotations, dates, captions, archive names, speaker identity, or media relationships from filenames. Prototype entries must keep `verified: false` and `isPrototype: true`.

## Loudness workflow

Keep every incoming source in `audio/`. Generate or refresh deployable derivatives with:

```powershell
.\scripts\normalize-archive-audio.ps1 -FfmpegPath "C:\path\to\ffmpeg.exe"
```

The script uses two-pass `loudnorm`, never writes over `audio/`, strips copied metadata from the derivative, and records source/output SHA-256 hashes. Review `audio-normalized/loudness-report.json` before publishing new files. Loudness normalization is the primary consistency layer; the runtime voice limiter is only a final safety guard.

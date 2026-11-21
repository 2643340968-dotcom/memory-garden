# PROJECT

记忆花园 / Memory Garden

This repository is an interactive Three.js exhibition prototype about memory and the Zijincao flower. The current source of truth is the Vite project in this directory. Read this file and `README.md` before changing code.

## TECH STACK

- Vite 8
- Vanilla JavaScript (ES modules)
- Three.js 0.185.1
- CSS, with no component framework
- Node.js 20.19+ or 22.12+

## CURRENT WORKING STATE

- `/png.html` is the current main demo.
- `/model.html` is a retained legacy GLB demo, but it is no longer an active development or routine QA target.
- The project root redirects to `./png.html`.
- The automated suite has 52 tests, including visitor media, bidirectional zoom, atlas pack integrity and multiscale coverage for 85 sites, bilingual flowers and source records, per-place collections, and the Jiangdongmen bloom. Flow Atlas coverage includes its eighteen overview marks, three geographic stops, wheel gesture tails, unfolding cover flowers, staggered heart-to-edge ripples and contact-dependent pigment diffusion, single-language chart labels, the reversible cover, camera registration and velocity, full coverage on fast camera reversals, pale palettes, and overlapping outline ripples.
- Both Vite entry points return successfully and have been checked in a browser without console errors.
- The public `MEMORIES` count is the number of BloomEvents. Actual PNG instance counts remain available through runtime/debug state.

## ENTRY POINTS

- `/png.html` → `src/png-main.js` → national atlas, then a lazy-loaded PNG garden with the selected site's collection.
- `/flow.html` → `src/flow/main.js` → an independently styled pale vector atlas and top-down garden. This entry shares the place catalogue, vector chart cache and memory intake. Its title cards, water fronts, camera, garden marks and page-local visit state belong to the new edition.
- Opening the bare Flow URL presents the title and a one-sentence introduction in the active language above two beds of top-down gradient flowers. The left bed opens first and the right follows. Successive fronts travel from each flower’s heart across its petals. When two flowers wet the same area, their colour slowly pools, spreads and fades. The illustration rests on a fully open frame with reduced motion and stops when the map is visible. A short scroll or swipe zooms into the still national map and folds the toolbar to one centered grip. Tap or pull the grip to reveal its controls. Eighteen circular marks then appear. Five open the original city collections and thirteen show geographic names. Random, short-lived rings animate on the national dots. Scroll down over a destination to move one stop from country to city to place, or scroll up to retreat. Pinch and keyboard navigation use the same stops. Clicking a numbered group lists its places. Entering a garden requires explicit selection at the place. `#atlas` and deeper links open their geographic destinations directly. The circular home mark reopens the cover.
- `src/flow/FlowBasemap.js` draws geographic features on the same warm paper in overview, navigation and detailed views. The map uses pale water, vegetation and building fills. Hover and focus trace thin grey-blue ripples. The garden and its arrival use their own coloured water effect.
- `/model.html` → `src/model-main.js` → preserved GLB flower version.
- `/` → `./png.html` → national atlas.

Local URLs:

- `http://127.0.0.1:5173/memory-garden/png.html`
- `http://127.0.0.1:5173/memory-garden/model.html`

GitHub Pages production is configured as a project site named `memory-garden` with Vite base `/memory-garden/`. `index.html` redirects relatively to `./png.html`, and `.github/workflows/deploy.yml` builds and deploys `dist` from `main` using the official Pages actions.

## CURRENT VISUAL DIRECTION

- The national atlas uses light warm paper, sage relief and blue-green water. Ivory inner highlights and a place-tinted halo tie the map, flower notes and controls to the garden glass. The Jiangdongmen garden keeps its dark violet / plum-black atmosphere. Other gardens pick up their place's ink.
- The basemap and hover lens share a vector cache under `public/assets/atlas-vectors/`. An atlas worker paints device-resolution views while the camera moves the previous georeferenced frame. Project pins and motif labels reserve space ahead of street names. Chinese display type uses the bundled Noto Serif SC subset. The garden return and secondary controls use text and rules. The writing card retains three visible attachment buttons with native previews.
- Soft lavender Zijincao PNG flowers.
- Calm, mysterious, exhibition-like presentation.
- Procedural grass fading irregularly into the distance.
- The atlas is titled Site of Memory / 记忆之场. Entering a garden shows its representative flower, the bilingual Memory Garden / 记忆花园 title in the active language and the selected city and place, then fades into the field. The presentation is skippable and reduced motion shows a still title. In the field the header carries the location. On the atlas, hover or keyboard focus draws the flower pin gently towards the reading centre and reveals its stippled botanical specimen with a bilingual selection note. A narrow band of warm light picks out a few grains and the lens rim. Only the small illustration canvas animates when the camera is still.
- The upper air starts empty. Sparse, incomplete particle-flower fragments are released only by BloomEvent growth, Memory Echo appearance, or BloomPatch decay; they rise, disperse, and fade instead of behaving as ambient decoration.
- Memory UI uses translucent dark-violet frosted glass, pale-lavender text, a subtle lavender border, and restrained glow. Echoes can be compact text cards, slightly wider archival-image cards, or a smaller independent archive-voice indicator.
- Passive PNG garden UI is non-selectable so planting drags cannot highlight the title or HUD. Inputs, textareas, buttons, and editable content explicitly retain normal text selection.
- Avoid cyberpunk neon, bright blue/cyan accents, heavy app-style cards, and bright daytime botanical styling.
- Do not change the Three.js scene merely to adjust the memory UI.

## CURRENT INTERACTION FLOW

1. The visitor enters the national atlas at `/png.html`.
2. Country, city and place use one pannable, zoomable map. Five flower pins open Nanjing (21 sites), Beijing (22), Dunhuang (8), Chengdu (18) and Quanzhou (16). Nearby places share a numbered flower until expanded. Each geographic level has an interruptible camera landing with free wheel, button and pinch zoom between levels. Crossing a level updates the route, breadcrumb, title, markers and status. Hover or keyboard focus opens a flower note and temporarily eases the map towards the pin; leaving restores the resting camera. On touch, selecting a city or place shows its flower. A selected place has an entry link beside its introduction.
3. Entering any site loads the PNG field. Three clusters carry two local records and either a writing prompt, a prototype memory at Jiangdongmen or that site's latest visitor memory. The 80 added locations each have an original bilingual site note and a geographic record.
4. Visitors can tap an existing cluster to read its memory, drag to grow more clusters or focus the canvas and press Enter to discover another memory.
5. The writing dialog locks planting while open. All 85 sites accept text, one visitor image, audio or video file, or a file with a caption in the same card. Each site keeps its own drafts and submissions. The card previews files and reopens saved entries under Your memories here. Jiangdongmen grows a flower and reveals YOUR MEMORY on submission. The other sites confirm that the memory was saved for the current visit.
6. The garden starts silent. Explicit sound activation or a valid submission can unlock Web Audio.
7. Historical and public editorial summaries have named sources and slightly larger flowers in the same field. Prototype and visitor texts have distinct labels.
8. Returning to the atlas restores its location and zoom, stops the WebGL loop and silences the garden. A return visit keeps the page-local collection; a reload clears visitor submissions.
9. Dragging creates irregular, clustered BloomEvent patches rather than a linear flower trail.
10. Each BloomEvent also becomes one BloomPatch. Every flower receives a stable-slot point cloud sampled from the matching PNG alpha silhouette and source colors. The points gather from the flower roots into a persistent particulate flower body; the PNG card remains only a very faint continuity layer.
11. Cursor proximity within a soft world-space radius refreshes patch attention. Unattended attention decays after a guaranteed visible lifetime.
12. An unattended patch dims and settles while the same petal/edge point slots fragment softly upward/outward, edge-first, and then release with the flower slots for reuse.
13. Bloom growth, Memory Echo appearance, and BloomPatch decay each emit a small transient point-fragment event from the related flower world position. No fragments exist before the first BloomEvent.
14. Each pointer-down/up gesture starts a separate memory session. Short, medium, and long gestures reveal approximately `2–3`, `4–5`, and `5–7` staggered visual Memory Echo cards as BloomEvents accumulate.
15. Visual Echo cards retain BloomEvent-derived projection influence but scatter across the upper `17%–64%` of the viewport using low-discrepancy candidates, collision scoring, and `pointer-events: none` so the lower garden remains visible. Desktop permits six simultaneous visual cards; responsive caps reduce this to four at `≤1100px` and two at `≤520px`.
16. `TEXT_MEMORY`, `IMAGE_ARCHIVE`, and `AUDIO_ARCHIVE` remain independent fragments; each keeps its own source and never borrows media from another selected item. Text and image use a dedicated `1:1` shuffle-bag with active/recent ID protection. Within TEXT, the four prototype memories and two sourced editorial summaries share the built-in portion. Built-in records and page-local visitor submissions use an approximate `70% / 30%` source mix. Archive audio has a separate, unchanged low-frequency cadence, a maximum of one opportunity per gesture and one active voice; a busy voice drops the opportunity rather than queueing or interrupting. Only a verified `PAIRED_MEMORY` with `relationship: "verified-pair"` may combine archive media. A `VISITOR_MEDIA` submission keeps the visitor’s own file and optional words together. It participates in the visitor share of visual echoes. Opening the full card provides manual playback.
17. The top-left sound toggle controls the complete mix. Its small BGM-only slider persists the current-session level and does not alter archive voice gain. `RESET FIELD` clears flowers, BloomEvents, BloomPatches, particles, transient fragments, pending/visible memory cards, gesture state, and current voice playback. It does not reopen the entry modal.
18. A full reload restores the URL location and clears page-local submitted memories.
19. Language switching never translates or rewrites visitor input, supplied archive media, or unverified metadata. The four generic built-in prototype memories have explicit reviewed Chinese counterparts and visible cards update in place when the language changes.

## ARCHITECTURE

```text
MouseInput (future: HandInput)
  → PointerController
  → GroundRaycaster
  → FlowerSpawner
  → FlowerSystem
  → BloomEvent
  → FlowerRenderer interface
      ├─ PNGFlowerRenderer (main)
      └─ ModelFlowerRenderer (preserved)

BloomEvent subscription
  → BloomPatchSystem
  → cursor-ground attention field
  → PNG-alpha flower sample library
  → primary stable-slot petal / center points
  → flower-matrix and patch-state data textures
  → analytic gather / attention / breakup in the vertex shader
  → high-threshold full-scene HDR bloom on PNG only
  → patch-level matrix dim / settle
  → renderer slot release / reuse

BloomEvent subscription
  → MemoryExperience
  → world position projected through camera
  → collision-aware Memory Echo DOM card

Sound toggle or memory submission
  → AudioManager unlock
  → looping BGM bus
  → one reusable archive-voice channel
  → BGM duck / restore during archive voice
```

Shared runtime setup lives in `src/app/createFlowerFieldApp.js`. Page-specific renderer and scene configuration are supplied by the entry modules, so the pages have independent runtime state.

## IMPORTANT MODULES

- `src/app/createFlowerFieldApp.js`: shared scene/runtime creation, input gate, reset, counter mode, animation loop, debug datasets.
- `src/config.js`: shared/model defaults and the global flower capacity.
- `src/png-main.js` handles atlas navigation and garden loading. `src/atlas/` owns the map and morphing flower studies. `src/atlas/identities.js` defines the location inks, and `src/atlas/markerLayout.js` groups nearby pins. `src/data/placeFlowers.js` selects a flower and gives a bilingual curatorial note for every location. `scripts/build-flower-studies.py` draws the botanical plates and bakes their point slots. `src/data/atlasCatalogue.js` holds the 80 additional coordinates, bilingual summaries and geographic source IDs. `src/png-garden.js` mounts the Three.js field, memory experience and audio diagnostics. `src/data/jiangdongmen.js`, `src/data/placeGardens.js` and `src/data/placeRecords.js` supply the independent collections.
- `src/i18n/LanguageController.js`: PNG-only English/Chinese copy registry, safe parameter interpolation, static DOM localization, reviewed translations for the four generic built-in prototype memories, language subscriptions, and persisted top-right switch state. English remains the default when no preference exists.
- `src/model-main.js`: preserved GLB entry.
- `.github/workflows/deploy.yml`: GitHub Pages build/deploy workflow using Node 22, `npm ci`, Vite build, Pages artifact upload, and the `github-pages` environment.
- `src/audio/AudioConfig.js`: centralized normalized-BGM URL, BGM user range/default, relative ducking, archive gain/envelope, master limiter/output headroom, card-lifetime, master fade, and visibility fade tuning.
- `src/audio/AudioManager.js`: PNG-only Web Audio owner. Attaches one `AudioListener` to the camera, caches `AudioLoader` buffers, owns one looping BGM channel and one reusable voice channel, persists the BGM-only slider in `sessionStorage`, schedules the archive voice envelope and relative ducking, routes the final mix through one master safety compressor plus output-headroom gain, handles mute/visibility, and exposes diagnostics. It does not generate bloom, growth, or card cues.
- `src/memory/MemoryExperience.js`: centered entry flow, gesture sessions, memory triggers, automatic first bloom, upper-band card projection, collision avoidance, transient memory-fragment trigger, per-selected-record image/audio warmup, optional voice playback/lifetime coordination, viewport clamping, reset cleanup.
- `src/memory/MemoryCardRenderer.js`: type-aware DOM renderer and pure view-model builder for compact text, archival-image, the smaller independent archive-voice indicator, verified pairs, concise source metadata, duration display, and graceful missing-image/audio states.
- `src/memory/VisitorMemoryCard.js` handles file selection, native previews and reading saved visitor memories in the same dialog. Temporary blob URLs are revoked on rejection, replacement or removal. A submitted URL stays valid until page unload.
- `src/memory/MemoryAssetPreloader.js`: small non-blocking image cache. It warms at most two prototype images during idle time and preloads only the selected memory image before presentation.
- `src/data/memoryPool.js`: four-mode archive schema (`TEXT_MEMORY`, `IMAGE_ARCHIVE`, `AUDIO_ARCHIVE`, `PAIRED_MEMORY`) with explicit `independent | verified-pair` relationships, internal `verified`/`isPrototype` safety flags, a dedicated visual `1:1` text/image shuffle-bag, active/recent item exclusion, and a separate audio selector. It contains 21 independent supplied image records, 10 independent normalized audio records, four anonymous English prototype text memories restored from repository commit `471e063`, and page-local `sessionMemories`. The first submitted memory is presented directly as `YOUR MEMORY`; later TEXT selections use an approximate `70%` built-in / `30%` visitor mix and fall back across sources to avoid repeating the most recent text. The restored copy remains explicitly generic prototype material and is not presented as survivor testimony or historical quotation. Independent image/audio/text records cannot contain each other's media; only a verified pair may combine archive media. The supplied media records intentionally omit unverified captions, speakers, dates, locations, and sources.
- `src/flowers/BloomEvent.js`: BloomEvent descriptor, including optional `memoryId`.
- `src/flowers/BloomPatchConfig.js`: centralized attention, lifetime, decay, particle, and glow tuning.
- `src/flowers/BloomPatchSystem.js`: reusable patch entities and `growing → alive → decaying → dead` lifecycle.
- `src/flowers/FlowerSystem.js`: clustered patch creation, growth data, matrices, BloomEvent listeners, reset, capacity.
- `src/flowers/FlowerSpawner.js`: distance/cooldown sampling along the pointer path.
- `src/flowers/FlowerAnimation.js`: bloom easing.
- `src/flowers/renderers/PNGFlowerRenderer.js`: five texture batches, bottom-anchored card geometry, camera-facing instancing, matrix access for attached points, and the subdued 11%-maximum continuity card.
- `src/flowers/renderers/PNGFlowerParticleSampler.js`: one precomputed alpha/color sample library per PNG variant, with petal-edge weighting and flower-center detection.
- `src/effects/BloomParticleSystem.js`: the PNG flower body's primary fixed-capacity stable-slot `THREE.Points` renderer. Immutable flower samples are uploaded once; flower matrices and patch state use compact float data textures, while gather, attention drift, center light, and edge-led breakup are evaluated analytically in the vertex shader. The patch aura is distributed across flower-center contributors rather than drawn as a large glow disc.
- `src/effects/AirborneFlowerSystem.js`: PNG-only event-driven flower-fragment pool. It reuses the five cached PNG alpha/color libraries, starts with zero visible points, and writes sparse incomplete silhouettes only for `bloom`, `memory`, and `decay` events. One 512-slot `THREE.Points` draw uses stable generation-bearing ring slots and analytic lifetime motion; it remains separate from the main 262,144-slot flower-body pool.
- `src/effects/PNGBloomPipeline.js`: PNG-only `EffectComposer` pipeline with a high-threshold `UnrealBloomPass` and `OutputPass`; includes an explicit bloom-off control and viewport/resource-budget diagnostics. The model page remains on the shared direct renderer.
- `src/flowers/renderers/PNGFlowerConfig.js`: PNG-only renderer and scene tuning.
- `src/flowers/renderers/ModelFlowerRenderer.js`: preserved GLB renderer.
- `src/scene/createGrass.js`: procedural InstancedMesh grass with patchy density and edge/distance falloff.
- `src/scene/createGround.js`, `createScene.js`, `createCamera.js`, `createLights.js`, `createRenderer.js`: shared scene factories with page-specific configuration.
- `src/input/MouseInput.js`: current input adapter and future fallback.
- `src/input/PointerController.js`: input-neutral normalized pointer state; future HandInput should target this API.
- `src/interaction/GroundRaycaster.js`: screen/NDC to ground-plane world positions.
- `src/styles.css`: both page themes plus the PNG-only modal and Memory Echo glass system.
- `tests/flower-capacity.test.mjs`: capacity, renderer, PNG-alpha sampling, analytic particle updates, stable-slot generations, bloom budget gates, model isolation, BloomEvent memory ID, patch lifecycle, memory-pool, and rhythm-config regression tests.

## ASSET PATHS

Required runtime assets are inside the repository:

- Main PNG variants:
  - `public/assets/flowers/png/zijincao_01.png`
  - `public/assets/flowers/png/zijincao_02.png`
  - `public/assets/flowers/png/zijincao_03.png`
  - `public/assets/flowers/png/zijincao_04.png`
  - `public/assets/flowers/png/zijincao_05.png`
- Preserved GLB: `public/assets/flowers/zijincao.glb`
- Memory runtime assets:
  - `public/assets/memories/images/nanjing-memory-283.jpg` through `nanjing-memory-303.jpg`
  - `public/assets/memories/audio/archive-voice-01.mp3` through `archive-voice-10.mp3`
  - `public/assets/memories/audio-normalized/archive-voice-01.mp3` through `archive-voice-10.mp3`, plus `loudness-report.json`
  - `public/assets/memories/bgm/bgm.mp3`
  - `public/assets/memories/bgm-normalized/bgm.mp3`, plus `loudness-report.json`
  - `public/assets/memories/README.md` documents independent asset intake, explicit verified pairing, provenance, and safety requirements.
- Additional source/reference assets: `图片素材/`, `音频素材/`, and `模型/`.
- Historical snapshot: `版本存档/原版-花田-20000容量-2026-08-30.zip`.

Do not delete either PNG or GLB asset set. `public/assets/flowers/png/zijincao-card.png` and `public/assets/flowers/zijincao-01.png` are retained supporting assets, but the five numbered PNG files above are the active variants.

## IMPORTANT CONFIGURATION

### Shared / model config: `src/config.js`

- `MAX_FLOWERS = 20000`
- `GROUND_SIZE = 32`
- `BLOOM_TRIGGER_DISTANCE = 0.9`
- `BLOOM_TRIGGER_COOLDOWN = 160ms`
- `BLOOM_RADIUS_MIN/MAX = 1 / 1.45`
- `FLOWERS_PER_BLOOM_MIN/MAX = 32 / 48` for the preserved model defaults
- `BLOOM_DURATION_MIN/MAX = 0.42 / 0.68s`
- `MAX_BLOOMS_PER_FRAME = 3`
- `FLOWER_MODEL_PATH = /assets/flowers/zijincao.glb`
- `SETTLED_SWAY_UPDATES_PER_FRAME = 2000`

### PNG config: `src/flowers/renderers/PNGFlowerConfig.js`

- `MAX_FLOWERS = 20000`
- `FLOWERS_PER_BLOOM_MIN/MAX = 22 / 34`
- `FLOWER_CARD_HEIGHT = 0.86`
- `FLOWER_SCALE_MIN/MAX = 0.72 / 1.12`
- `FLOWER_TINT = 0xececf5`, `FLOWER_OPACITY = 0.96`
- `GRASS_COUNT = 7600`
- `GRASS_FIELD_SIZE = 44`, center Z `-4`
- `GRASS_DENSITY_VARIATION = 0.42`
- Edge fade width `5`, edge jitter `2.4`
- Distance fade Z `-8 → -24`, minimum scale `0.12`
- `GROUND_VISUAL_SIZE = 52`; the interaction raycast remains within shared size `32`
- Fog `0x2b2335`, near `9.5`, far `31`
- Exposure `1.04`
- PNG-only full-scene HDR bloom is active through `PNGBloomPipeline`; the model entry still uses direct rendering.

### Event-driven flower fragments: `src/effects/AirborneFlowerSystem.js`

- One fixed-capacity `THREE.Points` draw with `512` stable ring slots and zero per-particle CPU updates per frame
- Initial active particle and fragment counts are both `0`; the draw remains hidden until the first event
- Triggers: BloomEvent growth emits `1` fragment, Memory Echo appearance emits `1`, and BloomPatch decay emits `2`
- Bloom fragments use `13–18` points for `3.4–4.7s`; memory fragments use `17–24` for `4.1–5.6s`; decay fragments use `15–22` per fragment for `4.5–6.2s`
- Samples reuse the active PNG alpha/color libraries, focus on partial upper-blossom silhouettes, and carry a stable generation whenever a ring slot is reused
- Motion is analytic from immutable origin/velocity/lifetime data: gentle world-up rise, limited camera-plane curve, gradual dispersion, and age-based fade
- Normal alpha blending, depth test on, depth write off; the points enter the existing PNG HDR bloom path without owning a second post stack
- Pool pressure overwrites the oldest presentation-only slots; Reset invalidates every active slot and returns all event counters to zero
- Vite production base is `/memory-garden/`; public PNG and GLB asset URLs are document-relative so both MPA entries resolve inside the GitHub Pages project path.

### Memory UI and rhythm: `src/memory/MemoryExperience.js`

- `MAX_VISUAL_MEMORIES_PER_GESTURE = 7`; target short/medium/long gesture yield is approximately `2–3 / 4–5 / 5–7`
- Maximum active visual cards are `6` desktop, `4` at `≤1100px`, and `2` at `≤520px`; maximum active audio cards remain `1`
- Visual echoes start on the first BloomEvent, advance through centralized activity thresholds, and add at most one card per BloomEvent
- Visual reveal delay `180ms`, randomized stagger `280–650ms`, visible duration `4400–6600ms`, fade `700ms`, enter `480ms`
- Text-card width `270px`; image-card width `286px`; audio-only indicator width `176px`; viewport margin `30px`; acceptable overlap target `0.02`
- Visual-card top band starts at `17%`, tops out at `54%`, and has a `64%` card-bottom ceiling, with `156px` title clearance, `24%` BloomEvent projection influence, `±34px` stable jitter, and `128` low-discrepancy candidate placements
- Modal exit `850ms`
- Entry layout uses `place-items: center` on desktop and mobile. The large input panel remains geometrically centered; only the post-bloom Memory Echo cards use the upper-screen band.
- Text and image presentations use a dedicated `1:1` shuffle-bag with active and one-item recent-ID exclusion. Within TEXT, restored built-ins and visitor submissions use an approximate `70% / 30%` source mix. Archive audio remains independently scheduled at the previous first/`2–3` BloomEvent or `1.75`-world-unit cadence, with at most one opportunity per gesture; a busy voice drops that opportunity and is never queued or replaced.
- Prototype images warm non-blockingly during browser idle time with an initial limit of `2`; only the selected memory image/audio may warm when a card is queued.

### Language: `src/i18n/LanguageController.js`

- Supported UI languages are `en` and `zh-CN`; English is the first-visit default.
- The top-right button shows the destination language (`中文` while English is active, `EN` while Chinese is active) and remains usable while the entry modal is open.
- The preference persists in `localStorage` under `memory-garden-language-v1`; `<html lang>`, the document title, metadata, ARIA labels, placeholder text, status text, sound controls, HUD, modal, and Memory Echo labels update together.
- Existing Memory Echo cards update without changing their lifetime, placement, image, audio playback, or source data. Supplied visitor text always remains byte-for-byte as entered. The four generic prototype texts and two authored editorial summaries have explicit Chinese counterparts.

### Audio: `src/audio/AudioConfig.js`

- Initial page state is silent. A valid submission, the sound toggle or deliberate playback of a visitor file unlocks audio. Visitor playback uses the same master output and stops when its card closes.
- The source BGM measured about `-44.22 LUFS`, so runtime uses the separate `./assets/memories/bgm-normalized/bgm.mp3` derivative at `-25.27 LUFS / -9.91 dBTP`. Its original remains unchanged. The looping channel defaults to `0.52` within a `0–0.64` BGM-only slider range, uses a `5s` fade-in and `1.4s` fade-out, and stores the current-session setting under the v2 `sessionStorage` key.
- During archive voice, BGM ducks mildly to `72%` of the current user level and restores to that same level. One reusable voice channel uses gain `0.38`, a `480ms` start delay, a `650ms` fade-in, a `750ms` natural/stop fade-out, and a `650ms` replacement fade. Only one archive voice can load/play at once.
- Ten runtime voice derivatives in `audio-normalized/` target `-23 LUFS / -3 dBTP`; their two-pass measurements and hashes are committed in `loudness-report.json`. The source copies in `audio/` remain unchanged.
- The combined BGM/voice output passes through one Web Audio safety compressor (`-18 dB` threshold, `6 dB` knee, `4:1`, `10ms` attack, `220ms` release), followed by a `0.82` master output-headroom gain.
- Voice cards remain through the decoded clip duration plus a `900ms` tail, with a `24s` maximum card lifetime.
- Flower growth and Memory Echo appearance are acoustically silent. No prerecorded or procedural bloom/growth/card cue system remains.
- The sound toggle ramps the listener master gain instead of destroying playback state. Page visibility also fades the master gain down/up.
- Audio transitions use Web Audio `AudioParam` gain automation, not `AnimationMixer`; visual animation timing remains unchanged.
- The runtime database contains 10 independent audio-bearing records and 21 independent image records. Their public cards intentionally omit metadata that has not been independently verified.

### BloomPatch lifecycle and flower-body particles: `src/flowers/BloomPatchConfig.js`

- Attention radius `2.65` world units
- Attention gain `0.85/s`, unattended decay `0.075/s`, decay threshold `0.2`
- Recent-attention grace `3.2s`
- Minimum full patch lifetime `8s`; decay duration `4.6s`
- Alpha/color sample library `1024` points per PNG variant; every flower uses about `113` body samples plus one center point
- All flowers in every active patch use the stable particulate renderer; the PNG card has a maximum visibility of `0.11`
- Gather/hold/settle durations `0.95 / 0.32 / 0.72s`; birth opacity `0.96`; idle/attended opacity `0.76 / 0.94`
- PNG cards begin their faint per-instance alpha reveal at `0.58s` and fade in over `0.88s`
- Center glow intensity/radius `0.15 / 6.5`; distributed patch-aura intensity `0.006`
- Edge-led decay breakup `0.42`, with gentle surface drift `0.003`
- One reusable particle pool with `262144` stable slots; hidden when no effects are active. Stable particle attributes are written only at birth/decay/release, and the steady frame updates flower matrices plus one four-float state record per patch rather than every particle. Pool pressure reduces samples uniformly per patch rather than dropping a random subset of flowers
- PNG bloom strength/radius/threshold `0.11 / 0.12 / 1.04`

## IMPORTANT TECHNICAL RULES

- The PNG version is the current main demo. Do not replace it with GLB flowers.
- Preserve `/model.html` and `public/assets/flowers/zijincao.glb`.
- Preserve clustered, non-linear, lobe-based BloomEvent spawning. Do not revert to a continuous linear trail.
- Flower cards must remain bottom/root anchored.
- Preserve InstancedMesh batching and the 20,000 global instance capacity; the faint cards remain the matrix and slot continuity layer.
- Keep lifecycle patch-level. Flower-attached points are stable pooled slots owned by the BloomPatch, not per-particle objects or permanent per-flower allocations.
- Keep all PNG patch flowers particle-primary. Under pool pressure reduce samples uniformly across the whole patch; do not randomly omit complete flowers.
- Do not reintroduce a cursor trail, ambient dust layer, or large circular glow discs.
- Released PNG instance slots must remain reusable through the global and per-variant free lists.
- Do not duplicate shared scene and input architecture unless there is a strong technical reason.
- Keep `PointerController` input-neutral so a future MediaPipe HandInput can update the same normalized state.
- Keep `MouseInput` as the fallback after hand tracking is introduced.
- Memory Echo cards must remain visually tied to BloomEvent world positions and must not block input.
- Sample memory text must stay clearly generic/prototype content. Never invent survivor testimony or claim fictional text is a quotation.
- Language switching must not machine-translate visitor submissions, historical assets, captions, attribution, or unverified archive metadata.
- Do not commit `node_modules/`, `dist/`, `.vite/`, or log files. Do commit required binary assets.

## DEVELOPMENT AND VERIFICATION

```bash
npm install
npm test
npm run dev
npm run build
```

For changes to the Flow Atlas, verify `/flow.html` locally and on Pages, including overlapping hover tails, semantic zoom in both directions, voluntary site entry, optional title cards, mobile controls and per-site writing. Also check the existing `/png.html` experience. Its regression targets cover map navigation and return, browse-before-writing, the optional form input lock, English/Chinese switching before and after submission, stored-language reload, visitor-text preservation, automatic first bloom, short/medium/long visual-card rhythms, six-card desktop maximum, responsive caps, collision/viewport bounds, reset, and console errors. Keep the legacy model files in the repository, but do not spend routine modification or QA time on `/model.html` unless the user explicitly brings it back into scope.

After every completed modification round, commit the verified changes, push `main` to `origin`, wait for the GitHub Pages workflow to succeed, and verify the public `/memory-garden/png.html` URL still returns HTTP 200 with the new revision. The user expects the public URL to always show the newest completed version; do not stop after local verification.

## KNOWN LIMITATIONS

- Submitted memories are page-local only; reload clears them. There is no backend, database, login, or moderation layer.
- The supplied image and audio assets are integrated as independent records without invented captions, attribution, or pairing. Verified source metadata and public-use attribution remain a later content step.
- The current BGM is integrated as an independently supplied ambient asset; its provenance/public-use metadata still needs to be recorded by the content owner.
- MediaPipe/HandInput is not implemented yet.
- There is no real volumetric light or DOF. The PNG entry uses restrained high-threshold screen-space bloom; the patch aura comes from the combined HDR flower-center contributors, with no separate large circular glow sprite.
- Collision avoidance scores `128` low-discrepancy candidates against active cards and reserved UI. Responsive active-card caps keep narrow layouts viable, but it remains a lightweight DOM placement solver rather than a full constraint engine.
- The production build reports a non-fatal shared-chunk size advisory above 500 kB.
- `紫金草花田-离线版.html` is an older standalone artifact and is not the source of truth for the current PNG memory experience. Use the Vite URLs for current behavior unless the offline build script is deliberately updated and revalidated.
- Directly double-clicking `png.html` or `model.html` is not supported because the application uses Vite/ES modules and served asset URLs.

## CURRENT NEXT TASKS

1. Tune attention radius, lifetime, and particle density only from real exhibition QA; preserve the present cluster shapes.
2. Later replace primary mouse control with MediaPipe hand tracking and route its ground projection into the same attention field.
3. Preserve mouse mode as fallback.
4. Keep this stable PNG version recoverable with Git checkpoints before major refactors.

## DEVELOPMENT SKILLS

These are the exact relevant custom skill names available in the current Codex environment. A new Codex account may need to reinstall them:

- `frontend-design`
- `threejs-dev-setup`
- `threejs-scenes`
- `threejs-camera`
- `threejs-renderers`
- `threejs-objects`
- `threejs-math`
- `threejs-animation`
- `threejs-geometries`
- `threejs-materials`
- `threejs-textures`
- `threejs-loaders`
- `threejs-lights`
- `threejs-postprocessing`
- `threejs-particles-trails-and-effects`
- `threejs-bloom`

Installation sources previously used on this computer:

- `frontend-design`: `https://github.com/dobromirdikov/codex-frontend-design-skill/tree/main/skills/frontend-design`
- Three.js skills: `full-stack-skills/threejs-skills`
- Particle/effect and bloom skills: `linegel/threejs-complete-set-of-skill`

The bundled `browser:control-in-app-browser` skill is useful for visual QA but is supplied by the Codex Browser plugin rather than the custom Three.js skill repository.

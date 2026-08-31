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
- `/model.html` is the preserved GLB demo and must remain independently usable.
- `/` still opens the preserved model entry through `src/main.js`.
- The last verified automated suite has 15 passing tests.
- Both Vite entry points return successfully and have been checked in a browser without console errors.
- The public `MEMORIES` count is the number of BloomEvents. Actual PNG instance counts remain available through runtime/debug state.

## ENTRY POINTS

- `/png.html` → `src/png-main.js` → current PNG flower version with the complete memory interaction.
- `/model.html` → `src/model-main.js` → preserved GLB flower version.
- `/` → `src/main.js` → preserved GLB behavior.

Local URLs:

- `http://127.0.0.1:5173/memory-garden/png.html`
- `http://127.0.0.1:5173/memory-garden/model.html`

GitHub Pages production is configured as a project site named `memory-garden` with Vite base `/memory-garden/`. `index.html` redirects relatively to `./png.html`, and `.github/workflows/deploy.yml` builds and deploys `dist` from `main` using the official Pages actions.

## CURRENT VISUAL DIRECTION

- Dark violet / plum-black memory-garden atmosphere.
- Soft lavender Zijincao PNG flowers.
- Calm, mysterious, exhibition-like presentation.
- Procedural grass fading irregularly into the distance.
- Centered, restrained title: `INTERACTIVE MEMORY GARDEN / 记忆之场 / MEMORY BLOOMS`.
- Five soft detached-flower accents drift in the upper air on desktop; narrow screens show three. They are decorative PNG-crown sprites, not BloomEvent flowers.
- Memory UI uses translucent dark-violet frosted glass, pale-lavender text, a subtle lavender border, and restrained glow.
- Avoid cyberpunk neon, bright blue/cyan accents, heavy app-style cards, and bright daytime botanical styling.
- Do not change the Three.js scene merely to adjust the memory UI.

## CURRENT INTERACTION FLOW

1. The visitor enters `/png.html`.
2. A memory-entry modal appears over the visible garden.
3. The visitor writes a memory related to 南京大屠杀、江东门, or a personal connection to the place.
4. Planting remains disabled and the status reads `MOUSE INPUT · WAITING`.
5. Submission stores the text in the page-local `sessionMemories` array; there is no backend or persistence.
6. The modal fades and the submitted memory triggers one automatic BloomEvent near the lower center.
7. A `YOUR MEMORY` glass card appears beside that bloom.
8. Mouse planting becomes enabled and the status changes to `MOUSE INPUT · READY`.
9. Dragging creates irregular, clustered BloomEvent patches rather than a linear flower trail.
10. Each BloomEvent also becomes one BloomPatch. Every flower receives a stable-slot point cloud sampled from the matching PNG alpha silhouette and source colors. The points gather from the flower roots into a persistent particulate flower body; the PNG card remains only a very faint continuity layer.
11. Cursor proximity within a soft world-space radius refreshes patch attention. Unattended attention decays after a guaranteed visible lifetime.
12. An unattended patch dims and settles while the same petal/edge point slots fragment softly upward/outward, edge-first, and then release with the flower slots for reuse.
13. Each pointer-down/up gesture starts a separate memory session. A short, medium, or long gesture can reveal approximately 1, 2, or 3 Memory Echo cards.
14. Echo cards are projected from BloomEvent world positions, clamped to the viewport, collision-checked, and always use `pointer-events: none`.
15. `RESET FIELD` clears flowers, BloomEvents, BloomPatches, particles, pending/visible memory cards, and gesture state. It does not reopen the entry modal.
16. A full reload restarts the entry flow and clears page-local submitted memories.

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
```

Shared runtime setup lives in `src/app/createFlowerFieldApp.js`. Page-specific renderer and scene configuration are supplied by the entry modules, so the pages have independent runtime state.

## IMPORTANT MODULES

- `src/app/createFlowerFieldApp.js`: shared scene/runtime creation, input gate, reset, counter mode, animation loop, debug datasets.
- `src/config.js`: shared/model defaults and the global flower capacity.
- `src/png-main.js`: PNG entry, PNG scene config, disabled-before-submit input, memory experience mount.
- `src/model-main.js`: preserved GLB entry.
- `.github/workflows/deploy.yml`: GitHub Pages build/deploy workflow using Node 22, `npm ci`, Vite build, Pages artifact upload, and the `github-pages` environment.
- `src/memory/MemoryExperience.js`: entry flow, gesture sessions, memory triggers, automatic first bloom, projection, card queue, collision avoidance, viewport clamping, reset cleanup.
- `src/data/memoryPool.js`: generic prototype memories and in-memory `sessionMemories`; do not present prototype text as real survivor testimony or a historical quotation.
- `src/flowers/BloomEvent.js`: BloomEvent descriptor, including optional `memoryId`.
- `src/flowers/BloomPatchConfig.js`: centralized attention, lifetime, decay, particle, and glow tuning.
- `src/flowers/BloomPatchSystem.js`: reusable patch entities and `growing → alive → decaying → dead` lifecycle.
- `src/flowers/FlowerSystem.js`: clustered patch creation, growth data, matrices, BloomEvent listeners, reset, capacity.
- `src/flowers/FlowerSpawner.js`: distance/cooldown sampling along the pointer path.
- `src/flowers/FlowerAnimation.js`: bloom easing.
- `src/flowers/renderers/PNGFlowerRenderer.js`: five texture batches, bottom-anchored card geometry, camera-facing instancing, matrix access for attached points, and the subdued 11%-maximum continuity card.
- `src/flowers/renderers/PNGFlowerParticleSampler.js`: one precomputed alpha/color sample library per PNG variant, with petal-edge weighting and flower-center detection.
- `src/effects/BloomParticleSystem.js`: the PNG flower body's primary fixed-capacity stable-slot `THREE.Points` renderer. Immutable flower samples are uploaded once; flower matrices and patch state use compact float data textures, while gather, attention drift, center light, and edge-led breakup are evaluated analytically in the vertex shader. The patch aura is distributed across flower-center contributors rather than drawn as a large glow disc.
- `src/effects/AirborneFlowerSystem.js`: PNG-only upper-air composition accents. It crops detached flower crowns from the five already-loaded PNG textures, projects a sparse set of sprites from NDC into camera space, and applies very slow analytic drift/rotation. It is independent from BloomEvents and hidden down to three accents on narrow screens.
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
- Additional source/reference assets: `图片素材/` and `模型/`.
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

### Upper-air composition: `src/effects/AirborneFlowerSystem.js`

- `5` detached-flower accents on desktop; `3` remain on narrow screens
- Maximum opacity `0.20`, maximum drift speed `0.22`
- Maximum NDC drift `0.018 / 0.019`, maximum rotation amplitude `0.035`
- Uses cropped flower crowns from the active PNG textures; no new asset files and no BloomEvent or particle-pool participation
- Vite production base is `/memory-garden/`; public PNG and GLB asset URLs are document-relative so both MPA entries resolve inside the GitHub Pages project path.

### Memory UI and rhythm: `src/memory/MemoryExperience.js`

- `MAX_MEMORIES_PER_GESTURE = 3`
- `MAX_ACTIVE_MEMORY_CARDS = 3`
- First drag echo after `1` BloomEvent
- Later echoes every `2–3` BloomEvents or `1.75` world units
- Echo reveal delay `180ms`; minimum visual stagger `420ms`
- Visible duration `4200ms`; fade duration `700ms`; enter duration `480ms`
- Card width `330px`; viewport margin `30px`; acceptable overlap target `0.22`
- Modal exit `850ms`

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
- Do not commit `node_modules/`, `dist/`, `.vite/`, or log files. Do commit required binary assets.

## DEVELOPMENT AND VERIFICATION

```bash
npm install
npm test
npm run dev
npm run build
```

When visual or interaction behavior changes, verify both URLs in a browser and check console errors. At minimum test entry lock, submit transition, automatic first bloom, short/medium/long drag rhythms, three-card maximum, collision/viewport bounds, reset, and model-page regression.

## KNOWN LIMITATIONS

- Submitted memories are page-local only; reload clears them. There is no backend, database, login, or moderation layer.
- MediaPipe/HandInput is not implemented yet.
- There is no real volumetric light or DOF. The PNG entry uses restrained high-threshold screen-space bloom; the patch aura comes from the combined HDR flower-center contributors, with no separate large circular glow sprite.
- Collision avoidance uses four candidate placements and simple rectangle-overlap scoring, not a full layout solver. Extremely dense edge cases may still approach the `0.22` overlap threshold.
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

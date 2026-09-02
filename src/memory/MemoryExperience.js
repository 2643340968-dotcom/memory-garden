import * as THREE from "three";
import {
  createMemoryPool,
  isAudioPresentation,
  MEMORY_KINDS,
} from "../data/memoryPool.js";
import {
  AUDIO_CONFIG,
  getVoiceCardVisibleDuration,
} from "../audio/AudioConfig.js";
import {
  createMemoryCardElement,
  updateMemoryCardAudioDuration,
} from "./MemoryCardRenderer.js";
import { MemoryImagePreloader } from "./MemoryAssetPreloader.js";

export const MEMORY_UI_CONFIG = Object.freeze({
  MODAL_EXIT_DURATION: 850,
  MEMORY_CARD_ENTER_DURATION: 480,
  MEMORY_CARD_VISIBLE_DURATION: 4200,
  VISUAL_CARD_VISIBLE_DURATION_MIN: 4400,
  VISUAL_CARD_VISIBLE_DURATION_MAX: 6600,
  MEMORY_CARD_FADE_DURATION: 700,
  MEMORY_CARD_WIDTH: 270,
  MEMORY_IMAGE_CARD_WIDTH: 286,
  MEMORY_AUDIO_CARD_WIDTH: 176,
  MEMORY_CARD_EDGE_MARGIN: 30,
  MEMORY_CARD_MAX_OVERLAP: 0.02,
  VISUAL_CARD_TOP_MIN_RATIO: 0.17,
  VISUAL_CARD_TOP_MAX_RATIO: 0.54,
  VISUAL_CARD_BOTTOM_MAX_RATIO: 0.64,
  AUDIO_CARD_TOP_MIN_RATIO: 0.2,
  AUDIO_CARD_TOP_MAX_RATIO: 0.42,
  AUDIO_CARD_BOTTOM_MAX_RATIO: 0.58,
  MEMORY_CARD_TITLE_CLEARANCE: 156,
  MEMORY_CARD_WORLD_X_INFLUENCE: 0.24,
  MEMORY_CARD_WORLD_Y_INFLUENCE: 0.24,
  MEMORY_CARD_VERTICAL_LANE_GAP: 82,
  MEMORY_CARD_VERTICAL_JITTER: 34,
  MEMORY_CARD_SKY_ANCHORS: Object.freeze([0.16, 0.33, 0.5, 0.67, 0.84]),
  MEMORY_CARD_SKY_ANCHOR_JITTER: 0.045,
  MEMORY_CARD_PLACEMENT_CANDIDATES: 128,
  MAX_ACTIVE_VISUAL_MEMORY_CARDS: 6,
  MAX_ACTIVE_VISUAL_MEMORY_CARDS_TABLET: 4,
  MAX_ACTIVE_VISUAL_MEMORY_CARDS_MOBILE: 2,
  MAX_ACTIVE_AUDIO_MEMORY_CARDS: 1,
  MAX_VISUAL_MEMORIES_PER_GESTURE: 7,
  VISUAL_MEMORY_ACTIVITY_THRESHOLDS: Object.freeze([1, 2, 3, 5, 6, 8, 10]),
  VISUAL_MEMORY_DISTANCE_UNIT: 0.9,
  VISUAL_ECHO_REVEAL_DELAY: 180,
  VISUAL_ECHO_STAGGER_MIN: 280,
  VISUAL_ECHO_STAGGER_MAX: 650,
  AUDIO_CHECKS_PER_GESTURE: 3,
  FIRST_AUDIO_CHECK_BLOOMS_MIN: 1,
  FIRST_AUDIO_CHECK_BLOOMS_MAX: 1,
  AUDIO_CHECK_BLOOMS_MIN: 2,
  AUDIO_CHECK_BLOOMS_MAX: 3,
  AUDIO_CHECK_DISTANCE: 1.75,
  AUDIO_ECHO_REVEAL_DELAY: 180,
});

export function getMemoryEchoLabel(memory, bloomNumber) {
  if (memory?.kind === MEMORY_KINDS.AUDIO_ARCHIVE) {
    return "ARCHIVE VOICE";
  }
  if (memory?.kind === MEMORY_KINDS.IMAGE_ARCHIVE) {
    return `ARCHIVE IMAGE · ${bloomNumber}`;
  }
  if (memory?.kind === MEMORY_KINDS.PAIRED_MEMORY) {
    return `VERIFIED MEMORY · ${bloomNumber}`;
  }
  return `MEMORY · ${bloomNumber}`;
}

const wait = (duration) =>
  new Promise((resolve) => window.setTimeout(resolve, duration));

export function getMemoryCardUpperBand(
  viewportHeight,
  cardHeight,
  margin = MEMORY_UI_CONFIG.MEMORY_CARD_EDGE_MARGIN,
  audioCard = false,
) {
  const safeViewportHeight = Math.max(1, viewportHeight);
  const titleClearance = Math.min(
    MEMORY_UI_CONFIG.MEMORY_CARD_TITLE_CLEARANCE,
    safeViewportHeight * 0.24,
  );
  const topMin = Math.max(
    margin,
    safeViewportHeight *
      (audioCard
        ? MEMORY_UI_CONFIG.AUDIO_CARD_TOP_MIN_RATIO
        : MEMORY_UI_CONFIG.VISUAL_CARD_TOP_MIN_RATIO),
    titleClearance,
  );
  const viewportSafeMaximum = Math.max(
    margin,
    safeViewportHeight - cardHeight - margin,
  );
  const topMax = Math.max(
    topMin,
    Math.min(
      safeViewportHeight *
        (audioCard
          ? MEMORY_UI_CONFIG.AUDIO_CARD_TOP_MAX_RATIO
          : MEMORY_UI_CONFIG.VISUAL_CARD_TOP_MAX_RATIO),
      safeViewportHeight *
        (audioCard
          ? MEMORY_UI_CONFIG.AUDIO_CARD_BOTTOM_MAX_RATIO
          : MEMORY_UI_CONFIG.VISUAL_CARD_BOTTOM_MAX_RATIO) - cardHeight,
      viewportSafeMaximum,
    ),
  );
  return Object.freeze({ topMin, topMax });
}

export function getVisualMemoryAllowance(
  bloomEventCount,
  distanceTraveled,
  config = MEMORY_UI_CONFIG,
) {
  const blooms = Math.max(0, Number(bloomEventCount) || 0);
  if (blooms === 0) {
    return 0;
  }
  const distanceActivity =
    1 + Math.max(0, Number(distanceTraveled) || 0) /
      Math.max(0.001, config.VISUAL_MEMORY_DISTANCE_UNIT);
  const activity = Math.max(blooms, distanceActivity);
  return THREE.MathUtils.clamp(
    config.VISUAL_MEMORY_ACTIVITY_THRESHOLDS.filter(
      (threshold) => activity >= threshold,
    ).length,
    0,
    config.MAX_VISUAL_MEMORIES_PER_GESTURE,
  );
}

export function getMaxActiveVisualCards(
  viewportWidth,
  config = MEMORY_UI_CONFIG,
) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  if (width <= 520) {
    return config.MAX_ACTIVE_VISUAL_MEMORY_CARDS_MOBILE;
  }
  if (width <= 1100) {
    return config.MAX_ACTIVE_VISUAL_MEMORY_CARDS_TABLET;
  }
  return config.MAX_ACTIVE_VISUAL_MEMORY_CARDS;
}

export class MemoryExperience {
  constructor(app, { random = Math.random } = {}) {
    this.app = app;
    this.random = random;
    this.memoryPool = createMemoryPool();
    this.imagePreloader = new MemoryImagePreloader();
    this.overlay = document.querySelector("#memory-entry-overlay");
    this.form = document.querySelector("#memory-entry-form");
    this.textarea = document.querySelector("#memory-text");
    this.submitButton = document.querySelector("#memory-submit");
    this.cardLayer = document.querySelector("#memory-card-layer");
    this.resetButton = document.querySelector("#reset-button");
    this.activeCards = [];
    this.reservedMemoryIds = new Set();
    this.reservedAudioIds = new Set();
    this.cardQueue = Promise.resolve();
    this.cardGeneration = 0;
    this.pendingCardTimers = new Set();
    this.entryComplete = false;
    this.firstBloomMemoryId = null;
    this.projectedPosition = new THREE.Vector3();
    this.firstBloomPosition = new THREE.Vector3();
    this.dragSession = this.createInactiveDragSession();

    this.onInput = this.onInput.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onBloomCreated = this.onBloomCreated.bind(this);
    this.onReset = this.onReset.bind(this);
    this.onResize = this.onResize.bind(this);
    this.startDragMemorySession = this.startDragMemorySession.bind(this);
    this.endDragMemorySession = this.endDragMemorySession.bind(this);
  }

  start() {
    if (!this.overlay || !this.form || !this.textarea || !this.cardLayer) {
      throw new Error("The PNG memory interface is incomplete.");
    }

    this.app.setInputEnabled(false);
    document.documentElement.style.setProperty(
      "--memory-modal-exit-duration",
      `${MEMORY_UI_CONFIG.MODAL_EXIT_DURATION}ms`,
    );
    document.documentElement.style.setProperty(
      "--memory-card-enter-duration",
      `${MEMORY_UI_CONFIG.MEMORY_CARD_ENTER_DURATION}ms`,
    );
    document.documentElement.style.setProperty(
      "--memory-card-exit-duration",
      `${MEMORY_UI_CONFIG.MEMORY_CARD_FADE_DURATION}ms`,
    );
    document.documentElement.style.setProperty(
      "--memory-card-width",
      `${MEMORY_UI_CONFIG.MEMORY_CARD_WIDTH}px`,
    );
    document.documentElement.style.setProperty(
      "--memory-image-card-width",
      `${MEMORY_UI_CONFIG.MEMORY_IMAGE_CARD_WIDTH}px`,
    );
    document.documentElement.style.setProperty(
      "--memory-audio-card-width",
      `${MEMORY_UI_CONFIG.MEMORY_AUDIO_CARD_WIDTH}px`,
    );
    document.body.classList.add("memory-entry-active");
    this.textarea.addEventListener("input", this.onInput);
    this.form.addEventListener("submit", this.onSubmit);
    this.resetButton.addEventListener("click", this.onReset);
    this.app.renderer.domElement.addEventListener(
      "pointerdown",
      this.startDragMemorySession,
    );
    window.addEventListener("pointerup", this.endDragMemorySession);
    window.addEventListener("pointercancel", this.endDragMemorySession);
    window.addEventListener("blur", this.endDragMemorySession);
    window.addEventListener("resize", this.onResize);
    this.unsubscribeBloom = this.app.flowerSystem.onBloomCreated(
      this.onBloomCreated,
    );
    this.imagePreloader.scheduleInitial(this.memoryPool.prototypeMemories);
    window.requestAnimationFrame(() => this.textarea.focus());
    return this;
  }

  onInput() {
    this.submitButton.disabled = !this.textarea.value.trim();
  }

  async onSubmit(event) {
    event.preventDefault();
    const text = this.textarea.value.trim();
    if (!text || this.form.dataset.submitting === "true") {
      return;
    }

    void this.app.audioManager?.unlock();

    const memory = this.memoryPool.addSessionMemory(text);
    this.firstBloomMemoryId = memory.id;
    this.form.dataset.submitting = "true";
    this.submitButton.disabled = true;
    this.overlay.classList.add("is-submitting");
    await wait(180);
    document.body.classList.add("memory-entry-releasing");
    this.overlay.classList.add("is-leaving");
    await wait(MEMORY_UI_CONFIG.MODAL_EXIT_DURATION);

    this.overlay.hidden = true;
    this.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove(
      "memory-entry-active",
      "memory-entry-releasing",
    );
    this.entryComplete = true;
    this.triggerFirstMemoryBloom(memory);
    this.app.setInputEnabled(true);
  }

  triggerFirstMemoryBloom(memory) {
    const canvas = this.app.renderer.domElement;
    const width = Math.max(1, canvas.clientWidth || canvas.width);
    const height = Math.max(1, canvas.clientHeight || canvas.height);
    const targetRatios = [0.64, 0.58, 0.7];
    let hasGroundPoint = false;

    for (const verticalRatio of targetRatios) {
      hasGroundPoint = this.app.groundRaycaster.getGroundPointFromPixel(
        width * 0.52,
        height * verticalRatio,
        width,
        height,
        this.firstBloomPosition,
      );
      if (hasGroundPoint) {
        break;
      }
    }

    if (!hasGroundPoint) {
      this.firstBloomPosition.set(0, 0, -2);
    }

    this.app.flowerSystem.createBloom(
      this.firstBloomPosition,
      performance.now() * 0.001,
      { memoryId: memory.id },
    );
  }

  onBloomCreated(bloomEvent) {
    if (!this.entryComplete) {
      return;
    }

    if (bloomEvent.memoryId === this.firstBloomMemoryId) {
      const memory = this.memoryPool.getById(bloomEvent.memoryId);
      this.queueMemoryCard(memory, bloomEvent.anchorPosition, "YOUR MEMORY");
      return;
    }

    const session = this.dragSession;
    if (!session.active) {
      return;
    }

    session.bloomEvents += 1;
    session.bloomsSinceAudioCheck += 1;
    let segmentDistance = 0;
    if (session.lastBloomPosition) {
      segmentDistance = session.lastBloomPosition.distanceTo(
        bloomEvent.anchorPosition,
      );
      session.distanceTraveled += segmentDistance;
      session.distanceSinceAudioCheck += segmentDistance;
      session.lastBloomPosition.copy(bloomEvent.anchorPosition);
    } else {
      session.lastBloomPosition = bloomEvent.anchorPosition.clone();
    }

    this.maybeQueueVisualMemory(bloomEvent, session);
    this.maybeQueueArchiveVoice(bloomEvent, session);
  }

  maybeQueueVisualMemory(bloomEvent, session) {
    const visualAllowance = getVisualMemoryAllowance(
      session.bloomEvents,
      session.distanceTraveled,
    );
    if (
      session.visualMemoriesShown >= visualAllowance ||
      session.visualMemoriesShown >=
        MEMORY_UI_CONFIG.MAX_VISUAL_MEMORIES_PER_GESTURE
    ) {
      return;
    }

    const memory = this.memoryPool.selectVisualEcho(this.random, {
      excludeIds: this.reservedMemoryIds,
    });
    if (!memory) {
      return;
    }

    bloomEvent.memoryId = memory.id;
    session.visualMemoriesShown += 1;
    const now = performance.now();
    const bloomRevealTime =
      bloomEvent.startTime * 1000 + MEMORY_UI_CONFIG.VISUAL_ECHO_REVEAL_DELAY;
    const revealTime = Math.max(
      bloomRevealTime,
      session.nextVisualCardRevealAt,
    );
    session.nextVisualCardRevealAt =
      revealTime + this.randomInteger(
        MEMORY_UI_CONFIG.VISUAL_ECHO_STAGGER_MIN,
        MEMORY_UI_CONFIG.VISUAL_ECHO_STAGGER_MAX,
      );
    const bloomNumber = String(this.app.flowerSystem.blooms.length).padStart(
      3,
      "0",
    );
    this.queueMemoryCard(
      memory,
      bloomEvent.anchorPosition,
      getMemoryEchoLabel(memory, bloomNumber),
      Math.max(0, revealTime - now),
    );
  }

  maybeQueueArchiveVoice(bloomEvent, session) {
    if (
      session.audioOpportunityConsumed ||
      session.audioChecks >= MEMORY_UI_CONFIG.AUDIO_CHECKS_PER_GESTURE
    ) {
      return;
    }

    const reachedBloomTarget =
      session.bloomsSinceAudioCheck >= session.nextAudioBloomTarget;
    const reachedDistanceTarget =
      session.distanceSinceAudioCheck >= MEMORY_UI_CONFIG.AUDIO_CHECK_DISTANCE;
    if (!reachedBloomTarget && !reachedDistanceTarget) {
      return;
    }

    session.audioChecks += 1;
    session.bloomsSinceAudioCheck = 0;
    session.distanceSinceAudioCheck = 0;
    session.nextAudioBloomTarget = this.randomInteger(
      MEMORY_UI_CONFIG.AUDIO_CHECK_BLOOMS_MIN,
      MEMORY_UI_CONFIG.AUDIO_CHECK_BLOOMS_MAX,
    );
    if (session.audioChecks !== session.audioOpportunityCheck) {
      return;
    }

    session.audioOpportunityConsumed = true;
    if (
      this.app.audioManager?.archiveVoiceBusy ||
      this.reservedAudioIds.size > 0
    ) {
      return;
    }

    const memory = this.memoryPool.selectArchiveVoice(this.random, {
      excludeIds: this.reservedMemoryIds,
    });
    if (!memory) {
      return;
    }

    const bloomNumber = String(this.app.flowerSystem.blooms.length).padStart(
      3,
      "0",
    );
    const revealTime = Math.max(
      performance.now(),
      bloomEvent.startTime * 1000 + MEMORY_UI_CONFIG.AUDIO_ECHO_REVEAL_DELAY,
    );
    this.queueMemoryCard(
      memory,
      bloomEvent.anchorPosition,
      getMemoryEchoLabel(memory, bloomNumber),
      Math.max(0, revealTime - performance.now()),
    );
  }

  createInactiveDragSession() {
    return {
      active: false,
      pointerId: null,
      visualMemoriesShown: 0,
      bloomEvents: 0,
      distanceTraveled: 0,
      bloomsSinceAudioCheck: 0,
      distanceSinceAudioCheck: 0,
      lastBloomPosition: null,
      nextAudioBloomTarget: 1,
      audioChecks: 0,
      audioOpportunityCheck: 1,
      audioOpportunityConsumed: false,
      startedAt: 0,
      endedAt: 0,
      nextVisualCardRevealAt: 0,
    };
  }

  randomInteger(minimum, maximum) {
    const randomValue = THREE.MathUtils.clamp(this.random(), 0, 0.999999);
    return Math.floor(randomValue * (maximum - minimum + 1)) + minimum;
  }

  startDragMemorySession(event) {
    if (
      !this.entryComplete ||
      !this.app.isInputEnabled() ||
      event.button !== 0
    ) {
      return;
    }

    this.dragSession = {
      ...this.createInactiveDragSession(),
      active: true,
      pointerId: event.pointerId,
      nextAudioBloomTarget: this.randomInteger(
        MEMORY_UI_CONFIG.FIRST_AUDIO_CHECK_BLOOMS_MIN,
        MEMORY_UI_CONFIG.FIRST_AUDIO_CHECK_BLOOMS_MAX,
      ),
      audioOpportunityCheck: this.randomInteger(
        1,
        MEMORY_UI_CONFIG.AUDIO_CHECKS_PER_GESTURE,
      ),
      startedAt: performance.now(),
      nextVisualCardRevealAt: performance.now(),
    };
  }

  endDragMemorySession(event) {
    if (
      !this.dragSession.active ||
      (event?.pointerId !== undefined &&
        event.pointerId !== this.dragSession.pointerId)
    ) {
      return;
    }

    this.dragSession.active = false;
    this.dragSession.endedAt = performance.now();
    this.dragSession.pointerId = null;
  }

  queueMemoryCard(
    memory,
    worldPosition,
    displayLabel = memory?.label,
    revealDelay = 0,
  ) {
    if (!memory) {
      return;
    }

    const audioCard = isAudioPresentation(memory);
    this.reservedMemoryIds.add(memory.id);
    if (audioCard) {
      this.reservedAudioIds.add(memory.id);
    }
    const generation = this.cardGeneration;
    const position = worldPosition.clone();
    void this.imagePreloader.preload(memory.image);
    void this.app.audioManager?.preloadArchiveVoice(memory);
    const enqueue = () => {
      if (generation !== this.cardGeneration) {
        this.releaseCardReservation(memory.id, audioCard);
        return;
      }
      this.cardQueue = this.cardQueue.then(() =>
        this.presentMemoryCard(memory, position, displayLabel, generation),
      );
    };

    if (revealDelay > 0) {
      const timer = window.setTimeout(() => {
        this.pendingCardTimers.delete(timer);
        enqueue();
      }, revealDelay);
      this.pendingCardTimers.add(timer);
    } else {
      enqueue();
    }
  }

  async presentMemoryCard(memory, worldPosition, displayLabel, generation) {
    if (generation !== this.cardGeneration) {
      this.releaseCardReservation(memory.id, isAudioPresentation(memory));
      return;
    }

    const audioCard = isAudioPresentation(memory);
    const maximumActiveCards = audioCard
      ? MEMORY_UI_CONFIG.MAX_ACTIVE_AUDIO_MEMORY_CARDS
      : getMaxActiveVisualCards(window.innerWidth);
    let matchingActiveCards = this.activeCards.filter(
      (entry) => entry.audioCard === audioCard && !entry.dismissing,
    );
    while (matchingActiveCards.length >= maximumActiveCards) {
      const dismissCandidate = matchingActiveCards.find(
        (entry) => !entry.voiceActive,
      );
      if (!dismissCandidate) {
        this.releaseCardReservation(memory.id, audioCard);
        return;
      }
      await this.dismissCard(dismissCandidate);
      if (generation !== this.cardGeneration) {
        this.releaseCardReservation(memory.id, audioCard);
        return;
      }
      matchingActiveCards = this.activeCards.filter(
        (entry) => entry.audioCard === audioCard && !entry.dismissing,
      );
    }

    const card = createMemoryCardElement(memory, displayLabel);
    this.cardLayer.append(card);

    const entry = {
      element: card,
      memoryId: memory.id,
      audioCard,
      worldPosition,
      hideTimer: null,
      hideAt: 0,
      dismissing: false,
      shownAt: performance.now(),
      voiceActive: false,
      audioAbortController: memory.audio ? new AbortController() : null,
      placementOffset: this.randomInteger(
        0,
        MEMORY_UI_CONFIG.MEMORY_CARD_PLACEMENT_CANDIDATES - 1,
      ),
      placementPhase: THREE.MathUtils.lerp(
        0,
        Math.PI * 2,
        THREE.MathUtils.clamp(this.random(), 0, 1),
      ),
      skyAnchorRatio: THREE.MathUtils.clamp(
        MEMORY_UI_CONFIG.MEMORY_CARD_SKY_ANCHORS[
          this.randomInteger(
            0,
            MEMORY_UI_CONFIG.MEMORY_CARD_SKY_ANCHORS.length - 1,
          )
        ] + THREE.MathUtils.lerp(
          -MEMORY_UI_CONFIG.MEMORY_CARD_SKY_ANCHOR_JITTER,
          MEMORY_UI_CONFIG.MEMORY_CARD_SKY_ANCHOR_JITTER,
          THREE.MathUtils.clamp(this.random(), 0, 1),
        ),
        0.08,
        0.92,
      ),
      verticalJitter: THREE.MathUtils.lerp(
        -MEMORY_UI_CONFIG.MEMORY_CARD_VERTICAL_JITTER,
        MEMORY_UI_CONFIG.MEMORY_CARD_VERTICAL_JITTER,
        THREE.MathUtils.clamp(this.random(), 0, 1),
      ),
      visibleDuration: audioCard
        ? MEMORY_UI_CONFIG.MEMORY_CARD_VISIBLE_DURATION
        : this.randomInteger(
            MEMORY_UI_CONFIG.VISUAL_CARD_VISIBLE_DURATION_MIN,
            MEMORY_UI_CONFIG.VISUAL_CARD_VISIBLE_DURATION_MAX,
          ),
      horizontalBias: 0,
    };
    this.activeCards.push(entry);
    this.positionCard(entry);
    this.app.atmosphereSystem?.emitMemory?.(
      worldPosition,
      performance.now() * 0.001,
      { horizontalBias: entry.horizontalBias },
    );
    window.requestAnimationFrame(() => card.classList.add("is-visible"));
    this.scheduleCardDismiss(
      entry,
      entry.visibleDuration,
    );
    if (memory.audio) {
      void this.startCardAudio(entry, memory, generation);
    }
  }

  releaseCardReservation(memoryId, audioCard = false) {
    this.reservedMemoryIds.delete(memoryId);
    if (audioCard) {
      this.reservedAudioIds.delete(memoryId);
    }
  }

  scheduleCardDismiss(entry, delayMilliseconds) {
    if (!entry || entry.dismissing) {
      return;
    }
    window.clearTimeout(entry.hideTimer);
    const delayDuration = Math.max(0, delayMilliseconds);
    entry.hideAt = performance.now() + delayDuration;
    entry.element.dataset.dismissDelay = String(Math.round(delayDuration));
    entry.hideTimer = window.setTimeout(
      () => this.dismissCard(entry),
      delayDuration,
    );
  }

  async startCardAudio(entry, memory, generation) {
    const audioManager = this.app.audioManager;
    if (!audioManager || !entry.audioAbortController) {
      return;
    }

    entry.element.classList.add("is-audio-loading");
    const playback = await audioManager.playArchiveVoice(memory, {
      signal: entry.audioAbortController.signal,
    });
    entry.element.classList.remove("is-audio-loading");
    if (
      !playback ||
      entry.dismissing ||
      generation !== this.cardGeneration
    ) {
      if (!entry.dismissing && generation === this.cardGeneration) {
        entry.element.classList.add("is-audio-unavailable");
        if (memory.kind === MEMORY_KINDS.AUDIO_ARCHIVE) {
          this.scheduleCardDismiss(entry, 1200);
        }
      }
      return;
    }

    entry.voiceActive = true;
    entry.element.classList.add("is-audio-playing");
    entry.element.dataset.audioDuration = String(Math.round(playback.durationMs));
    updateMemoryCardAudioDuration(
      entry.element,
      playback.mediaDurationMs ?? playback.durationMs,
    );
    const visibleDurationFromPlayback = getVoiceCardVisibleDuration(
      playback.durationMs,
      0,
    );
    const defaultEnd = entry.shownAt + entry.visibleDuration;
    const playbackEnd = performance.now() + visibleDurationFromPlayback;
    const maximumEnd = entry.shownAt + AUDIO_CONFIG.VOICE_CARD_MAX_DURATION;
    const targetEnd = Math.min(
      maximumEnd,
      Math.max(defaultEnd, playbackEnd),
    );
    this.scheduleCardDismiss(
      entry,
      Math.max(0, targetEnd - performance.now()),
    );

    void playback.finished.then(() => {
      if (entry.dismissing || generation !== this.cardGeneration) {
        return;
      }
      entry.voiceActive = false;
      entry.element.classList.remove("is-audio-playing");
      entry.element.classList.add("is-audio-complete");
      const defaultEnd = entry.shownAt + entry.visibleDuration;
      const audioTailEnd = performance.now() + AUDIO_CONFIG.VOICE_CARD_TAIL_DURATION;
      this.scheduleCardDismiss(
        entry,
        Math.max(0, Math.max(defaultEnd, audioTailEnd) - performance.now()),
      );
    });
  }

  positionCard(entry) {
    const { element, worldPosition } = entry;
    const canvasBounds = this.app.renderer.domElement.getBoundingClientRect();
    this.app.camera.updateMatrixWorld();
    this.projectedPosition.copy(worldPosition).project(this.app.camera);

    const bloomX =
      canvasBounds.left +
      (this.projectedPosition.x * 0.5 + 0.5) * canvasBounds.width;
    const bloomY =
      canvasBounds.top +
      (-this.projectedPosition.y * 0.5 + 0.5) * canvasBounds.height;
    const bounds = element.getBoundingClientRect();
    const margin = MEMORY_UI_CONFIG.MEMORY_CARD_EDGE_MARGIN;
    const verticalOffset = 34;
    const upperBand = getMemoryCardUpperBand(
      window.innerHeight,
      bounds.height,
      margin,
      entry.audioCard,
    );
    const projectedTop = THREE.MathUtils.clamp(
      bloomY - bounds.height - verticalOffset,
      upperBand.topMin,
      upperBand.topMax,
    );
    const upperBandMidpoint = (upperBand.topMin + upperBand.topMax) * 0.5;
    const preferredTop = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(
        upperBandMidpoint,
        projectedTop,
        MEMORY_UI_CONFIG.MEMORY_CARD_WORLD_Y_INFLUENCE,
      ) + entry.verticalJitter,
      upperBand.topMin,
      upperBand.topMax,
    );
    const laneGap = MEMORY_UI_CONFIG.MEMORY_CARD_VERTICAL_LANE_GAP;
    const horizontalOffset = 38;
    const rawCandidates = entry.audioCard
      ? [
          {
            name: "audio-upper-right",
            left: bloomX + horizontalOffset,
            top: preferredTop - laneGap * 0.62,
          },
          {
            name: "audio-upper-left",
            left: bloomX - bounds.width - horizontalOffset,
            top: preferredTop + laneGap * 0.18,
          },
          {
            name: "audio-right",
            left: bloomX + horizontalOffset + 6,
            top: preferredTop + laneGap,
          },
          {
            name: "audio-left",
            left: bloomX - bounds.width - horizontalOffset - 6,
            top: preferredTop - laneGap,
          },
        ]
      : Array.from(
          { length: MEMORY_UI_CONFIG.MEMORY_CARD_PLACEMENT_CANDIDATES },
          (_, index) => {
            const sequence = index + 1;
            const horizontalSample = (
              entry.skyAnchorRatio + sequence * 0.61803398875
            ) % 1;
            const verticalSample = (
              entry.placementPhase / (Math.PI * 2) +
              sequence * 0.75487766625
            ) % 1;
            const scatteredCenterX =
              canvasBounds.left + canvasBounds.width * horizontalSample;
            const candidateCenterX = THREE.MathUtils.lerp(
              scatteredCenterX,
              bloomX,
              MEMORY_UI_CONFIG.MEMORY_CARD_WORLD_X_INFLUENCE,
            );
            return {
              name: `sky-${index + 1}`,
              left: candidateCenterX - bounds.width * 0.5,
              top: THREE.MathUtils.lerp(
                upperBand.topMin,
                upperBand.topMax,
                verticalSample,
              ),
            };
          },
        );
    const candidates = rawCandidates.map((_, index) => {
      const candidate =
        rawCandidates[(index + entry.placementOffset) % rawCandidates.length];
      return {
        name: candidate.name,
        left: THREE.MathUtils.clamp(
          candidate.left,
          margin,
          Math.max(margin, window.innerWidth - bounds.width - margin),
        ),
        top: THREE.MathUtils.clamp(
          candidate.top,
          upperBand.topMin,
          upperBand.topMax,
        ),
      };
    });
    const occupiedRects = this.activeCards
      .filter((card) => card !== entry && !card.dismissing)
      .map((card) => card.element.getBoundingClientRect());
    for (const selector of [
      ".brand-block",
      ".system-status",
      ".audio-controls",
    ]) {
      const reservedElement = document.querySelector(selector);
      if (reservedElement) {
        occupiedRects.push(reservedElement.getBoundingClientRect());
      }
    }
    const cardArea = Math.max(1, bounds.width * bounds.height);
    let bestCandidate = candidates[0];
    let bestOverlap = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const candidateRect = {
        left: candidate.left,
        top: candidate.top,
        right: candidate.left + bounds.width,
        bottom: candidate.top + bounds.height,
      };
      const overlapRatio = occupiedRects.reduce((total, occupied) => {
        const overlapWidth = Math.max(
          0,
          Math.min(candidateRect.right, occupied.right) -
            Math.max(candidateRect.left, occupied.left),
        );
        const overlapHeight = Math.max(
          0,
          Math.min(candidateRect.bottom, occupied.bottom) -
            Math.max(candidateRect.top, occupied.top),
        );
        const occupiedArea = Math.max(1, occupied.width * occupied.height);
        return total +
          (overlapWidth * overlapHeight) /
            Math.min(cardArea, occupiedArea);
      }, 0);

      if (overlapRatio < bestOverlap) {
        bestCandidate = candidate;
        bestOverlap = overlapRatio;
      }
      if (overlapRatio <= MEMORY_UI_CONFIG.MEMORY_CARD_MAX_OVERLAP) {
        break;
      }
    }

    element.dataset.placement = bestCandidate.name;
    element.style.left = `${Math.round(bestCandidate.left)}px`;
    element.style.top = `${Math.round(bestCandidate.top)}px`;
    entry.horizontalBias = THREE.MathUtils.clamp(
      (bestCandidate.left + bounds.width * 0.5 - bloomX) /
        Math.max(1, window.innerWidth * 0.34),
      -1,
      1,
    );
  }

  dismissCard(entry, immediate = false) {
    if (!entry || entry.dismissing) {
      return entry?.dismissPromise ?? Promise.resolve();
    }

    entry.dismissing = true;
    window.clearTimeout(entry.hideTimer);
    entry.audioAbortController?.abort();
    if (entry.voiceActive) {
      entry.voiceActive = false;
      void this.app.audioManager?.stopArchiveVoice(entry.memoryId);
    }
    entry.element.classList.remove("is-visible");
    entry.element.classList.add("is-exiting");
    entry.dismissPromise = wait(
      immediate ? 0 : MEMORY_UI_CONFIG.MEMORY_CARD_FADE_DURATION,
    ).then(() => {
      entry.element.remove();
      this.activeCards = this.activeCards.filter((card) => card !== entry);
      this.releaseCardReservation(entry.memoryId, entry.audioCard);
    });
    return entry.dismissPromise;
  }

  clearCards() {
    this.cardGeneration += 1;
    this.pendingCardTimers.forEach((timer) => window.clearTimeout(timer));
    this.pendingCardTimers.clear();
    this.activeCards.forEach((entry) => this.dismissCard(entry, true));
    this.activeCards = [];
    this.reservedMemoryIds.clear();
    this.reservedAudioIds.clear();
    this.cardLayer.replaceChildren();
    this.cardQueue = Promise.resolve();
    void this.app.audioManager?.resetArchiveAudio();
  }

  onReset() {
    this.clearCards();
    this.memoryPool.resetSelection();
    this.endDragMemorySession();
  }

  onResize() {
    window.requestAnimationFrame(() => {
      this.activeCards.forEach((entry) => this.positionCard(entry));
    });
  }
}

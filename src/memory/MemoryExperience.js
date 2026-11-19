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
  updateMemoryCardLanguage,
} from "./MemoryCardRenderer.js";
import { MemoryImagePreloader } from "./MemoryAssetPreloader.js";
import { VisitorMemoryCard } from "./VisitorMemoryCard.js";
import { getLanguage, translate } from "../i18n/LanguageController.js";

export const MEMORY_UI_CONFIG = Object.freeze({
  FEATURED_FLOWER_SCALE: 1.16,
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

export function getMemoryEchoLabel(
  memory,
  bloomNumber,
  language = getLanguage(),
  featuredLabels = {},
) {
  if (memory?.verified && Object.hasOwn(featuredLabels, memory.id)) {
    return translate(featuredLabels[memory.id], {}, language);
  }
  if (memory?.label === "writing-prompt") return translate("memory.prompt", {}, language);
  if (memory?.kind === MEMORY_KINDS.AUDIO_ARCHIVE) {
    return translate("memory.archiveVoice", {}, language);
  }
  if (memory?.kind === MEMORY_KINDS.IMAGE_ARCHIVE) {
    return translate("memory.archiveImage", { number: bloomNumber }, language);
  }
  if (memory?.kind === MEMORY_KINDS.PAIRED_MEMORY) {
    return translate("memory.verified", { number: bloomNumber }, language);
  }
  if (memory?.isPrototype) return translate("memory.example", {}, language);
  if (memory?.id?.startsWith("session-memory-")) return translate("memory.visitor", {}, language);
  return translate("memory.echo", { number: bloomNumber }, language);
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
    this.place = null;
    this.memoryPool = null;
    this.placePools = new Map();
    this.drafts = new Map();
    this.imagePreloader = new MemoryImagePreloader();
    this.overlay = document.querySelector("#memory-entry-overlay");
    this.form = document.querySelector("#memory-entry-form");
    this.textarea = document.querySelector("#memory-text");
    this.submitButton = document.querySelector("#memory-submit");
    this.writeButton = document.querySelector("#garden-write");
    this.field = document.querySelector("#garden-field");
    this.cardLayer = document.querySelector("#memory-card-layer");
    this.resetButton = document.querySelector("#reset-button");
    this.activeCards = [];
    this.reservedMemoryIds = new Set();
    this.reservedAudioIds = new Set();
    this.cardQueue = Promise.resolve();
    this.cardGeneration = 0;
    this.pendingCardTimers = new Set();
    this.gardenActive = false;
    this.formGeneration = 0;
    this.readTarget = null;
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

    this.visitorCard = new VisitorMemoryCard(this.form, {
      audioManager: this.app.audioManager,
      onChange: this.onInput,
      onRead: (memory) => this.openForm(memory),
      onWrite: () => this.openForm(),
    });
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
    this.textarea.addEventListener("input", this.onInput);
    this.form.addEventListener("submit", this.onSubmit);
    this.writeButton.addEventListener("click", () => this.openForm());
    document.querySelector("#memory-cancel").addEventListener("click", () => {
      if (!this.form.dataset.submitting) this.closeForm();
    });
    document.addEventListener("keydown", (event) => this.onDialogKey(event));
    this.resetButton.addEventListener("click", this.onReset);
    this.app.renderer.domElement.addEventListener(
      "pointerdown",
      this.startDragMemorySession,
    );
    this.app.renderer.domElement.addEventListener("pointermove", (event) => {
      if (this.readTarget && event.pointerId === this.dragSession.pointerId &&
          Math.hypot(event.clientX-this.readTarget.x, event.clientY-this.readTarget.y) > 7) {
        this.readTarget = null;
        this.app.setInputEnabled(true);
      }
    });
    this.app.renderer.domElement.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.repeat || !this.app.isInputEnabled()) return;
      event.preventDefault();
      const memory = this.memoryPool.selectVisualEcho(this.random, { excludeIds: this.reservedMemoryIds });
      if (memory) this.bloomMemory(memory);
    });
    window.addEventListener("pointerup", this.endDragMemorySession);
    window.addEventListener("pointercancel", this.endDragMemorySession);
    window.addEventListener("blur", this.endDragMemorySession);
    window.addEventListener("resize", this.onResize);
    this.unsubscribeBloom = this.app.flowerSystem.onBloomCreated(
      this.onBloomCreated,
    );
    return this;
  }

  enter(place, bloomOnSubmit = true) {
    if (this.gardenActive && this.place === place) return;
    if (this.gardenActive) this.leave();
    this.place = place;
    this.bloomOnSubmit = bloomOnSubmit;
    const draft = this.drafts.get(place);
    this.drafts.delete(place);
    this.textarea.value = draft?.text ?? "";
    this.visitorCard.attachment = draft?.attachment ?? null;
    document.querySelector("#garden-confirmation").hidden = true;
    if (!this.placePools.has(place)) {
      this.placePools.set(place, createMemoryPool({ prototypeMemories: place.memories }));
      this.imagePreloader.scheduleInitial(place.memories);
    }
    this.memoryPool = this.placePools.get(place);
    this.gardenActive = true;
    this.writeButton.disabled = false;
    this.app.setRendering(true);
    this.app.camera.updateMatrixWorld();
    this.app.setInputEnabled(true);
    this.app.audioManager.setGardenVisible(true);
    for (const planting of place.initialBlooms) {
      const visitor = planting.useLastVisitor && this.memoryPool.sessionMemories.at(-1);
      this.bloomMemory(visitor || planting.memory, planting);
    }
  }

  leave() {
    this.gardenActive = false;
    if (this.textarea.value || this.visitorCard.attachment) {
      this.drafts.set(this.place, { text: this.textarea.value, attachment: this.visitorCard.attachment });
    } else {
      this.drafts.delete(this.place);
    }
    document.querySelector("#garden-confirmation").hidden = true;
    this.closeForm(false);
    this.app.setInputEnabled(false);
    this.app.mouseInput.onWindowBlur();
    this.app.pointerController.setVisible(false);
    this.onReset();
    this.app.resetField();
    this.app.setRendering(false);
    this.app.audioManager.setGardenVisible(false);
  }

  openForm(memory = null) {
    if (!this.gardenActive || this.form.dataset.submitting) return;
    if (this.overlay.hidden) this.endDragMemorySession();
    document.querySelector("#garden-confirmation").hidden = true;
    this.field.inert = true;
    this.app.setInputEnabled(false);
    this.overlay.hidden = false;
    this.overlay.removeAttribute("aria-hidden");
    this.overlay.setAttribute("aria-labelledby", memory ? "memory-reader-title" : "memory-entry-title");
    document.body.classList.add("memory-entry-active");
    this.visitorCard.show(memory, this.memoryPool.sessionMemories);
    (memory ? document.querySelector("#memory-reader-title") : this.textarea).focus({ preventScroll: true });
  }

  closeForm(restoreFocus = true) {
    this.formGeneration += 1;
    this.visitorCard.hide();
    this.overlay.hidden = true;
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.classList.remove("is-submitting", "is-leaving");
    delete this.form.dataset.submitting;
    this.textarea.readOnly = false;
    document.body.classList.remove("memory-entry-active", "memory-entry-releasing");
    this.field.inert = false;
    this.app.setInputEnabled(this.gardenActive);
    if (restoreFocus && this.gardenActive) this.writeButton.focus({ preventScroll: true });
  }

  onDialogKey(event) {
    if (this.overlay.hidden) return;
    if (event.key === "Escape" && !this.form.dataset.submitting) {
      event.preventDefault();
      this.closeForm();
      return;
    }
    if (event.key !== "Tab") return;
    const first = document.querySelector("#memory-cancel");
    const last = document.querySelector("#language-toggle");
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  get canSubmit() {
    return this.gardenActive && this.visitorCard.editable && !this.visitorCard.pending &&
      Boolean(this.textarea.value.trim() || this.visitorCard.attachment);
  }

  onInput() {
    this.submitButton.disabled = !this.canSubmit;
  }

  async onSubmit(event) {
    event.preventDefault();
    if (!this.canSubmit) return;
    const text = this.textarea.value;
    const attachment = this.visitorCard.attachment;

    void this.app.audioManager?.unlock();

    const memory = this.memoryPool.addSessionMemory(text, attachment);
    // The saved memory now owns the object URL for the rest of this visit.
    this.visitorCard.attachment = null;
    this.visitorCard.hide();
    this.drafts.delete(this.place);
    this.textarea.value = "";
    if (!this.bloomOnSubmit) {
      this.closeForm();
      document.querySelector("#garden-confirmation").hidden = false;
      return;
    }
    const generation = ++this.formGeneration;
    this.textarea.readOnly = true;
    this.form.dataset.submitting = "true";
    this.submitButton.disabled = true;
    this.overlay.classList.add("is-submitting");
    await wait(180);
    if (generation !== this.formGeneration) return;
    document.body.classList.add("memory-entry-releasing");
    this.overlay.classList.add("is-leaving");
    await wait(MEMORY_UI_CONFIG.MODAL_EXIT_DURATION);

    if (generation !== this.formGeneration) return;
    this.closeForm();
    this.bloomMemory(memory, { submitted: true });
  }

  bloomMemory(memory, { x = 0.52, y = 0.64, reveal = true, submitted = false } = {}) {
    const canvas = this.app.renderer.domElement;
    const width = Math.max(1, canvas.clientWidth || canvas.width);
    const height = Math.max(1, canvas.clientHeight || canvas.height);
    const targetRatios = [y, 0.58, 0.7];
    let hasGroundPoint = false;

    for (const verticalRatio of targetRatios) {
      hasGroundPoint = this.app.groundRaycaster.getGroundPointFromPixel(
        width * x,
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

    const bloom = this.app.flowerSystem.createBloom(
      this.firstBloomPosition,
      performance.now() * 0.001,
      { memoryId: memory.id },
    );
    if (!bloom) return;
    this.emphasizeFeatured(bloom, memory);
    if (reveal) {
      const number = String(this.app.flowerSystem.blooms.length).padStart(3, "0");
      this.queueMemoryCard(memory, bloom.anchorPosition, () =>
        submitted ? translate("memory.your") : this.echoLabel(memory, number));
    }
  }

  onBloomCreated(bloomEvent) {
    if (!this.gardenActive || bloomEvent.memoryId) {
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

  emphasizeFeatured(bloomEvent, memory) {
    if (memory.verified && Object.hasOwn(this.place.featuredLabels, memory.id)) {
      this.app.flowerSystem.emphasizeBloom(bloomEvent, MEMORY_UI_CONFIG.FEATURED_FLOWER_SCALE);
    }
  }

  echoLabel(memory, number) {
    return getMemoryEchoLabel(memory, number, getLanguage(), this.place.featuredLabels);
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
    this.emphasizeFeatured(bloomEvent, memory);
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
      () => this.echoLabel(memory, bloomNumber),
      Math.max(0, revealTime - now),
    );
  }

  maybeQueueArchiveVoice(bloomEvent, session) {
    if (
      !this.app.audioManager?.unlocked ||
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
      () => this.echoLabel(memory, bloomNumber),
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
      !this.gardenActive ||
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
    const hit = this.groundAt(event);
    if (!hit) return;
    let nearest = null;
    let distance = Infinity;
    for (const bloom of this.app.flowerSystem.blooms) {
      if (!bloom.memoryId) continue;
      const d = bloom.anchorPosition.distanceTo(hit);
      // A submitted bloom can share the opening cluster's anchor. Read the newest one there.
      if (d <= distance && d <= bloom.radius) {
        nearest = bloom;
        distance = d;
      }
    }
    if (nearest) {
      this.readTarget = { bloom: nearest, x: event.clientX, y: event.clientY };
      this.app.setInputEnabled(false);
    }
  }

  groundAt(event) {
    const rect = this.app.renderer.domElement.getBoundingClientRect();
    const point = new THREE.Vector3();
    return this.app.groundRaycaster.getGroundPointFromPixel(
      event.clientX-rect.left, event.clientY-rect.top, rect.width, rect.height, point,
    ) ? point : null;
  }

  endDragMemorySession(event) {
    if (
      !this.dragSession.active ||
      (event?.pointerId !== undefined &&
        event.pointerId !== this.dragSession.pointerId)
    ) {
      return;
    }

    const target = this.readTarget;
    let visitorMemoryToRead = null;
    this.readTarget = null;
    if (target) {
      this.app.setInputEnabled(this.gardenActive && this.overlay.hidden);
      const { memoryId, anchorPosition } = target.bloom;
      const memory = this.memoryPool.getById(memoryId);
      const visible = this.activeCards.find((card) => card.memoryId === memoryId && !card.dismissing);
      if (event?.type === "pointerup" && memory?.attachment) {
        visitorMemoryToRead = memory;
      } else if (event?.type === "pointerup" && visible) {
        visible.element.classList.add("is-reading");
        if (this.positionCard(visible) > MEMORY_UI_CONFIG.MEMORY_CARD_MAX_OVERLAP) this.fitCrowdedCards();
        this.scheduleCardDismiss(visible, visible.visibleDuration);
      } else if (event?.type === "pointerup" && !this.reservedMemoryIds.has(memoryId)) {
        const number = String(this.app.flowerSystem.blooms.indexOf(target.bloom) + 1).padStart(3, "0");
        this.queueMemoryCard(memory, anchorPosition, () => this.echoLabel(memory, number), 0, true);
      }
    } else if (event?.type === "pointerup" && !this.dragSession.bloomEvents && this.app.isInputEnabled()) {
      const point = this.groundAt(event);
      if (point) this.app.flowerSystem.createBloom(point, performance.now()*0.001);
    }
    this.dragSession.active = false;
    this.dragSession.endedAt = performance.now();
    this.dragSession.pointerId = null;
    if (visitorMemoryToRead) this.openForm(visitorMemoryToRead);
  }

  queueMemoryCard(
    memory,
    worldPosition,
    displayLabel = null,
    revealDelay = 0,
    reading = false,
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
        return;
      }
      this.cardQueue = this.cardQueue.then(() =>
        this.presentMemoryCard(memory, position, displayLabel, generation, reading),
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

  async presentMemoryCard(memory, worldPosition, displayLabel, generation, reading) {
    if (generation !== this.cardGeneration) {
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
        return;
      }
      matchingActiveCards = this.activeCards.filter(
        (entry) => entry.audioCard === audioCard && !entry.dismissing,
      );
    }

    const resolveDisplayLabel = () =>
      typeof displayLabel === "function" ? displayLabel(memory) : displayLabel;
    const card = createMemoryCardElement(memory, resolveDisplayLabel());
    card.classList.toggle("is-reading", reading);
    this.cardLayer.append(card);

    const entry = {
      element: card,
      generation,
      memory,
      memoryId: memory.id,
      displayLabel,
      audioCard,
      worldPosition,
      hideTimer: null,
      hideAt: 0,
      dismissing: false,
      shownAt: performance.now(),
      voiceActive: false,
      audioAbortController: memory.audio ? new AbortController() : null,
      audioDisplayDuration: 0,
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
    if (this.positionCard(entry) > MEMORY_UI_CONFIG.MEMORY_CARD_MAX_OVERLAP) {
      this.fitCrowdedCards();
    }
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
    entry.audioDisplayDuration = playback.mediaDurationMs ?? playback.durationMs;
    updateMemoryCardAudioDuration(
      entry.element,
      entry.audioDisplayDuration,
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
    if (element.classList.contains("is-reading")) {
      element.classList.remove("is-dense");
      element.classList.toggle("is-dense", element.offsetHeight > window.innerHeight * 0.48);
    }
    const canvasBounds = this.app.renderer.domElement.getBoundingClientRect();
    this.app.camera.updateMatrixWorld();
    this.projectedPosition.copy(worldPosition).project(this.app.camera);

    const bloomX =
      canvasBounds.left +
      (this.projectedPosition.x * 0.5 + 0.5) * canvasBounds.width;
    const bloomY =
      canvasBounds.top +
      (-this.projectedPosition.y * 0.5 + 0.5) * canvasBounds.height;
    const bounds = { width: element.offsetWidth, height: element.offsetHeight };
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
      .map(({ element: other }) => new DOMRect(other.offsetLeft, other.offsetTop, other.offsetWidth, other.offsetHeight));
    for (const selector of [
      ".brand-block",
      ".system-status",
      ".audio-controls",
      ".language-toggle",
      ".garden-back",
    ]) {
      const reservedElement = document.querySelector(selector);
      if (reservedElement) {
        occupiedRects.push(reservedElement.getBoundingClientRect());
      }
    }
    const cardArea = Math.max(1, bounds.width * bounds.height);
    const maxLeft = Math.max(margin, window.innerWidth - margin - bounds.width);
    for (const left of [margin, maxLeft]) {
      for (const top of [upperBand.topMin, upperBand.topMax]) {
        candidates.push({ left, top, name: "sky-edge" });
      }
    }
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
    return bestOverlap;
  }

  // When a late echo cannot fit between scattered cards, redistribute the few
  // visible cards into columns while keeping each near its previous x position.
  fitCrowdedCards() {
    const margin = MEMORY_UI_CONFIG.MEMORY_CARD_EDGE_MARGIN;
    const gap = 8;
    const cards = this.activeCards.filter((card) => !card.dismissing);
    if (!cards.length) return;
    const space = window.innerWidth - 2 * margin;
    const widest = Math.max(...cards.map(({ element }) => element.offsetWidth));
    const count = Math.max(1, Math.min(cards.length, Math.floor((space + gap) / (widest + gap))));
    const step = (space + gap) / count;
    const columns = Array.from({ length: count }, (_, i) => ({ left: margin + i * step, bottom: 0 }));
    const placements = [];
    // Voice has the tightest vertical band. Taller visual cards go in first.
    cards.sort((a, b) => Number(b.audioCard) - Number(a.audioCard) || b.element.offsetHeight - a.element.offsetHeight);
    for (const { element, audioCard } of cards) {
      const band = getMemoryCardUpperBand(window.innerHeight, element.offsetHeight, margin, audioCard);
      let best;
      for (const column of columns) {
        const top = Math.max(band.topMin, column.bottom + gap);
        if (top > band.topMax) continue;
        const left = THREE.MathUtils.clamp(element.offsetLeft, column.left,
          Math.max(column.left, column.left + step - gap - element.offsetWidth));
        const score = top + Math.abs(left - element.offsetLeft) * 0.12;
        if (!best || score < best.score) best = { column, left, top, score };
      }
      if (!best) return;
      best.column.bottom = best.top + element.offsetHeight;
      placements.push({ element, left: best.left, top: best.top });
    }
    for (const { element, left, top } of placements) {
      element.style.left = `${Math.round(left)}px`;
      element.style.top = `${Math.round(top)}px`;
    }
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
      if (entry.generation === this.cardGeneration) {
        this.releaseCardReservation(entry.memoryId, entry.audioCard);
      }
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
    this.memoryPool?.resetSelection();
    this.endDragMemorySession();
  }

  onResize() {
    window.requestAnimationFrame(() => {
      const visual = this.activeCards.filter((entry) => !entry.audioCard && !entry.dismissing);
      const excess = visual.length - getMaxActiveVisualCards(window.innerWidth);
      if (excess > 0) visual.slice(0, excess).forEach((entry) => this.dismissCard(entry, true));
      let overlap = 0;
      this.activeCards.forEach((entry) => {
        if (!entry.dismissing) overlap = Math.max(overlap, this.positionCard(entry));
      });
      if (overlap > MEMORY_UI_CONFIG.MEMORY_CARD_MAX_OVERLAP) this.fitCrowdedCards();
    });
  }

  refreshLanguage() {
    this.visitorCard.refreshLanguage();
    this.activeCards.forEach((entry) => {
      const displayLabel =
        typeof entry.displayLabel === "function"
          ? entry.displayLabel(entry.memory)
          : entry.displayLabel;
      updateMemoryCardLanguage(
        entry.element,
        entry.memory,
        displayLabel,
      );
      if (entry.audioDisplayDuration > 0) {
        updateMemoryCardAudioDuration(
          entry.element,
          entry.audioDisplayDuration,
        );
      }
    });
    this.onResize();
  }
}

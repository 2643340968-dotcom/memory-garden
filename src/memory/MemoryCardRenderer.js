import {
  MEMORY_KINDS,
  MEMORY_RELATIONSHIPS,
  MEMORY_TYPES,
} from "../data/memoryPool.js";

function joinMetadata(memory) {
  return [memory.date, memory.location].filter(Boolean).join(" · ");
}

export function getMemoryCardViewModel(memory, displayLabel = memory?.label) {
  const type = Object.values(MEMORY_TYPES).includes(memory?.type)
    ? memory.type
    : MEMORY_TYPES.TEXT;
  const isAudioOnly = memory?.kind === MEMORY_KINDS.AUDIO_ARCHIVE;
  const isVerifiedPair =
    memory?.kind === MEMORY_KINDS.PAIRED_MEMORY &&
    memory?.relationship === MEMORY_RELATIONSHIPS.VERIFIED_PAIR;
  const primarySource = isAudioOnly
    ? memory?.audioSource ?? memory?.source
    : memory?.source;
  const separateAudioSource =
    !isAudioOnly &&
    memory?.audioSource &&
    memory.audioSource !== memory?.source
      ? memory.audioSource
      : null;

  return Object.freeze({
    type,
    kind: memory?.kind ?? MEMORY_KINDS.TEXT_MEMORY,
    relationship:
      memory?.relationship ?? MEMORY_RELATIONSHIPS.INDEPENDENT,
    isAudioOnly,
    isVerifiedPair,
    label: displayLabel ?? "MEMORY",
    text:
      type === MEMORY_TYPES.TEXT
        ? memory?.text ?? memory?.caption ?? "记忆内容暂不可用"
        : "",
    image: type === MEMORY_TYPES.IMAGE ? memory?.image ?? "" : "",
    caption: type === MEMORY_TYPES.IMAGE ? memory?.caption ?? "" : "",
    metadata: joinMetadata(memory ?? {}),
    sourceLabel: primarySource ? `SOURCE · ${primarySource}` : "",
    sourceUrl: isAudioOnly
      ? memory?.audioSourceUrl ?? memory?.sourceUrl ?? null
      : memory?.sourceUrl ?? null,
    audioSourceLabel: separateAudioSource
      ? `VOICE SOURCE · ${separateAudioSource}`
      : "",
    quoteText: Boolean(memory?.isQuote),
    hasAudio: Boolean(memory?.audio),
    audioId: memory?.audioId ?? null,
    audioType: memory?.audioType ?? null,
    audioLabel: memory?.audioCaption
      ? isAudioOnly
        ? memory.audioCaption
        : `AUDIO · ${memory.audioCaption}`
      : memory?.audioSource
        ? isAudioOnly
          ? "ARCHIVE VOICE"
          : `AUDIO · ${memory.audioSource}`
        : isAudioOnly
          ? "ARCHIVE VOICE"
          : "AUDIO",
    audioSource: memory?.audioSource ?? null,
    audioSourceUrl: memory?.audioSourceUrl ?? null,
    verified: Boolean(memory?.verified),
    isPrototype: Boolean(memory?.isPrototype),
  });
}

export function formatAudioDuration(durationMilliseconds) {
  const totalSeconds = Math.max(
    0,
    Math.round(Number(durationMilliseconds || 0) / 1000),
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

export function updateMemoryCardAudioDuration(card, durationMilliseconds) {
  const duration = card?.querySelector?.(".memory-echo-audio-time");
  if (!duration) {
    return false;
  }
  duration.textContent = formatAudioDuration(durationMilliseconds);
  return true;
}

function appendTextCardContent(card, viewModel, documentRef) {
  const text = documentRef.createElement("p");
  text.className = "memory-echo-text";
  text.textContent = viewModel.quoteText
    ? `“${viewModel.text}”`
    : viewModel.text;
  card.append(text);
}

function appendImageCardContent(card, viewModel, documentRef) {
  const figure = documentRef.createElement("figure");
  figure.className = "memory-echo-image-frame";
  figure.dataset.fallback = "IMAGE UNAVAILABLE";

  if (viewModel.image) {
    const image = documentRef.createElement("img");
    image.className = "memory-echo-image";
    image.src = viewModel.image;
    image.alt = viewModel.caption || "记忆影像";
    image.decoding = "async";
    image.loading = "eager";
    image.draggable = false;
    image.addEventListener("error", () => {
      figure.classList.add("is-missing");
      image.removeAttribute("src");
    });
    figure.append(image);
  } else {
    figure.classList.add("is-missing");
  }

  const caption = documentRef.createElement("p");
  caption.className = "memory-echo-caption";
  caption.textContent = viewModel.caption;

  card.append(figure, caption);
}

function appendMetadata(card, viewModel, documentRef) {
  if (viewModel.metadata) {
    const metadata = documentRef.createElement("p");
    metadata.className = "memory-echo-meta";
    metadata.textContent = viewModel.metadata;
    card.append(metadata);
  }

  if (viewModel.sourceLabel) {
    const source = documentRef.createElement("p");
    source.className = "memory-echo-source";
    source.textContent = viewModel.sourceLabel;
    card.append(source);
  }

  if (viewModel.audioSourceLabel) {
    const audioSource = documentRef.createElement("p");
    audioSource.className = "memory-echo-source memory-echo-source--audio";
    audioSource.textContent = viewModel.audioSourceLabel;
    card.append(audioSource);
  }
}

function appendAudioStatus(card, viewModel, documentRef) {
  if (!viewModel.hasAudio) {
    return;
  }

  const status = documentRef.createElement("p");
  status.className = "memory-echo-audio";
  status.setAttribute("aria-label", `档案声音：${viewModel.audioLabel}`);
  const dot = documentRef.createElement("span");
  dot.className = "memory-echo-audio-dot";
  dot.setAttribute("aria-hidden", "true");
  const caption = documentRef.createElement("span");
  caption.className = "memory-echo-audio-label";
  caption.textContent = viewModel.audioLabel;
  const duration = documentRef.createElement("span");
  duration.className = "memory-echo-audio-time";
  duration.textContent = "--:--";
  status.append(dot, caption, duration);
  card.append(status);
}

function appendCardLabel(card, viewModel, documentRef) {
  const label = documentRef.createElement("p");
  label.className = "memory-echo-label";
  label.textContent = viewModel.label;
  card.append(label);
}

export function createMemoryCardElement(
  memory,
  displayLabel = memory?.label,
  documentRef = document,
) {
  const viewModel = getMemoryCardViewModel(memory, displayLabel);
  const card = documentRef.createElement("article");
  card.className = `memory-echo-card memory-echo-card--${viewModel.type}`;
  card.dataset.memoryType = viewModel.type;
  card.dataset.memoryKind = viewModel.kind;
  card.dataset.memoryRelationship = viewModel.relationship;
  card.dataset.memoryVerified = String(viewModel.verified);
  card.dataset.memoryPrototype = String(viewModel.isPrototype);
  if (viewModel.hasAudio) {
    card.classList.add("memory-echo-card--has-audio");
    card.dataset.audioId = viewModel.audioId ?? "archive-audio";
  }
  if (viewModel.isAudioOnly) {
    card.classList.add("memory-echo-card--audio-only");
  }
  if (viewModel.isVerifiedPair) {
    card.classList.add("memory-echo-card--verified-pair");
  }
  card.setAttribute("role", "status");

  if (viewModel.type === MEMORY_TYPES.IMAGE) {
    appendImageCardContent(card, viewModel, documentRef);
  } else if (viewModel.type === MEMORY_TYPES.TEXT) {
    appendTextCardContent(card, viewModel, documentRef);
  }
  if (viewModel.isAudioOnly) {
    appendCardLabel(card, viewModel, documentRef);
    appendAudioStatus(card, viewModel, documentRef);
    appendMetadata(card, viewModel, documentRef);
  } else {
    appendMetadata(card, viewModel, documentRef);
    appendAudioStatus(card, viewModel, documentRef);
    appendCardLabel(card, viewModel, documentRef);
  }

  return card;
}

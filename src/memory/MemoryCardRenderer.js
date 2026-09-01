import { MEMORY_TYPES } from "../data/memoryPool.js";

function joinMetadata(memory) {
  return [memory.date, memory.location, memory.source]
    .filter(Boolean)
    .join(" · ");
}

export function getMemoryCardViewModel(memory, displayLabel = memory?.label) {
  const type =
    memory?.type === MEMORY_TYPES.IMAGE
      ? MEMORY_TYPES.IMAGE
      : MEMORY_TYPES.TEXT;

  return Object.freeze({
    type,
    label: displayLabel ?? "MEMORY",
    text: type === MEMORY_TYPES.TEXT ? memory?.text ?? "" : "",
    image: type === MEMORY_TYPES.IMAGE ? memory?.image ?? "" : "",
    caption: type === MEMORY_TYPES.IMAGE ? memory?.caption ?? "" : "",
    metadata: type === MEMORY_TYPES.IMAGE ? joinMetadata(memory ?? {}) : "",
    quoteText: memory?.kind !== "source-audio",
    hasAudio: Boolean(memory?.audio),
    audioId: memory?.audioId ?? null,
    audioType: memory?.audioType ?? null,
    audioCaption: memory?.audioCaption ?? "AUDIO MEMORY",
  });
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
  figure.dataset.fallback = "ARCHIVE PLACEHOLDER";

  const image = documentRef.createElement("img");
  image.className = "memory-echo-image";
  image.src = viewModel.image;
  image.alt = viewModel.caption || "记忆影像";
  image.decoding = "async";
  image.draggable = false;
  image.addEventListener("error", () => {
    figure.classList.add("is-missing");
  });
  figure.append(image);

  const caption = documentRef.createElement("p");
  caption.className = "memory-echo-caption";
  caption.textContent = viewModel.caption;

  const metadata = documentRef.createElement("p");
  metadata.className = "memory-echo-meta";
  metadata.textContent = viewModel.metadata;
  metadata.hidden = !viewModel.metadata;

  card.append(figure, caption, metadata);
}

function appendAudioStatus(card, viewModel, documentRef) {
  if (!viewModel.hasAudio) {
    return;
  }

  const status = documentRef.createElement("p");
  status.className = "memory-echo-audio";
  status.setAttribute("aria-label", `音频记忆：${viewModel.audioCaption}`);
  const dot = documentRef.createElement("span");
  dot.className = "memory-echo-audio-dot";
  dot.setAttribute("aria-hidden", "true");
  const caption = documentRef.createElement("span");
  caption.textContent = viewModel.audioCaption;
  status.append(dot, caption);
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
  if (viewModel.hasAudio) {
    card.classList.add("memory-echo-card--audio");
    card.dataset.audioId = viewModel.audioId ?? "audio-memory";
  }
  if (!viewModel.quoteText) {
    card.classList.add("memory-echo-card--source-audio");
  }
  card.setAttribute("role", "status");

  if (viewModel.type === MEMORY_TYPES.IMAGE) {
    appendImageCardContent(card, viewModel, documentRef);
  } else {
    appendTextCardContent(card, viewModel, documentRef);
  }
  appendAudioStatus(card, viewModel, documentRef);
  appendCardLabel(card, viewModel, documentRef);

  return card;
}

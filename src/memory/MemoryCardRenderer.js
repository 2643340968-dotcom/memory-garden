import {
  MEMORY_KINDS,
  MEMORY_RELATIONSHIPS,
  MEMORY_TYPES,
  VISITOR_MEDIA_KIND,
} from "../data/memoryPool.js";
import {
  getLanguage,
  getLocalizedMemoryText,
  translate,
} from "../i18n/LanguageController.js";

function joinMetadata(memory, language) {
  return [
    memory.location
      ? `${translate("memory.location", {}, language)} · ${memory.location}`
      : "",
    memory.date
      ? `${translate("memory.date", {}, language)} · ${memory.date}`
      : "",
  ]
    .filter(Boolean)
    .join("   ");
}

function getDefaultLocalizedLabel(memory, language) {
  if (memory?.kind === VISITOR_MEDIA_KIND) return translate("memory.your", {}, language);
  if (memory?.kind === MEMORY_KINDS.AUDIO_ARCHIVE) {
    return translate("memory.archiveVoice", {}, language);
  }
  if (memory?.kind === MEMORY_KINDS.IMAGE_ARCHIVE) {
    return translate("memory.archiveImage", { number: "" }, language)
      .replace(/\s*·\s*$/, "");
  }
  if (memory?.kind === MEMORY_KINDS.PAIRED_MEMORY) {
    return translate("memory.verified", { number: "" }, language)
      .replace(/\s*·\s*$/, "");
  }
  return translate("memory.default", {}, language);
}

export function getMemoryCardViewModel(
  memory,
  displayLabel = null,
  language = getLanguage(),
) {
  const type = Object.values(MEMORY_TYPES).includes(memory?.type)
    ? memory.type
    : MEMORY_TYPES.TEXT;
  const attachment = memory?.kind === VISITOR_MEDIA_KIND ? memory.attachment : null;
  const isAudioOnly = memory?.kind === MEMORY_KINDS.AUDIO_ARCHIVE;
  const isVerifiedPair =
    memory?.kind === MEMORY_KINDS.PAIRED_MEMORY &&
    memory?.relationship === MEMORY_RELATIONSHIPS.VERIFIED_PAIR;
  const primarySource = isAudioOnly
    ? memory?.audioSource ?? memory?.source
    : memory?.source;
  const primarySourcePrefix = isAudioOnly
    ? translate("memory.audioSource", {}, language)
    : type === MEMORY_TYPES.IMAGE
      ? translate("memory.imageSource", {}, language)
      : translate("memory.source", {}, language);
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
    label: displayLabel ?? getDefaultLocalizedLabel(memory, language),
    attachment,
    text:
      type === MEMORY_TYPES.TEXT
        ? getLocalizedMemoryText(memory, language)
        : "",
    image: type === MEMORY_TYPES.IMAGE ? memory?.image ?? "" : "",
    caption: type === MEMORY_TYPES.IMAGE ? memory?.caption ?? "" : "",
    metadata: joinMetadata(memory ?? {}, language),
    sourceLabel: primarySource
      ? `${primarySourcePrefix} · ${primarySource}`
      : "",
    sourceUrl: isAudioOnly
      ? memory?.audioSourceUrl ?? memory?.sourceUrl ?? null
      : memory?.sourceUrl ?? null,
    audioSourceLabel: separateAudioSource
      ? `${translate("memory.audioSource", {}, language)} · ${separateAudioSource}`
      : "",
    quoteText: Boolean(memory?.isQuote),
    hasAudio: Boolean(memory?.audio),
    audioId: memory?.audioId ?? null,
    audioType: memory?.audioType ?? null,
    audioLabel: memory?.audioCaption
      ? isAudioOnly
        ? memory.audioCaption
        : `${translate("memory.audio", {}, language)} · ${memory.audioCaption}`
      : memory?.audioSource
        ? isAudioOnly
          ? translate("memory.archiveVoice", {}, language)
          : `${translate("memory.audio", {}, language)} · ${memory.audioSource}`
        : isAudioOnly
          ? translate("memory.archiveVoice", {}, language)
          : translate("memory.audio", {}, language),
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

export function updateMemoryCardAudioDuration(
  card,
  durationMilliseconds,
  language = getLanguage(),
) {
  const duration = card?.querySelector?.(".memory-echo-audio-time");
  if (!duration) {
    return false;
  }
  duration.textContent = `${translate("memory.duration", {}, language)} · ${formatAudioDuration(durationMilliseconds)}`;
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

function appendImageCardContent(card, viewModel, documentRef, language) {
  const figure = documentRef.createElement("figure");
  figure.className = "memory-echo-image-frame";
  figure.dataset.fallback = translate("memory.imageUnavailable", {}, language);

  if (viewModel.image) {
    const image = documentRef.createElement("img");
    image.className = "memory-echo-image";
    image.src = viewModel.image;
    image.alt =
      viewModel.caption || translate("memory.archiveImageAlt", {}, language);
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

  card.append(figure);
  if (viewModel.caption) {
    const caption = documentRef.createElement("p");
    caption.className = "memory-echo-caption";
    caption.textContent = viewModel.caption;
    card.append(caption);
  }
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

function appendAudioStatus(card, viewModel, documentRef, language) {
  if (!viewModel.hasAudio) {
    return;
  }

  const status = documentRef.createElement("p");
  status.className = "memory-echo-audio";
  status.setAttribute(
    "aria-label",
    translate("memory.archiveAudioAria", { label: viewModel.audioLabel }, language),
  );
  const dot = documentRef.createElement("span");
  dot.className = "memory-echo-audio-dot";
  dot.setAttribute("aria-hidden", "true");
  const caption = documentRef.createElement("span");
  caption.className = "memory-echo-audio-label";
  caption.textContent = viewModel.audioLabel;
  const duration = documentRef.createElement("span");
  duration.className = "memory-echo-audio-time";
  duration.textContent = `${translate("memory.duration", {}, language)} · --:--`;
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
  displayLabel = null,
  documentRef = document,
  language = getLanguage(),
) {
  const viewModel = getMemoryCardViewModel(memory, displayLabel, language);
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

  if (viewModel.attachment) {
    const { kind, name, url } = viewModel.attachment;
    card.dataset.attachment = kind;
    if (kind === "image") {
      const thumbnail = documentRef.createElement("img");
      thumbnail.className = "memory-echo-thumbnail";
      thumbnail.src = url;
      thumbnail.alt = name;
      card.append(thumbnail);
    }
    const file = documentRef.createElement("p");
    file.className = "memory-echo-file";
    file.textContent = translate("attachment." + kind, {}, language) + " · " + name;
    card.append(file);
    if (viewModel.text.trim()) appendTextCardContent(card, viewModel, documentRef);
  } else if (viewModel.type === MEMORY_TYPES.IMAGE) {
    appendImageCardContent(card, viewModel, documentRef, language);
  } else if (viewModel.type === MEMORY_TYPES.TEXT) {
    appendTextCardContent(card, viewModel, documentRef);
  }
  if (viewModel.isAudioOnly) {
    appendCardLabel(card, viewModel, documentRef);
    appendAudioStatus(card, viewModel, documentRef, language);
    appendMetadata(card, viewModel, documentRef);
  } else {
    appendMetadata(card, viewModel, documentRef);
    appendAudioStatus(card, viewModel, documentRef, language);
    appendCardLabel(card, viewModel, documentRef);
  }

  return card;
}

export function updateMemoryCardLanguage(
  card,
  memory,
  displayLabel = null,
  language = getLanguage(),
  documentRef = document,
) {
  if (!card?.replaceChildren) {
    return false;
  }
  const localizedCard = createMemoryCardElement(
    memory,
    displayLabel,
    documentRef,
    language,
  );
  card.replaceChildren(...localizedCard.childNodes);
  return true;
}

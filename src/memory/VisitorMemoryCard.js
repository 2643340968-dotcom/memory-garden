import { fileAcceptList, matchesVisitorFile } from "../data/visitorAttachments.js";
import { t } from "../i18n/LanguageController.js";

function mediaElement(attachment) {
  const image = attachment.kind === "image";
  const element = document.createElement(image ? "img" : attachment.kind);
  if (image) {
    element.alt = attachment.name;
  } else {
    element.controls = true;
    element.preload = "metadata";
    element.setAttribute("aria-label", attachment.name);
    if (attachment.kind === "video") element.playsInline = true;
  }
  return element;
}

function releaseElement(element) {
  if (!element) return;
  element.pause?.();
  element.removeAttribute("src");
  element.load?.();
  element.remove();
}

export class VisitorMemoryCard {
  constructor(form, { audioManager, onChange, onRead, onWrite }) {
    this.form = form;
    this.audioManager = audioManager;
    this.onChange = onChange;
    this.get = (id) => form.querySelector("#" + id);
    this.preview = this.get("memory-attachment-preview");
    this.stage = this.get("memory-preview-stage");
    this.removeButton = this.get("memory-remove-file");
    this.fileInput = this.get("memory-file");
    this.visit = this.get("memory-visit");
    this.attachment = null;
    this.pending = null;
    this.reader = null;
    this.memories = [];
    this.visible = false;

    this.attachmentButtons = form.querySelectorAll("[data-attach]");
    for (const button of this.attachmentButtons) {
      button.addEventListener("click", () => this.chooseFile(button.dataset.attach));
    }
    this.removeButton.addEventListener("click", () => {
      if (!this.editable) return;
      const kind = this.attachment.kind;
      this.cancelPending();
      this.showPreview(null);
      URL.revokeObjectURL(this.attachment.url);
      this.attachment = null;
      this.setStatus(null);
      this.onChange();
      form.querySelector('[data-attach="' + kind + '"]').focus();
    });
    this.visit.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-memory-id]");
      const memory = button && this.memories.find((item) => item.id === button.dataset.memoryId);
      if (memory && this.editable) onRead(memory);
    });
    this.get("memory-reader-back").addEventListener("click", onWrite);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stage.firstElementChild?.pause?.();
    });
  }

  get editable() {
    return this.visible && !this.reader && !this.form.dataset.submitting;
  }

  show(memory, memories) {
    this.cancelPending();
    this.pickerKind = null;
    this.visible = true;
    this.reader = memory;
    this.memories = memories;
    const reading = Boolean(memory);
    this.get("memory-editor").hidden = reading;
    this.get("memory-composer-footer").hidden = reading;
    this.get("memory-reader").hidden = !reading;
    this.get("memory-reader-back").hidden = !reading;
    this.get("memory-reader-text").textContent = memory?.text ?? "";
    this.removeButton.hidden = reading;
    this.visit.open = false;
    this.visit.hidden = memories.length === 0;
    if (!reading) this.renderVisitList();
    this.setStatus(null);
    this.showPreview(reading ? memory.attachment : this.attachment);
    this.onChange();
    this.form.scrollTop = 0;
  }

  hide() {
    this.visible = false;
    this.pickerKind = null;
    this.cancelPending();
    this.showPreview(null);
    this.reader = null;
  }

  chooseFile(kind) {
    if (!this.editable) return;
    // Give each native picker its own input so a late selection cannot target a new place.
    const input = this.fileInput.cloneNode(false);
    this.fileInput.replaceWith(input);
    this.fileInput = input;
    this.pickerKind = kind;
    input.accept = fileAcceptList(kind);
    input.addEventListener("change", () => {
      const file = input.files[0];
      input.value = "";
      if (input !== this.fileInput || this.pickerKind !== kind || !this.editable) return;
      this.pickerKind = null;
      if (file) this.checkFile(file, kind);
    }, { once: true });
    input.click();
  }

  checkFile(file, kind) {
    this.cancelPending();
    if (!matchesVisitorFile(file, kind)) {
      this.setStatus(file.size ? "invalid" : "unreadable", kind);
      this.onChange();
      return;
    }
    const attachment = Object.freeze({ kind, name: file.name, size: file.size, url: URL.createObjectURL(file) });
    const element = mediaElement(attachment);
    const candidate = { attachment, element };
    this.pending = candidate;
    this.setStatus("loading", file.name);
    this.onChange();
    const ready = () => {
      if (this.pending !== candidate) return;
      if (kind === "video" && !element.videoWidth) {
        failed();
        return;
      }
      this.pending = null;
      element.onload = element.onloadedmetadata = element.onerror = null;
      const previous = this.attachment;
      this.attachment = attachment;
      this.showPreview(attachment, element);
      if (previous) URL.revokeObjectURL(previous.url);
      this.setStatus(null);
      this.onChange();
    };
    const failed = () => {
      if (this.pending !== candidate) return;
      this.cancelPending();
      this.setStatus("unreadable");
      this.onChange();
    };
    element[kind === "image" ? "onload" : "onloadedmetadata"] = ready;
    element.onerror = failed;
    element.src = attachment.url;
  }

  cancelPending() {
    if (!this.pending) return;
    const { attachment, element } = this.pending;
    this.pending = null;
    element.onload = element.onloadedmetadata = element.onerror = null;
    releaseElement(element);
    URL.revokeObjectURL(attachment.url);
  }

  showPreview(attachment, element = null) {
    this.disconnectPlayer?.();
    this.disconnectPlayer = null;
    releaseElement(this.stage.firstElementChild);
    this.preview.hidden = !attachment;
    this.get("memory-file-name").textContent = attachment?.name ?? "";
    if (!attachment) return;
    if (!element) {
      element = mediaElement(attachment);
      element.src = attachment.url;
    }
    if (attachment.kind !== "image") {
      this.disconnectPlayer = this.audioManager.connectVisitorPlayer(element);
    }
    this.stage.append(element);
  }

  renderVisitList() {
    const rows = this.memories.map((memory) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.memoryId = memory.id;
      const kind = document.createElement("small");
      kind.dataset.i18n = "attachment." + (memory.attachment?.kind ?? "text");
      kind.textContent = t(kind.dataset.i18n);
      const name = document.createElement("span");
      name.dir = "auto";
      name.textContent = memory.attachment?.name ?? memory.text;
      button.append(kind, name);
      item.append(button);
      return item;
    });
    this.get("memory-visit-list").replaceChildren(...rows.reverse());
  }

  setStatus(key, value = "") {
    this.statusKey = key;
    this.statusValue = value;
    this.refreshLanguage();
  }

  refreshLanguage() {
    this.get("memory-attachment-verb").textContent = t(this.attachment ? "attachment.replace" : "attachment.add");
    for (const button of this.attachmentButtons) {
      const selected = this.attachment?.kind === button.dataset.attach;
      button.classList.toggle("is-attached", selected);
      button.setAttribute("aria-label", t(selected ? "attachment.replaceAction" : "attachment.action",
        { kind: t("attachment." + button.dataset.attach) }));
    }
    this.get("memory-visit-label").textContent = t("attachment.visit", { count: this.memories.length });
    const params = this.statusKey === "invalid" ? { kind: t("attachment." + this.statusValue) } : { name: this.statusValue };
    this.get("memory-file-status").textContent = this.statusKey ? t("attachment." + this.statusKey, params) : "";
  }
}

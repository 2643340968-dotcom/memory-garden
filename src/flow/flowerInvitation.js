// A storage key remembers the invitation across visits. An unkeyed invitation belongs to this visit.
const growthNames = new Set(["stand-rise", "draw-stem", "unroll-leaf", "open-calyx"]);

export class FlowerInvitation {
  constructor(dialog, storageKey, available, onChange) {
    this.dialog = dialog;
    this.storageKey = storageKey;
    this.available = available;
    this.onChange = onChange;
    this.generation = 0;
    this.seen = false;
    dialog.addEventListener("close", onChange);
    document.addEventListener("visibilitychange", onChange);
    if (!storageKey) return;
    try { this.seen = localStorage.getItem(storageKey) === "shown"; } catch { /* Use this visit. */ }
    window.addEventListener("storage", event => {
      if (event.key === storageKey && event.newValue === "shown") {
        this.seen = true;
        this.dismiss();
        onChange();
      }
    });
  }
  dismiss() {
    if (this.dialog.open) this.dialog.close();
  }
  leave({restartVisit = false} = {}) {
    this.generation++;
    this.pending = false;
    if (restartVisit && !this.storageKey) this.seen = false;
    this.dismiss();
  }
  consider(field) {
    if (this.seen || this.pending || !this.available()) return;
    const generation = this.generation;
    this.pending = true;
    const wait = async () => {
      if (generation !== this.generation) return;
      if (!this.available()) { this.pending = false; return; }
      // A resize can replace growing stems. Check their replacements on the
      // next frame after cancellation; infinite breathing must never hold the card.
      const animations = field ? field.getAnimations({subtree:true}).filter(animation =>
        growthNames.has(animation.animationName) && animation.playState !== "finished") : [];
      if (animations.length) {
        await Promise.allSettled(animations.map(animation => animation.finished));
        if (generation === this.generation) requestAnimationFrame(wait);
        return;
      }
      this.pending = false;
      if (this.seen) return;
      try {
        if (this.storageKey && localStorage.getItem(this.storageKey) === "shown") {
          this.seen = true;
          this.onChange();
          return;
        }
      } catch { /* Storage can be unavailable in a private session. */ }
      this.dialog.showModal();
      this.seen = true;
      if (this.storageKey) {
        try { localStorage.setItem(this.storageKey, "shown"); } catch { /* Remember in this tab. */ }
      }
      this.onChange();
    };
    requestAnimationFrame(wait);
  }
}

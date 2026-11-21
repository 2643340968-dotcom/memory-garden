export class MapToolbar {
  constructor(host) {
    this.host = host;
    this.grip = host.querySelector("#tools-grip");
    this.panel = host.querySelector("#toolbar-panel");
    this.guide = host.querySelector("#guide");
    this.grip.addEventListener("click", event => {
      if (event.detail && this.pulled) return;
      this.expand(!this.expanded);
    });
    this.grip.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      this.pulled = false;
      this.grip.setPointerCapture(event.pointerId);
      this.startY = event.clientY;
    });
    this.grip.addEventListener("pointermove", event => {
      if (this.startY == null || !this.grip.hasPointerCapture(event.pointerId)) return;
      const distance = event.clientY - this.startY;
      if (Math.abs(distance) < 12) return;
      this.pulled = true;
      this.expand(distance > 0);
    });
    this.grip.addEventListener("lostpointercapture", () => { this.startY = null; });
    document.addEventListener("pointerdown", event => {
      if (this.expanded && !event.target.closest(".toolbar-shell")) this.expand(false);
    });
    this.panel.addEventListener("focusout", event => {
      if (this.expanded && event.relatedTarget && !event.relatedTarget.closest(".toolbar-shell"))
        this.expand(false);
    });
  }
  setMode(mode) {
    this.host.dataset.tools = mode;
    this.grip.hidden = mode !== "map";
    this.expand(false);
  }
  expand(open) {
    this.expanded = open && this.host.dataset.tools === "map";
    this.host.classList.toggle("tools-open", this.expanded);
    this.grip.setAttribute("aria-expanded", String(this.expanded));
    this.panel.inert = this.host.dataset.tools === "map" && !this.expanded;
    if (!this.expanded) this.guide.open = false;
    this.updateLabel();
  }
  updateLabel() {
    const zh = document.documentElement.lang === "zh-CN";
    this.grip.setAttribute("aria-label", this.expanded
      ? (zh ? "收起地图工具" : "Close map tools")
      : (zh ? "展开地图工具" : "Open map tools"));
  }
}

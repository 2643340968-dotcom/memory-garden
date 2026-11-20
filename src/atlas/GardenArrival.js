import { FieldStudy } from "./FieldStudy.js";

export class GardenArrival {
  constructor(root) {
    this.root = root;
    this.view = root.closest("#garden-view");
    this.scene = this.view.querySelector("#scene");
    this.loading = root.querySelector("#garden-loading");
    this.skip = root.querySelector("#garden-arrival-skip");
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.skip.addEventListener("click", () => this.skipIntro());
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !root.hidden && !root.inert) {
        event.preventDefault();
        this.skipIntro();
      }
    });
  }

  open(id, site) {
    this.close();
    this.root.hidden = false;
    this.root.inert = false;
    this.root.classList.remove("awaiting-field");
    this.scene.inert = true;
    this.view.classList.add("is-arriving");
    this.loading.hidden = false;
    this.skip.hidden = false;
    this.skipped = false;
    this.study ??= new FieldStudy(this.root.querySelector("canvas"), { onDark: true });
    this.study.show(id, site.study, site.ink);
    this.study.setVisible(true);
    this.root.querySelector("h1").focus({ preventScroll: true });
    return new Promise(resolve => {
      this.endHold = resolve;
      this.holdTimer = setTimeout(() => this.release(), this.motion.matches ? 900 : 1700);
    });
  }

  skipIntro() {
    this.skipped = true;
    if (!this.loading.hidden) {
      this.root.classList.add("awaiting-field");
      this.study.setVisible(false);
      if (this.root.contains(document.activeElement)) this.loading.focus({ preventScroll: true });
      this.skip.hidden = true;
    }
    this.release();
  }

  release() {
    clearTimeout(this.holdTimer);
    this.endHold?.();
    this.endHold = null;
  }

  reveal() {
    this.view.classList.remove("is-arriving");
    this.scene.inert = false;
    if (this.root.contains(document.activeElement)) this.scene.focus({ preventScroll: true });
    this.root.inert = true;
    if (this.skipped || this.motion.matches) {
      this.close();
      return;
    }
    this.study.setVisible(false);
    this.fade = this.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: "ease-in-out", fill: "forwards" });
    this.fade.onfinish = () => this.close();
  }

  close() {
    this.release();
    if (this.fade) {
      this.fade.onfinish = null;
      this.fade.cancel();
      this.fade = null;
    }
    this.study?.hide();
    this.root.hidden = true;
    this.scene.inert = false;
    this.view.classList.remove("is-arriving");
  }
}

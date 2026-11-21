import {clamp, smooth} from "./geometry.js";

// Native scrolling supplies the distance, including touch inertia and reversals.
// The atlas receives wheel and pan only after this separate scroll surface ends.
export function openingPose(fraction, quiet = false) {
  const p = clamp(fraction, 0, 1), rest = 1 - smooth(p);
  return {
    title : 1 - smooth(clamp((p - .045) / .72, 0, 1)),
    wash : 1 - smooth(clamp((p - .04) / .93, 0, 1)),
    lift : quiet ? 0 : 22 * smooth(p),
    drift : quiet ? 0 : 32 * rest,
    scale : quiet ? 1 : 1 + .055 * rest,
  };
}

export class AtlasLanding {
  constructor(section, atlas, onEnter) {
    this.section = section;
    this.stage = section.parentElement;
    this.scroll = section.querySelector("#landing-scroll");
    this.control = document.getElementById("open-map");
    this.atlas = atlas;
    this.onEnter = onEnter;
    this.quiet = matchMedia("(prefers-reduced-motion: reduce)");
    this.quiet.addEventListener("change", () => {
      if (this.active)
        this.paint();
    });
    this.scroll.addEventListener("scroll", () => {
      if (!this.active)
        return;
      const length = this.scroll.scrollHeight - this.scroll.clientHeight;
      if (length <= 0)
        return;
      this.progress = clamp(this.scroll.scrollTop / length, 0, 1);
      if (this.scroll.scrollTop >= length - 1)
        this.enter(true);
      else
        this.paint();
    }, {passive : true});
    this.resize = new ResizeObserver(() => {
      if (this.active)
        this.scroll.scrollTop = this.progress * (this.scroll.scrollHeight - this.scroll.clientHeight);
    });
    this.resize.observe(this.scroll);
    this.control.onclick = () => this.enter();
    document.addEventListener("keydown", event => {
      if (!this.active || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
          document.querySelector("#guide").open ||
          event.target.closest("button,a,summary,input,textarea,dialog"))
        return;
      if ([ "Escape", "Enter", "End" ].includes(event.key)) {
        event.preventDefault();
        this.enter();
        return;
      }
      const step = {
        ArrowDown : 52,
        ArrowUp : -52,
        PageDown : this.scroll.clientHeight * .65,
        PageUp : -this.scroll.clientHeight * .65,
        " " : this.scroll.clientHeight * (event.shiftKey ? -.65 : .65),
        Home : -this.scroll.scrollHeight
      }[event.key];
      if (step != null) {
        event.preventDefault();
        this.scroll.scrollBy({top : step, behavior : this.quiet.matches ? "instant" : "smooth"});
      }
    });
    // Consume only the positive momentum left by the revealing gesture. A new
    // scroll or an opposite wheel direction goes straight to the map.
    this.atlas.root.addEventListener("wheel", event => {
      if (event.deltaY > 0 && performance.now() < this.carryUntil && !event.ctrlKey) {
        this.carryUntil = performance.now() + 150;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, {capture : true, passive : false});
  }
  open(focus = false) {
    this.active = true;
    this.progress = 0;
    this.carryUntil = 0;
    this.section.hidden = false;
    this.control.hidden = false;
    this.atlas.root.inert = true;
    this.stage.classList.add("show-opening");
    this.scroll.scrollTop = 0;
    this.paint();
    if (focus)
      this.scroll.focus({preventScroll : true});
  }
  paint() {
    const {title, wash, lift, drift, scale} = openingPose(this.progress, this.quiet.matches);
    const style = this.stage.style;
    style.setProperty("--cover-title", title);
    style.setProperty("--cover-wash", wash);
    style.setProperty("--cover-feather", 16 * (1 - smooth(this.progress)) + "%");
    style.setProperty("--cover-pins", smooth(clamp((this.progress - .36) / .50, 0, 1)));
    style.setProperty("--cover-lift", -lift + "vh");
    style.setProperty("--cover-drift", drift + "%");
    style.setProperty("--cover-scale", scale);
  }
  close() {
    if (!this.active)
      return;
    this.active = false;
    this.stage.classList.remove("show-opening");
    this.section.hidden = this.control.hidden = true;
    this.atlas.root.inert = false;
  }
  enter(fromScroll = false) {
    if (!this.active)
      return;
    const focus =
        this.section.contains(document.activeElement) || this.control === document.activeElement;
    this.close();
    this.carryUntil = fromScroll ? performance.now() + 170 : 0;
    this.onEnter();
    if (focus)
      this.atlas.root.focus({preventScroll : true});
  }
}

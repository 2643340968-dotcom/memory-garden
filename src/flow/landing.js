import {clamp, smooth} from "./geometry.js";
import {CoverFlowers} from "./coverFlowers.js";

// Native scrolling supplies the distance, including touch inertia and reversals.
// The atlas receives wheel and pan only after this separate scroll surface ends.
export function openingPose(fraction, quiet = false) {
  const p = clamp(fraction, 0, 1), zoom = smooth(p), rest = 1 - zoom;
  return {
    title : 1 - smooth(clamp((p - .025) / .57, 0, 1)),
    wash : 1 - smooth(clamp((p - .10) / .75, 0, 1)),
    lift : quiet ? 0 : 13 * zoom,
    drift : quiet ? 0 : .12 * rest,
    scale : quiet ? 1 : .46 ** rest,
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
    this.flowers = new CoverFlowers(section.querySelector("#landing-flowers"), this.quiet, this.scroll);
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
      const next = this.scroll.scrollTop >= length - 1 ? 1 : clamp(this.scroll.scrollTop / length, 0, 1);
      const forward = next > this.inputProgress;
      clearTimeout(this.snapTimer);
      // Finish a short notch visually without moving the physical scroll rail.
      // A reversal continues from the visitor's last actual input position.
      if (!(forward && this.target === 1)) this.target = next;
      if (forward && next >= .22 && this.target < 1)
        this.snapTimer = setTimeout(() => {
          this.target = 1;
          this.follow();
        }, 240);
      this.inputProgress = next;
      this.follow();
    }, {passive : true});
    this.resize = new ResizeObserver(() => {
      if (this.active)
        this.scroll.scrollTop = this.inputProgress * (this.scroll.scrollHeight - this.scroll.clientHeight);
    });
    this.resize.observe(this.scroll);
    section.querySelector("#landing-cue").onclick = () => {
      this.target = 1;
      this.follow();
    };
    this.control.onclick = () => section.querySelector("#landing-cue").click();
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
  open(focus = false, reverse = false) {
    this.active = true;
    this.target = this.inputProgress = 0;
    this.progress = reverse && !this.quiet.matches ? 1 : 0;
    this.carryUntil = 0;
    this.section.hidden = false;
    this.control.hidden = false;
    this.atlas.root.inert = true;
    this.stage.classList.add("show-opening");
    this.scroll.scrollTop = 0;
    this.flowers.open();
    this.paint();
    if (this.progress) this.follow();
    if (focus)
      this.scroll.focus({preventScroll : true});
  }
  follow() {
    if (this.frame) return;
    let last = performance.now();
    const advance = now => {
      this.frame = 0;
      if (!this.active) return;
      const dt = Math.max(0, now - last);
      last = now;
      const gain = this.quiet.matches ? 1 : 1 - Math.exp(-dt / 90);
      this.progress += (this.target - this.progress) * gain;
      if (Math.abs(this.target - this.progress) < .0015) this.progress = this.target;
      this.paint();
      if (this.target === 1 && this.progress === 1) this.enter(true);
      else if (this.progress !== this.target) this.frame = requestAnimationFrame(advance);
    };
    this.frame = requestAnimationFrame(advance);
  }
  paint() {
    const pose = openingPose(this.progress, this.quiet.matches);
    const style = this.stage.style;
    style.setProperty("--cover-title", pose.title);
    style.setProperty("--cover-wash", pose.wash);
    style.setProperty("--cover-lift", -pose.lift + "vh");
    style.setProperty("--cover-flowers", 1 - smooth(clamp((this.progress - .04) / .66, 0, 1)));
    style.setProperty("--flower-lift", (this.quiet.matches ? 0 : this.progress * 7) + "%");
    style.setProperty("--flower-zoom", this.quiet.matches ? 1 : 1 + this.progress * .16);
    this.flowers.revealMap(this.progress);
    this.atlas.setCover(pose);
  }
  close() {
    if (!this.active)
      return;
    this.active = false;
    clearTimeout(this.snapTimer);
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.flowers.close();
    this.atlas.setCover(null);
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

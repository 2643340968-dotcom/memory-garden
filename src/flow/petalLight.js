import {hash, TAU} from "./geometry.js";

export function rhythmFor(key, featured = false) {
  let seed = 7;
  for (const c of key) seed = Math.imul(31, seed) + c.charCodeAt(0);
  return {period:(featured ? 3.4 : 5.4) + hash(seed,31)*(featured ? 2.4 : 4.7),
    phase:hash(seed,17), accent:hash(seed,53)};
}
export function setPetalRhythm(node, key, featured = false) {
  const {period,phase} = rhythmFor(key, featured);
  node.style.setProperty("--petal-period", period.toFixed(2)+"s");
  node.style.setProperty("--petal-phase", (-phase*period).toFixed(2)+"s");
}
export function petalBreath(time, rhythm) {
  const t = time/rhythm.period + rhythm.phase;
  return .5 + .34*Math.sin(TAU*t) + .16*Math.sin(TAU*(1.57*t+rhythm.accent));
}

// A shuffled deck gives all visible flowers a turn before the next set starts.
// The lens, labels, hit targets and geographic positions stay fixed.
export class MapGlints {
  constructor(root, motion) {
    this.root = root;
    this.motion = motion;
    this.deck = [];
    this.shining = new Set();
    document.addEventListener("visibilitychange", () => this.sync());
    motion.addEventListener("change", () => this.sync());
  }
  show(level) {
    if (this.level === level) return;
    this.level = level;
    this.deck = [];
    this.sync();
  }
  sync() {
    clearTimeout(this.timer);
    if (!this.level || this.motion.matches || document.hidden) {
      this.deck = [];
      for (const a of this.shining) a.cancel();
      this.shining.clear();
      return;
    }
    this.timer = setTimeout(() => this.turn(), 380+Math.random()*550);
  }
  turn() {
    const visible = [...this.root.querySelectorAll(".pin:not([hidden])")];
    if (visible.length && this.root.dataset.overview !== "paper") {
      if (!this.deck.length) {
        this.deck = visible.slice();
        for (let i=this.deck.length-1; i>0; i--) {
          const j = Math.floor(Math.random()*(i+1));
          [this.deck[i],this.deck[j]] = [this.deck[j],this.deck[i]];
        }
      }
      const pin = this.deck.pop();
      if (pin.isConnected && !pin.hidden && !pin.matches(".hot,:focus-visible")) {
        const face = pin.querySelector("canvas");
        const gleam = face.animate([
          {transform:"scale(1)", filter:"brightness(1)"},
          {offset:.43, transform:"scale(1.17)", filter:"brightness(1.13) saturate(1.12) drop-shadow(0 0 3px var(--pin-ink))"},
          {transform:"scale(1)", filter:"brightness(1)"}
        ], {duration:1500+Math.random()*780, easing:"ease-in-out"});
        gleam.id = "flower-glint";
        this.shining.add(gleam);
        gleam.onfinish = gleam.oncancel = () => this.shining.delete(gleam);
      }
    }
    this.sync();
  }
}

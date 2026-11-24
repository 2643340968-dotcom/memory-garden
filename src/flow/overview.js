import {CITIES, PLACES} from "./places.js";

export const nationalMarks = Object.entries(CITIES).map(([city, data]) => {
  const site = data.places[0];
  return {id:city, city, site, name:data.name, center:data.markCenter ?? PLACES[site].center, national:true, members:[site]};
});

// Each beat belongs to a real pin, so its fall and rings track the map even during a pan.
export function arrivalScore(count, random = Math.random) {
  const order = Array.from({length:count}, (_, i) => i);
  for (let i=count-1; i>0; i--) {
    const j=Math.floor(random()*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  let beat=0;
  return order.map(index => {
    const delay=beat;
    beat += 96 + Math.round(random()*100);
    return {index,delay,fall:610+Math.round(random()*230),drift:Math.round((random()-.5)*42)};
  });
}

export class OverviewReveal {
  constructor(root, pins, motion, onReveal) {
    Object.assign(this, {root, pins, motion, onReveal});
    this.generation = 0;
    motion.addEventListener("change", () => {
      if (motion.matches && root.dataset.overview) this.reveal();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && root.dataset.overview) this.reveal();
    });
    pins.addEventListener("focusin", () => {
      if (root.dataset.overview === "rain") this.reveal();
    });
  }
  update(onMap, settled) {
    if (!onMap) { this.stop(); return; }
    const phase = this.root.dataset.overview;
    if (phase === "marks" || phase === "rain") return;
    if (this.seen || this.motion.matches || document.hidden) { this.reveal(); return; }
    this.root.dataset.overview = "paper";
    this.pins.inert = true;
    if (!settled) { clearTimeout(this.timer); this.timer = 0; return; }
    this.timer ||= setTimeout(() => this.rain(), 240);
  }
  rain() {
    const pins = [...this.pins.querySelectorAll(".national")];
    const score = arrivalScore(pins.length);
    let end = 0;
    for (const {index, delay, fall, drift} of score) {
      const style = pins[index].style;
      style.setProperty("--drop-start", delay+"ms");
      style.setProperty("--drop-flight", fall+"ms");
      style.setProperty("--impact", delay+fall+"ms");
      style.setProperty("--slant", drift+"px");
      end = Math.max(end,delay+fall);
    }
    this.seen = true;
    this.pins.inert = false;
    this.root.dataset.overview = "rain";
    const generation = this.generation;
    const landings = this.pins.getAnimations({subtree:true}).filter(a =>
      a.animationName === "city-rain" || a.animationName === "city-impact");
    if (landings.length) {
      Promise.allSettled(landings.map(a => a.finished)).then(() => {
        if (generation === this.generation) this.reveal();
      });
    } else this.timer = setTimeout(() => this.reveal(), end+1150);
  }
  reveal() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = 0;
    this.seen = true;
    this.root.dataset.overview = "marks";
    this.pins.inert = false;
    this.onReveal();
  }
  stop(reset = false) {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = 0;
    if (reset) this.seen = false;
    delete this.root.dataset.overview;
    this.pins.inert = false;
  }
}

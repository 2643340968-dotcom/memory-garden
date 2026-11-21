import { CITIES, PLACES } from "../atlas/places.js";

// City label anchors from the project's level-six OpenFreeMap / OSM charts.
// These are geographic annotations; only the five collection cities have routes.
const annotations = [
  ["kashgar", "喀什", "Kashgar", 75.9897, 39.4669],
  ["urumqi", "乌鲁木齐", "Ürümqi", 87.6132, 43.8246],
  ["lhasa", "拉萨", "Lhasa", 91.1179, 29.6546],
  ["xining", "西宁", "Xining", 101.7760, 36.6177],
  ["hohhot", "呼和浩特", "Hohhot", 111.6595, 40.8180],
  ["harbin", "哈尔滨", "Harbin", 126.6270, 45.7589],
  ["shenyang", "沈阳", "Shenyang", 123.4273, 41.8031],
  ["xian", "西安", "Xi’an", 108.9418, 34.2606],
  ["wuhan", "武汉", "Wuhan", 114.2921, 30.5788],
  ["qingdao", "青岛", "Qingdao", 120.3772, 36.0669],
  ["kunming", "昆明", "Kunming", 102.7167, 25.0396],
  ["guangzhou", "广州", "Guangzhou", 113.2594, 23.1290],
  ["haikou", "海口", "Haikou", 110.1956, 20.0456],
];

export const nationalMarks = [
  ...Object.entries(CITIES).map(([city, data]) => {
    const site = data.places[0];
    return { id: city, city, site, name: data.name, center: PLACES[site].center, national: true, members: [site] };
  }),
  ...annotations.map(([id, zh, en, lon, lat]) => ({
    id, name: [zh, en], center: [lon, lat], national: true, members: [],
  })),
];

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
  constructor(root, pins, motion) {
    Object.assign(this, {root, pins, motion});
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
    this.timer = setTimeout(() => this.reveal(), end+1150);
  }
  reveal() {
    clearTimeout(this.timer);
    this.timer = 0;
    this.seen = true;
    this.root.dataset.overview = "marks";
    this.pins.inert = false;
  }
  stop(reset = false) {
    clearTimeout(this.timer);
    this.timer = 0;
    if (reset) this.seen = false;
    delete this.root.dataset.overview;
    this.pins.inert = false;
  }
}

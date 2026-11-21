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

// Hold the unmarked paper briefly on arrival. Each flower stays dry until attended.
export class OverviewReveal {
  constructor(root, pins, motion) {
    Object.assign(this, {root, pins, motion});
  }
  update(onMap, settled) {
    if (!onMap || document.hidden) { this.stop(); return; }
    if (this.root.dataset.overview === "marks") return;
    this.root.dataset.overview = "paper";
    this.pins.inert = true;
    if (this.motion.matches) { this.reveal(); return; }
    if (!settled) { clearTimeout(this.timer); this.timer = 0; return; }
    this.timer ||= setTimeout(() => this.reveal(), 820);
  }
  reveal() {
    clearTimeout(this.timer);
    this.timer = 0;
    this.root.dataset.overview = "marks";
    this.pins.inert = false;
  }
  stop() {
    clearTimeout(this.timer);
    this.timer = 0;
    delete this.root.dataset.overview;
    this.pins.inert = false;
  }
}

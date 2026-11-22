import {CITIES as originalCities, PLACES as originalPlaces} from "../atlas/places.js";
import {cityFlowers} from "./cityFlowers.js";
import {writingPrompts} from "./writingPrompts.js";
import catalogue from "./extraPlaces.json" with {type:"json"};
export {CHINA, atlasHash} from "../atlas/places.js";

// National anchors follow the city labels on the overview chart. Local cameras fit the sites.
const cities = [
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
const addedCities = {}, addedPlaces = {};
for (const [id, zh, en, lon, lat] of cities) {
  const entries = Object.entries(catalogue).filter(([,site]) => site.city === id);
  const xs = entries.map(([,site]) => site.center[0]), ys = entries.map(([,site]) => site.center[1]);
  const west = Math.min(...xs), east = Math.max(...xs), south = Math.min(...ys), north = Math.max(...ys);
  const name = [zh,en];
  addedCities[id] = {name, markCenter:[lon,lat], places:entries.map(([site]) => site),
    center:[(west+east)/2,(south+north)/2], span:Math.max(.085,(east-west)*1.28),
    latitudeSpan:Math.max(.055,(north-south)*1.36)};
  for (const [site, data] of entries) {
    addedPlaces[site] = {...data, context:name, span:.043, latitudeSpan:.024,
      flower:cityFlowers[id].name,
      sourceUrl:"https://zh.wikipedia.org/w/index.php?oldid="+data.revision,
      loadCollection:() => import("./siteCollections.js").then(module => module.gardenFor(site))};
  }
}
export const CITIES = Object.freeze({...originalCities,...addedCities});
const places = {...originalPlaces,...addedPlaces};
for (const [id,prompt] of Object.entries(writingPrompts)) {
  places[id] = {...places[id], prompt};
}
export const PLACES = Object.freeze(places);

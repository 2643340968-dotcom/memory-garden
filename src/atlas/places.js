import { jiangdongmenArchiveUrl, PLACE_RECORDS } from "../data/placeRecords.js";
import { atlasCatalogue } from "../data/atlasCatalogue.js";
import { cityStudies, subjects, placeInk } from "./identities.js";

// WGS84, longitude first. Spans are the minimum horizontal coverage in degrees.
export const CHINA = Object.freeze({
  name: "atlas.china",
  center: [104.8, 35.7],
  span: 76,
  latitudeSpan: 41,
});

const cityEntries = {
  nanjing: {
    name: "atlas.nanjing", region: "atlas.jiangsu",
    context: "atlas.cityKicker", introduction: "atlas.cityIntro", directory: "atlas.places",
  },
  beijing: {
    name: ["北京", "Beijing"], region: ["北京", "Beijing"], context: ["中国 · 北京", "Beijing · China"],
    introduction: ["从中轴线两侧的坛庙与钟楼，读到西郊园林的湖山。", "Follow the bells and altars of the central axis out to the lakes and gardens of the western suburbs."],
  },
  dunhuang: {
    name: ["敦煌", "Dunhuang"], region: ["甘肃", "Gansu"], context: ["中国 · 甘肃", "Gansu · China"],
    introduction: ["绿洲两侧，石窟、沙丘和古关隘沿着丝路散开。", "Caves, dunes and old frontier passes stretch along the Silk Road on either side of the oasis."],
  },
  chengdu: {
    name: ["成都", "Chengdu"], region: ["四川", "Sichuan"], context: ["中国 · 四川", "Sichuan · China"],
    introduction: ["从岷江的分水处，沿平原走进成都的草堂、园林与街巷。", "Follow the waters off the plain, from Dujiangyan’s dividing levee to Chengdu’s gardens and lanes."],
  },
  quanzhou: {
    name: ["泉州", "Quanzhou"], region: ["福建", "Fujian"], context: ["中国 · 福建", "Fujian · China"],
    introduction: ["在港城的庙宇、潮水间的石桥和海边的城墙之间穿行。", "Travel between the port city’s temples, bridges across tidal water and walls of coastal stone."],
  },
};

const collectionFor = (id) => () => import("../data/placeGardens.js").then(({ getGarden }) => getGarden(id));

const mainPlaces = {
  jiangdongmen: {
    city: "nanjing", name: "atlas.jiangdongmen", region: "atlas.jianye",
    span: 0.056, latitudeSpan: 0.034,
    context: "atlas.placeKicker", introduction: "atlas.placeIntro", flower: "atlas.flower",
    motif: ["紫金草", "Zijincao"], prompt: "entry.descriptionLine1",
    sourceUrl: jiangdongmenArchiveUrl, bloomOnSubmit: true,
    loadCollection: () => import("../data/jiangdongmen.js").then((module) => module.JIANGDONGMEN),
  },
  wanchunting: {
    city: "beijing", name: ["景山万春亭", "Wanchun Pavilion"], region: ["景山公园", "Jingshan Park"],
    context: ["北京 · 景山", "Beijing · Jingshan"], motif: ["重檐", "Pavilion eaves"],
    span: 0.034, latitudeSpan: 0.019,
    introduction: ["亭子位于景山中峰。沿山路登高，城市的屋脊在中轴线两旁铺开。", "From Jingshan’s central summit, the city’s rooftops stretch out on either side of the axis."],
    prompt: ["你从亭边望见了什么？也可以写下一段登山路上的记忆。", "What caught your eye from the pavilion, or on the climb up?"],
    sourceUrl: PLACE_RECORDS.wanchunting[0].sourceUrl, loadCollection: collectionFor("wanchunting"),
  },
  mogao: {
    city: "dunhuang", name: ["莫高窟", "Mogao Caves"], region: ["大泉河西岸", "Daquan River"],
    context: ["敦煌 · 大泉河", "Dunhuang · Daquan River"], motif: ["窟龛", "Cave niches"],
    span: 0.039, latitudeSpan: 0.023,
    introduction: ["绿洲之外，洞窟开凿在河岸的崖壁上。这里留有跨越多个世纪的壁画和彩塑。", "Beyond the oasis, caves cut into the river cliff shelter centuries of murals and painted sculpture."],
    prompt: ["留下一种你记得的颜色、一段等候，或走近崖壁时的感受。", "Leave a colour you remember, a moment of waiting, or a detail from the approach to the cliff."],
    sourceUrl: PLACE_RECORDS.mogao[0].sourceUrl, loadCollection: collectionFor("mogao"),
  },
  yuzui: {
    city: "chengdu", name: ["都江堰鱼嘴", "Fish Mouth Levee"], region: ["都江堰", "Dujiangyan"],
    context: ["成都 · 都江堰", "Chengdu · Dujiangyan"], motif: ["分水", "Dividing waters"],
    span: 0.042, latitudeSpan: 0.025,
    introduction: ["狭长的分水堤伸入岷江。站在岸边，可以看见一条河从这里分为内江与外江。", "A narrow levee reaches into the Min River. From the bank, one channel can be seen dividing into two."],
    prompt: ["你记得河边的哪一种声音，或和你一起看水的人？", "What sound do you remember by the river, or who watched the water with you?"],
    sourceUrl: PLACE_RECORDS.yuzui[0].sourceUrl, loadCollection: collectionFor("yuzui"),
  },
  luoyangqiao: {
    city: "quanzhou", name: ["洛阳桥", "Luoyang Bridge"], region: ["洛阳江", "Luoyang River"],
    context: ["泉州 · 洛阳江", "Quanzhou · Luoyang River"], motif: ["石梁", "Stone spans"],
    span: 0.038, latitudeSpan: 0.022,
    introduction: ["石梁一跨接一跨，将洛阳江两岸连在一起。这里的潮水、桥墩与过桥的人共享一段路。", "Stone spans link the two banks of the Luoyang River. Tides pass the piers beneath the old crossing."],
    prompt: ["走过石桥时，你记住了潮水、脚步声，还是对岸的景色？", "What stayed with you as you crossed: the tide, the sound of footsteps, or the far bank?"],
    sourceUrl: PLACE_RECORDS.luoyangqiao[0].sourceUrl, loadCollection: collectionFor("luoyangqiao"),
  },
};

const places = {};
for (const [id, site] of Object.entries(mainPlaces)) {
  places[id] = { ...site, study: site.city, center: cityStudies[site.city].center, ink: cityStudies[site.city].ink };
}
for (const { page, city, name, center, study, note } of atlasCatalogue) {
  const id = "p" + page;
  const subject = subjects[study];
  places[id] = {
    city, name, center, study, ink: placeInk(city, study), context: cityEntries[city].name,
    motif: subject.name, introduction: note, prompt: subject.prompt, span: 0.043, latitudeSpan: 0.024,
    sourceUrl: PLACE_RECORDS[id][0].sourceUrl, loadCollection: collectionFor(id),
  };
}
export const PLACES = Object.freeze(places);
export const CITIES = Object.fromEntries(Object.entries(cityEntries).map(([id, city]) => {
  const ids = Object.keys(places).filter((key) => places[key].city === id);
  const xs = ids.map((key) => places[key].center[0]);
  const ys = ids.map((key) => places[key].center[1]);
  const west = Math.min(...xs), east = Math.max(...xs), south = Math.min(...ys), north = Math.max(...ys);
  return [id, { ...city, places: ids, ink: cityStudies[id].ink,
    center: [(west + east) / 2, (south + north) / 2],
    span: Math.max(0.12, (east - west) * 1.28), latitudeSpan: Math.max(0.09, (north - south) * 1.36) }];
}));

export function readAtlasRoute(hash) {
  const parts = hash.replace(/^#\/?/, "").split("/");
  const [layer, city, place] = parts;
  if (parts.length <= 3 && Object.hasOwn(CITIES, city)) {
    if (layer === "atlas" && !place) return { level: "city", city };
    if (Object.hasOwn(PLACES, place) && PLACES[place].city === city) {
      if (layer === "atlas" || layer === "garden") {
        return { level: layer === "garden" ? "garden" : "place", city, place };
      }
    }
  }
  return { level: "country" };
}

export function atlasHash({ level, city, place }) {
  if (level === "country") return "#atlas";
  if (level === "city") return `#atlas/${city}`;
  return `#${level === "garden" ? "garden" : "atlas"}/${city}/${place}`;
}

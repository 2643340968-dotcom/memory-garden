import { jiangdongmenArchiveUrl, PLACE_RECORDS } from "../data/placeRecords.js";

// WGS84, longitude first. Spans are the minimum horizontal coverage in degrees.
export const CHINA = Object.freeze({
  name: "atlas.china",
  center: [104.8, 35.7],
  span: 76,
  latitudeSpan: 41,
});

export const CITIES = Object.freeze({
  nanjing: {
    name: "atlas.nanjing", region: "atlas.jiangsu",
    context: "atlas.cityKicker", introduction: "atlas.cityIntro", directory: "atlas.places",
    center: [118.78, 32.056], span: 0.34, latitudeSpan: 0.19,
    places: ["jiangdongmen"],
  },
  beijing: {
    name: ["北京", "Beijing"], region: ["北京", "Beijing"], context: ["中国 · 北京", "Beijing · China"],
    introduction: ["沿北京中轴线向北，在景山的山脊上找到万春亭。", "Follow Beijing’s Central Axis to the pavilion on the summit of Jingshan."],
    center: [116.394, 39.918], span: 0.30, latitudeSpan: 0.16, places: ["wanchunting"],
  },
  dunhuang: {
    name: ["敦煌", "Dunhuang"], region: ["甘肃", "Gansu"], context: ["中国 · 甘肃", "Gansu · China"],
    introduction: ["从敦煌绿洲转向东南，莫高窟沿大泉河西岸的崖壁展开。", "South-east of the Dunhuang oasis, cave temples line the cliff above the Daquan River."],
    center: [94.733, 40.093], span: 0.67, latitudeSpan: 0.33, places: ["mogao"],
  },
  chengdu: {
    name: ["成都", "Chengdu"], region: ["四川", "Sichuan"], context: ["中国 · 四川", "Sichuan · China"],
    introduction: ["成都平原的西北边缘，岷江在都江堰分流。", "At the north-western edge of the Chengdu Plain, the Min River divides at Dujiangyan."],
    center: [103.84, 30.83], span: 1.25, latitudeSpan: 0.71, places: ["yuzui"],
  },
  quanzhou: {
    name: ["泉州", "Quanzhou"], region: ["福建", "Fujian"], context: ["中国 · 福建", "Fujian · China"],
    introduction: ["从泉州古城向东北，在洛阳江入海一带寻找古石桥。", "North-east of the old city, a stone bridge crosses the tidal Luoyang River."],
    center: [118.636, 24.920], span: 0.36, latitudeSpan: 0.21, places: ["luoyangqiao"],
  },
});

const collectionFor = (id) => () => import("../data/placeGardens.js").then(({ gardens }) => gardens[id]);

export const PLACES = Object.freeze({
  jiangdongmen: {
    city: "nanjing", name: "atlas.jiangdongmen", region: "atlas.jianye",
    // Memorial Hall site anchor, Wikidata Q32391.
    center: [118.73659, 32.03759], span: 0.056, latitudeSpan: 0.034,
    context: "atlas.placeKicker", introduction: "atlas.placeIntro", flower: "atlas.flower",
    motif: ["紫金草", "Zijincao"], prompt: "entry.descriptionLine1",
    sourceUrl: jiangdongmenArchiveUrl, bloomOnSubmit: true,
    loadCollection: () => import("../data/jiangdongmen.js").then((module) => module.JIANGDONGMEN),
  },
  wanchunting: {
    city: "beijing", name: ["景山万春亭", "Wanchun Pavilion"], region: ["景山公园", "Jingshan Park"],
    context: ["北京 · 景山", "Beijing · Jingshan"], motif: ["重檐", "Pavilion eaves"],
    center: [116.39045, 39.92352], span: 0.034, latitudeSpan: 0.019,
    introduction: ["亭子位于景山中峰。沿山路登高，城市的屋脊在中轴线两旁铺开。", "From Jingshan’s central summit, the city’s rooftops stretch out on either side of the axis."],
    prompt: ["你从亭边望见了什么？也可以写下一段登山路上的记忆。", "What caught your eye from the pavilion, or on the climb up?"],
    sourceUrl: PLACE_RECORDS.wanchunting[0].sourceUrl, loadCollection: collectionFor("wanchunting"),
  },
  mogao: {
    city: "dunhuang", name: ["莫高窟", "Mogao Caves"], region: ["大泉河西岸", "Daquan River"],
    context: ["敦煌 · 大泉河", "Dunhuang · Daquan River"], motif: ["窟龛", "Cave niches"],
    center: [94.80417, 40.03722], span: 0.039, latitudeSpan: 0.023,
    introduction: ["绿洲之外，洞窟开凿在河岸的崖壁上。这里留有跨越多个世纪的壁画和彩塑。", "Beyond the oasis, caves cut into the river cliff shelter centuries of murals and painted sculpture."],
    prompt: ["留下一种你记得的颜色、一段等候，或走近崖壁时的感受。", "Leave a colour you remember, a moment of waiting, or a detail from the approach to the cliff."],
    sourceUrl: PLACE_RECORDS.mogao[0].sourceUrl, loadCollection: collectionFor("mogao"),
  },
  yuzui: {
    city: "chengdu", name: ["都江堰鱼嘴", "Fish Mouth Levee"], region: ["都江堰", "Dujiangyan"],
    context: ["成都 · 都江堰", "Chengdu · Dujiangyan"], motif: ["分水", "Dividing waters"],
    center: [103.6040, 31.0090], span: 0.042, latitudeSpan: 0.025,
    introduction: ["狭长的分水堤伸入岷江。站在岸边，可以看见一条河从这里分为内江与外江。", "A narrow levee reaches into the Min River. From the bank, one channel can be seen dividing into two."],
    prompt: ["你记得河边的哪一种声音，或和你一起看水的人？", "What sound do you remember by the river, or who watched the water with you?"],
    sourceUrl: PLACE_RECORDS.yuzui[0].sourceUrl, loadCollection: collectionFor("yuzui"),
  },
  luoyangqiao: {
    city: "quanzhou", name: ["洛阳桥", "Luoyang Bridge"], region: ["洛阳江", "Luoyang River"],
    context: ["泉州 · 洛阳江", "Quanzhou · Luoyang River"], motif: ["石梁", "Stone spans"],
    center: [118.6762, 24.9545], span: 0.038, latitudeSpan: 0.022,
    introduction: ["石梁一跨接一跨，将洛阳江两岸连在一起。这里的潮水、桥墩与过桥的人共享一段路。", "Stone spans link the two banks of the Luoyang River. Tides pass the piers beneath the old crossing."],
    prompt: ["走过石桥时，你记住了潮水、脚步声，还是对岸的景色？", "What stayed with you as you crossed: the tide, the sound of footsteps, or the far bank?"],
    sourceUrl: PLACE_RECORDS.luoyangqiao[0].sourceUrl, loadCollection: collectionFor("luoyangqiao"),
  },
});

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

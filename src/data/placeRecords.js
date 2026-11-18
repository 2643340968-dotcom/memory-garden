// Newly written catalogue text, in Chinese and English. No visitor testimony is supplied for these sites.
const worldHeritage = "UNESCO World Heritage Centre";
const pavilion = "https://english.beijing.gov.cn/specials/parktours/guidevisitors/jingshanpark/mustsee/202301/t20230111_2896685.html";
const mogao = "https://whc.unesco.org/en/list/440/";
const irrigation = "https://whc.unesco.org/en/list/1001/";
export const jiangdongmenArchiveUrl = "https://www.unesco.org/en/memory-world/documents-nanjing-massacre";

export const PLACE_RECORDS = {
  wanchunting: [
    { id: "wanchun-summit", source: "北京市人民政府 / Beijing Government", sourceUrl: pavilion,
      zh: "万春亭建于清乾隆十五年（1750年），位于景山中峰。它坐落在北京南北中轴线上，是登高观察这座城市的一处位置。",
      en: "Built in 1750 on the central summit of Jingshan, Wanchun Pavilion stands on Beijing’s north–south axis." },
    { id: "wanchun-axis", source: worldHeritage, sourceUrl: "https://whc.unesco.org/en/list/1714/",
      zh: "景山是北京中轴线的组成部分。2024年，这组由宫苑、公共建筑与道路遗存构成的城市建筑群列入《世界遗产名录》。",
      en: "Jingshan forms part of Beijing’s Central Axis, inscribed on the World Heritage List in 2024. Gardens, public buildings and traces of roads mark its course." },
  ],
  mogao: [
    { id: "mogao-cliff", source: worldHeritage, sourceUrl: mogao,
      zh: "莫高窟的开凿始于公元366年。崖壁上的洞窟保存了不同时期的壁画和彩塑，记录了丝绸之路上长期的文化交流。",
      en: "Work at Mogao began in AD 366. Murals and painted sculptures in the cliff record many centuries of cultural exchange along the Silk Road." },
    { id: "mogao-care", source: worldHeritage, sourceUrl: mogao,
      zh: "莫高窟于1987年列入《世界遗产名录》。保护工作既涉及洞窟与壁画，也涉及环绕崖壁的环境。",
      en: "Mogao was inscribed on the World Heritage List in 1987. Conservation extends from the caves and their murals to the landscape around the cliff." },
  ],
  yuzui: [
    { id: "yuzui-river", source: worldHeritage, sourceUrl: irrigation,
      zh: "都江堰灌溉系统始建于公元前3世纪。鱼嘴分水堤让岷江分流，是这一水利系统的主要工程之一。",
      en: "Construction of Dujiangyan began in the third century BC. Its dividing levee is one of the principal works that direct the waters of the Min River." },
    { id: "yuzui-plain", source: worldHeritage, sourceUrl: irrigation,
      zh: "都江堰至今仍为成都平原分配水源。它在日常灌溉中延续的作用，也是这处世界遗产受到保护的原因。",
      en: "Dujiangyan still distributes water to farmland on the Chengdu Plain. Its continuing role in daily irrigation is part of the heritage preserved here." },
  ],
  luoyangqiao: [
    { id: "luoyang-crossing", source: worldHeritage, sourceUrl: "https://whc.unesco.org/en/list/1561/",
      zh: "在宋元泉州的海上贸易网络里，桥梁与码头相互配合。洛阳桥是这座港口城市交通遗存中的一处。",
      en: "Bridges and docks worked together in the trade network of Song–Yuan Quanzhou. Luoyang Bridge survives as part of the port city’s transport heritage." },
    { id: "luoyang-register", source: worldHeritage, sourceUrl: "https://whc.unesco.org/en/list/1561/multipleelements/",
      zh: "2021年，洛阳桥作为“泉州：宋元中国的世界海洋商贸中心”的组成遗产点列入《世界遗产名录》。",
      en: "In 2021 Luoyang Bridge entered the World Heritage List as a component of Quanzhou’s Song–Yuan maritime trading centre." },
  ],
};

export const recordChineseText = Object.fromEntries(
  Object.values(PLACE_RECORDS).flat().map((record) => [record.id, record.zh]),
);

// Positions and petal lengths are expressed in units of a whole flower's radius.
const whorl = (petals, length, width, shape, rotation = 0) => ({petals, length, width, shape, rotation});

const florets = {
  lilac: [
    [0, -.68, .24, 0], [-.20, -.42, .32, 15], [.21, -.40, .34, 45],
    [-.38, -.10, .34, 0], [0, -.04, .43, 30], [.40, -.06, .34, 0],
    [-.34, .30, .38, 30], [.38, .31, .36, 45], [.03, .49, .39, 0],
  ],
  jacaranda: [[-.36, -.26, .51, 15], [.33, -.32, .48, 65], [.44, .25, .32, 25], [-.10, .36, .57, -35]],
  coral: [
    [-.26, .60, .66, -132], [-.25, .60, .77, -39], [-.12, .30, .73, -128], [-.11, .28, .75, -37],
    [.02, -.02, .62, -121], [.03, -.04, .66, -40], [.13, -.31, .49, -111], [.14, -.33, .51, -49],
    [.20, -.54, .38, -82],
  ],
};

// From the luminous petal base through its shoulder to its coloured lip.
// The lower lip and the small botanical centre have independent inks.
const form = (root, mid, tip, hem, heart, whorls, centre, cluster) =>
  ({root, mid, tip, hem, heart, whorls, centre, florets: florets[cluster]});

export const forms = {
  nanjing: form("#fff4cd", "#ebd7db", "#c7acd4", "#a78bbf", "#e0b65d",
    [whorl(4, 1, .42, "spoon", 45)], "cross"),
  beijing: form("#fff3c9", "#f9d6bd", "#ef9bb4", "#ce75a4", "#91bfa5",
    [whorl(8, .99, .44, "round", -90), whorl(6, .77, .44, "oval", -60), whorl(4, .50, .34, "cup", -45)], "pollen"),
  dunhuang: form("#fff4c7", "#e6e7c6", "#afd4bc", "#a3b6b7", "#77b49f",
    [whorl(8, 1, .33, "point", -90), whorl(8, .71, .27, "point", -67.5)], "pod"),
  chengdu: form("#fff3c8", "#f7d9ca", "#eea9bc", "#d685aa", "#d5879b",
    [whorl(5, 1, .62, "fan", -90)], "column"),
  quanzhou: form("#fff0c3", "#f9c19d", "#f28e94", "#df7389", "#eeb5a2",
    [whorl(1, 1, .32, "keel"), whorl(1, .65, .18, "cup", 17)], "base", "coral"),
  kashgar: form("#fff6d5", "#f9dfcd", "#f2bdb8", "#dfa0b3", "#d79877",
    [whorl(5, .96, .46, "oval", -54)], "threads"),
  urumqi: form("#fff0cd", "#f5c6d2", "#e999b9", "#cb75a3", "#b887ac",
    [whorl(10, .97, .30, "ruffle", -90), whorl(8, .70, .29, "cup", -67.5), whorl(5, .42, .26, "round", -90)], "button"),
  lhasa: form("#fff0bd", "#f3d2d6", "#dea7c9", "#bd8cbb", "#e8b657",
    [whorl(8, 1, .32, "notch", -67.5)], "disc"),
  xining: form("#fff4c7", "#ffdfaa", "#efba86", "#e7a2a0", "#ba8d9c",
    [whorl(3, 1, .56, "lance", -90), whorl(3, .84, .55, "cup", -30)], "six"),
  hohhot: form("#fff3c6", "#f1e2cf", "#e3c6cd", "#c8a9bf", "#d9a753",
    [whorl(5, .99, .55, "ruffle", -90)], "brush"),
  harbin: form("#fff5cc", "#e8d8df", "#c7afd3", "#ac8dbc", "#e1c282",
    [whorl(4, .98, .45, "floret", 45)], "eye", "lilac"),
  shenyang: form("#fff0c0", "#f7d1c1", "#e899b3", "#c775a0", "#c87c99",
    [whorl(5, .98, .63, "fold", -90), whorl(5, .75, .51, "fold", -54), whorl(4, .53, .38, "fold", -19),
     whorl(3, .31, .24, "fold", 17)], "coil"),
  xian: form("#fff1c4", "#f8c9a3", "#ed9a99", "#dc7e90", "#c98577",
    [whorl(6, 1, .21, "calyx", -90), whorl(6, .86, .44, "ruffle", -60)], "pollen"),
  wuhan: form("#fff5cd", "#f7dece", "#eeb6cd", "#d78fae", "#d99c79",
    [whorl(5, .96, .49, "round", -90)], "threads"),
  qingdao: form("#fff0c3", "#f7ccb7", "#e896a5", "#ce7e98", "#d6a356",
    [whorl(5, .99, .59, "cup", -90), whorl(5, .72, .41, "oval", -54)], "brush"),
  kunming: form("#fff1cf", "#e4dae0", "#c1b3d6", "#9b96c1", "#f3d492",
    [whorl(5, 1, .54, "mouth", -90)], "throat", "jacaranda"),
  guangzhou: form("#fff1bf", "#fbd2a7", "#f0a28d", "#de869b", "#c58880",
    [whorl(5, 1, .46, "curl", -54)], "bundles"),
  haikou: form("#fff1c9", "#f2cbd4", "#e9a0be", "#cc80ad", "#a4c5a8",
    [whorl(3, 1, .59, "bract", -90)], "bracts"),
};

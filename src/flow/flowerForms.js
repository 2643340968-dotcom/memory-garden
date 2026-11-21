// Length and half-width are in units of specimen radius. Within a whorl
// every petal has the same silhouette and occupies one equal angular step.
const whorl = (petals, length, width, shape, rotation = 0) => ({petals, length, width, shape, rotation});

// Each floret has a centre, relative size and orientation in the spray.
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
const form = (root, mid, tip, heart, whorls, centre, cluster) =>
  ({root, mid, tip, heart, whorls, centre, florets: florets[cluster]});

export const forms = {
  nanjing: form("#8d6fdd", "#a590f8", "#bbcdff", "#ffed8a",
    [whorl(4, 1, .35, "spoon", 45)], "cross"),
  beijing: form("#e1699d", "#fd96bf", "#ffdfda", "#ffd690",
    [whorl(9, .98, .39, "ruffle", -90), whorl(9, .74, .31, "ruffle", -70), whorl(6, .48, .26, "fold", -90)], "pollen"),
  dunhuang: form("#65b1ad", "#8ed4c1", "#dfe9c0", "#edcf71",
    [whorl(8, 1, .245, "point", -90), whorl(8, .70, .21, "point", -67.5)], "pod"),
  chengdu: form("#df82b0", "#f8b9d8", "#ffece3", "#ffdf8c",
    [whorl(5, 1, .53, "fan", -90)], "column"),
  quanzhou: form("#e5484c", "#ff6649", "#ffa97b", "#f58648",
    [whorl(1, 1, .265, "keel"), whorl(1, .61, .13, "point", 18)], "base", "coral"),
  kashgar: form("#f09792", "#ffcbba", "#fef0d7", "#f7ba5d",
    [whorl(5, .95, .42, "oval", -54)], "threads"),
  urumqi: form("#dc6fb0", "#f77dc4", "#ffc4dc", "#ffdb9f",
    [whorl(10, .96, .29, "ruffle", -90), whorl(10, .71, .23, "oval", -72), whorl(6, .43, .19, "ruffle", -90)], "button"),
  lhasa: form("#bb6ac3", "#ef91d0", "#facde8", "#f6be2d",
    [whorl(8, .99, .254, "notch", -67.5)], "disc"),
  xining: form("#f2a640", "#ffc75b", "#ffe9a0", "#e99a2a",
    [whorl(3, 1, .49, "lance", -90), whorl(3, .85, .49, "cup", -30)], "six"),
  hohhot: form("#a2bda3", "#dbe4bd", "#ffefd3", "#f6b54e",
    [whorl(5, .99, .44, "ruffle", -90), whorl(5, .80, .40, "fan", -54)], "brush"),
  harbin: form("#a07cd8", "#ba98ef", "#ddcbfa", "#ffecc1",
    [whorl(4, .98, .38, "floret", 45)], "eye", "lilac"),
  shenyang: form("#d7679d", "#f778a9", "#ffbfcc", "#ef8aaa",
    [whorl(5, .98, .57, "fold", -90), whorl(5, .76, .45, "fold", -54), whorl(4, .53, .32, "fold", -18),
     whorl(3, .35, .24, "fold", 18), whorl(3, .20, .15, "fold", 78)], "coil"),
  xian: form("#e66750", "#ff7c56", "#ffb68a", "#fab647",
    [whorl(6, .98, .17, "calyx", -90), whorl(6, .84, .37, "ruffle", -60)], "pollen"),
  wuhan: form("#dc84a8", "#f7a0d0", "#ffd6eb", "#fabb55",
    [whorl(5, .93, .43, "round", -90)], "threads"),
  qingdao: form("#cd5576", "#f56c86", "#ffb1ae", "#faca5d",
    [whorl(5, .98, .49, "cup", -90), whorl(5, .76, .37, "oval", -54)], "brush"),
  kunming: form("#8078d4", "#9f98fb", "#c7d4ff", "#f7e3a9",
    [whorl(5, 1, .54, "mouth", -90)], "throat", "jacaranda"),
  guangzhou: form("#ee6845", "#ff9056", "#ffbb77", "#c97451",
    [whorl(5, 1, .36, "curl", -54)], "bundles"),
  haikou: form("#d66ab7", "#f47acd", "#ffb6e1", "#feeea3",
    [whorl(3, 1, .52, "bract", -90)], "bracts"),
};

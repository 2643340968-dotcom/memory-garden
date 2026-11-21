// A whorl is drawn face up. Length and half-width are relative to the
// specimen radius, and rotation is in degrees. The same drawing feeds the
// city book, travelling contours and contact mask.
const whorl = (petals, length, width, shape, rotation = 0) => ({petals, length, width, shape, rotation});
const florets = {
  lilac: [[-.39,-.27,.43,12],[.14,-.53,.36,44],[.52,-.18,.34,-9],[-.02,-.09,.47,68],
          [-.51,.16,.30,22],[.31,.24,.39,30],[-.14,.49,.38,-14],[.19,.71,.20,48]],
  jacaranda: [[-.36,-.24,.51,10],[.34,-.27,.47,62],[-.08,.38,.58,-45],[.46,.32,.28,22]],
  coral: [[-.31,.57,.57,-95],[-.05,.48,.76,-35],[-.17,.18,.74,-132],[.12,.02,.77,-40],
          [.13,-.20,.64,-117],[.21,-.39,.54,-43],[.21,-.54,.39,-90]],
};
const form = (root, mid, tip, heart, whorls, centre, cluster) =>
  ({root, mid, tip, heart, whorls, centre, florets:florets[cluster]});

export const forms = {
  nanjing: form("#8c75d1","#a99bea","#c1d0fa","#fff1a1",
    [whorl(4,1,.31,"spoon",35)],"cross"),
  beijing: form("#d8739d","#f4a5c3","#ffe3df","#ffdb9d",
    [whorl(9,.96,.43,"ruffle",7),whorl(8,.74,.34,"ruffle",31),whorl(6,.48,.25,"fold",12)],"pollen"),
  dunhuang: form("#72afac","#a2d5c7","#e3ebc9","#ecd388",
    [whorl(8,.99,.25,"point",-90),whorl(8,.68,.21,"point",-67.5)],"pod"),
  chengdu: form("#d789af","#f4c4db","#fff0e9","#ffe39c",
    [whorl(5,1,.56,"fan",-78)],"column"),
  quanzhou: form("#d95857","#f67960","#ffad82","#ed9160",
    [whorl(1,1,.24,"keel"),whorl(1,.62,.12,"point",19)],"base","coral"),
  kashgar: form("#e89d98","#fbd4c7","#fff3df","#f3c077",
    [whorl(5,.94,.43,"oval",-81)],"threads"),
  urumqi: form("#d478ad","#ed90c4","#ffc9df","#ffdfab",
    [whorl(10,.96,.31,"ruffle",-15),whorl(8,.70,.27,"oval",8),whorl(7,.45,.20,"ruffle",-26)],"eye"),
  lhasa: form("#b572bc","#e8a0cf","#f8d3e9","#f2c45c",
    [whorl(8,1,.25,"notch",12)],"disc"),
  xining: form("#eaaa5b","#ffce73","#ffecae","#e3a251",
    [whorl(3,1,.44,"point",-88),whorl(3,.81,.46,"cup",-28)],"six"),
  hohhot: form("#a6bca7","#e1e8cb","#fff2dc","#f1bc6c",
    [whorl(5,.99,.45,"ruffle",-55),whorl(4,.79,.40,"fan",17)],"brush"),
  harbin: form("#a48ed0","#c5afea","#e5d6fa","#fff0cd",
    [whorl(4,1,.35,"point",20)],"eye","lilac"),
  shenyang: form("#ce709c","#ec8bae","#ffc4cf","#e995ae",
    [whorl(5,.97,.54,"fold",-80),whorl(5,.76,.44,"fold",-39),whorl(4,.56,.32,"fold",-7),
     whorl(3,.36,.25,"fold",34),whorl(2,.21,.15,"fold",84)],"coil"),
  xian: form("#dc715d","#fa906d","#ffc099","#f5bd68",
    [whorl(6,.98,.18,"point",-60),whorl(6,.86,.37,"ruffle",-33)],"pollen"),
  wuhan: form("#d58aa8","#f0aed1","#ffdbed","#f5c172",
    [whorl(5,.94,.40,"round",-91)],"threads"),
  qingdao: form("#c45f79","#e98191","#ffb6b3","#f7cf7a",
    [whorl(5,.98,.5,"cup",-82),whorl(5,.75,.36,"oval",-46)],"brush"),
  kunming: form("#817cc9","#a5a2ed","#ccd7fc","#f7e7b8",
    [whorl(5,1,.55,"mouth",20)],"throat","jacaranda"),
  guangzhou: form("#de7957","#ffa365","#ffcc88","#df855f",
    [whorl(5,1,.34,"curl",-68)],"column"),
  haikou: form("#d27eb7","#ed9cd0","#f9c9e4","#fff2b5",
    [whorl(3,1,.46,"bract",-82)],"bracts"),
};

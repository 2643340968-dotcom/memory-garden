// Exhibition inks and studies are drawn from each site's motif.
export const cityStudies = {
  nanjing: { site: "jiangdongmen", name: ["江东门", "Jiangdongmen"], center: [118.73659, 32.03759], ink: "#79548a" },
  beijing: { site: "wanchunting", name: ["景山万春亭", "Wanchun Pavilion"], center: [116.39045, 39.92352], ink: "#a94a33" },
  dunhuang: { site: "mogao", name: ["莫高窟", "Mogao Caves"], center: [94.80417, 40.03722], ink: "#a46521" },
  chengdu: { site: "yuzui", name: ["都江堰鱼嘴", "Fish Mouth Levee"], center: [103.604, 31.009], ink: "#367253" },
  quanzhou: { site: "luoyangqiao", name: ["洛阳桥", "Luoyang Bridge"], center: [118.6762, 24.9545], ink: "#316d86" },
};
export const subjects = {
  water: { name: ["水纹", "Ripples"], ink: "#337877", prompt: ["水边的哪种声音或颜色留在了你的记忆里？", "What sound or colour do you remember from the water’s edge?"] },
  ridge: { name: ["山脊", "Ridgeline"], ink: "#80703e", prompt: ["在这里抬头或回望时，你看到过什么？", "What do you remember seeing when you looked up or turned back?"] },
  stone: { name: ["石刻", "Cut stone"], ink: "#746354", prompt: ["哪一处刻痕、文字或停留的片刻让你记得这里？", "What inscription, mark or moment of stillness stayed with you?"] },
  gate: { name: ["城门", "Gateway"], ink: "#a35a3e", prompt: ["从门的一侧走向另一侧时，什么发生了变化？", "What changed as you passed from one side of the gate to the other?"] },
  hall: { name: ["檐影", "Roofline"], ink: "#96513c", prompt: ["你记得走进院落时的光线、脚步，还是一起同行的人？", "Do you remember the light in a courtyard, your footsteps, or the person beside you?"] },
  book: { name: ["书页", "Folio"], ink: "#466d77", prompt: ["哪件展品、哪一页书，或哪次来访让你想起这里？", "Which object, page or visit brings this place to mind?"] },
  sky: { name: ["星环", "Celestial rings"], ink: "#536688", prompt: ["从这里望向天空时，你想起了什么？", "What came to mind when you looked up at the sky here?"] },
  tower: { name: ["层楼", "Storeys"], ink: "#9a633d", prompt: ["走近或离开时，你从哪一个方向看到这座楼塔？", "From which direction do you remember seeing the tower?"] },
  grove: { name: ["枝叶", "Branches"], ink: "#557746", prompt: ["你记得园中哪个季节，或曾经在哪一处停下来？", "Which season do you remember in the garden, or where did you stop?"] },
  bridge: { name: ["桥跨", "Bridge spans"], ink: "#467781", prompt: ["过桥时，你记住了桥下的水，还是对岸的人和景？", "What stayed with you when you crossed, the water below or the far bank?"] },
  lane: { name: ["街巷", "Lanes"], ink: "#9b614a", prompt: ["这条街的哪一个拐角、声音或气味最让你难忘？", "Which turn, sound or smell do you remember most from the street?"] },
};
export function mixInk(first, second, weight) {
  let hex = "#";
  for (let i = 1; i < 7; i += 2) {
    const a = parseInt(first.slice(i, i + 2), 16);
    const b = parseInt(second.slice(i, i + 2), 16);
    hex += Math.round(a + (b - a) * weight).toString(16).padStart(2, "0");
  }
  return hex;
}
export function placeInk(city, study) {
  return subjects[study] ? mixInk(cityStudies[city].ink, subjects[study].ink, 0.72) : cityStudies[city].ink;
}

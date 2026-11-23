// Optional asset-authoring step (sharp). Web builds use the checked-in prints.
const path = require("node:path");
const {readdir} = require("node:fs/promises");
const sharp = require("sharp");

async function print() {
  const folder = path.join(__dirname, "../public/assets/flow-flowers/upright");
  for (const name of (await readdir(folder)).filter(file => file.endsWith(".svg")).sort()) {
    const source = path.join(folder, name);
    await sharp(source, {density:216})
      .webp({quality:94, alphaQuality:100, effort:5})
      .toFile(source.replace(/\.svg$/, ".webp"));
  }
}

print().catch(error => { console.error(error); process.exitCode = 1; });

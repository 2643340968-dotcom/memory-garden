"""Build the original botanical display face and subset Noto Sans SC for the interface."""
import argparse
from pathlib import Path
import subprocess

from fontTools import subset
from fontTools.ttLib import TTFont
from vine_lettering import build_wordmarks

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/flow/fonts"


def catalogue_names():
    query = """
import {CITIES, PLACES} from './src/flow/places.js';
import {cityFlowers} from './src/flow/cityFlowers.js';
const places = [...Object.values(CITIES), ...Object.values(PLACES), ...Object.values(cityFlowers)];
console.log(places.map(place => place.name[0]).join(''));
"""
    return subprocess.check_output(["node", "--input-type=module", "-e", query], cwd=ROOT, encoding="utf-8")


def build(source, name, text):
    font = TTFont(source,recalcTimestamp=False)
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    options.layout_features = ["locl", "kern", "mark", "mkmk"]
    cutter = subset.Subsetter(options=options)
    cutter.populate(text=text)
    cutter.subset(font)
    # Preserve upstream notices. Give the modified subsets their own family names.
    names = font["name"]
    for record in names.names:
        parts = {1:name, 2:"Regular", 3:name+"-Web", 4:name, 6:name.replace(" ",""), 16:name, 17:"Regular"}
        if record.nameID in parts:
            record.string = parts[record.nameID].encode(record.getEncoding())
    font.flavor = "woff2"
    filename = OUT / (name.lower().replace(" ", "-") + ".woff2")
    font.save(filename)
    print(f"{filename.name}: {len(font.getBestCmap())} glyph mappings, {filename.stat().st_size} bytes")


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("noto_sans_sc_vf", type=Path)
    files = args.parse_args()
    names = catalogue_names()
    ui = "".join((ROOT / file).read_text(encoding="utf-8") for file in [
        "flow.html", "src/flow/main.js", "src/flow/atlas.js", "src/flow/flowerBook.js",
        "src/flow/garden.js", "src/i18n/LanguageController.js"
    ])
    punctuation = "".join(chr(i) for i in range(32, 127)) + "，。、“”《》＋－：；·！？（）年月日"
    OUT.mkdir(parents=True, exist_ok=True)
    build_wordmarks(OUT / "flow-vine.woff2")
    build(files.noto_sans_sc_vf, "Flow Sans", names + ui + punctuation)


if __name__ == "__main__":
    main()

"""Build the self-hosted atlas from Natural Earth and the OpenFreeMap snapshot.

Usage: python scripts/build-atlas-vectors.py --sources PATH --fetch
Requires Pillow, NumPy, Shapely 2.1+ and mapbox-vector-tile. The sources directory
contains admin_0_countries.json, admin_1_states_provinces_lines.json,
rivers_lake_centerlines.json and the Natural Earth GRAY_50M_SR_W relief.zip.
"""
import argparse
import gzip
import hashlib
import io
import json
import math
import time
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from shapely import transform
from PIL import Image, ImageFilter
from mapbox_vector_tile.Mapbox import vector_tile_pb2
from shapely.geometry import LineString, box, shape
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / "src/atlas/maps"
OUTPUT = ROOT / "public/assets/atlas-vectors"
TILES = "https://tiles.openfreemap.org/planet/20261115_080022_pt"
PACK = 4
NATIONAL_BOUNDS = [48, 2, 161, 67]
NATIONAL_UNITS = 128


def merc(lat):
    return math.degrees(math.asinh(math.tan(math.radians(lat))))


def latitude(y):
    return math.degrees(math.atan(math.sinh(math.radians(y))))


def tile_range(bounds, zoom):
    w, s, e, n = bounds
    scale = 2 ** zoom / 360
    return ((zoom, x, y) for x in range(math.floor((w + 180) * scale), math.ceil((e + 180) * scale))
            for y in range(math.floor((180 - merc(n)) * scale), math.ceil((180 - merc(s)) * scale)))


def coverage():
    tiles = set(tile_range([68, 12, 141, 58], 6))
    for entry in json.loads((MAPS / "place-bounds.json").read_bytes()).values():
        bounds = entry["bounds"]
        w, s, e, n = bounds
        if entry["level"] == "region":
            zoom = 8
        elif entry["level"] == "city":
            zoom = max(8, min(12, round(math.log2(3.35 * 360 / (e - w)))))
        else:
            zoom = 13
            x, y = (w + e) / 2, (merc(s) + merc(n)) / 2
            for approach in (10, 12):
                tiles.update(tile_range(bounds, approach))
            tiles.update(tile_range([x - .016, latitude(y - .014), x + .016, latitude(y + .014)], 14))
        tiles.update(tile_range(bounds, zoom))
    return sorted(tiles)


def tile_file(cache, sources, tile):
    name = "-".join(map(str, tile)) + ".pbf"
    other = sources / ("tile-" + name)
    return other if other.is_file() else cache / name


def fetch_tile(path, tile):
    if path.is_file():
        return
    url = TILES + "/" + "/".join(map(str, tile)) + ".pbf"
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": "MemoryGardenAtlas/1.0"}), timeout=25) as response:
                data = response.read()
            temp = path.with_suffix(".part")
            temp.write_bytes(data)
            temp.replace(path)
            return
        except OSError:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def path_line(points, closed=False):
    it = iter(points)
    first = next(it, None)
    if first is None:
        return ""
    x, y = first
    start = f"M{x} {y}"
    deltas = []
    for nx, ny in it:
        if nx != x or ny != y:
            deltas.append(f"{nx - x} {ny - y}")
        x, y = nx, ny
    return start + "l" + " ".join(deltas) + ("z" if closed else "") if deltas else ""


def tile_path(commands):
    # MVT uses delta coordinates across all parts of a feature (including rings).
    x = y = i = 0
    result, points = [], []
    while i < len(commands):
        word = commands[i]
        i += 1
        op, count = word & 7, word >> 3
        if op == 7:
            result.append(path_line(points, True))
            points = []
            continue
        if op not in (1, 2):
            raise ValueError(f"Invalid vector tile opcode {op}")
        for _ in range(count):
            if op == 1 and points:
                result.append(path_line(points))
                points = []
            a, b = commands[i:i + 2]
            x += (a >> 1) ^ -(a & 1)
            y += (b >> 1) ^ -(b & 1)
            i += 2
            points.append((x, y))
    result.append(path_line(points))
    return "".join(result)


def feature_style(layer, kind, geometry):
    if geometry == 3:
        if layer in ("water", "building", "park"):
            return layer
        if layer in ("landcover", "landuse"):
            if kind in ("wood", "forest", "park"): return "wood"
            if kind in ("grass", "grassland", "meadow", "cemetery", "recreation_ground"): return "park"
            if kind in ("farmland", "agriculture", "orchard", "vineyard"): return "farm"
            if kind in ("sand", "rock", "bare_rock", "scree"): return "sand"
            if kind in ("residential", "commercial", "industrial", "suburb", "neighbourhood"): return "built"
    if geometry == 2:
        if layer == "waterway": return "stream"
        if layer == "transportation":
            if kind in ("motorway", "trunk", "primary"): return "artery"
            if kind in ("secondary", "tertiary"): return "road"
            if kind in ("rail", "transit"): return "rail"
            if kind in ("path", "track", "steps"): return "path"
            if kind in ("minor", "service", "residential", "unclassified", "living_street"): return "lane"


def map_label(layer, feature, keys):
    props = {keys[k]: layer.values[v].string_value for k, v in zip(feature.tags[::2], feature.tags[1::2])
             if keys[k] in ("name", "name:zh", "name:en", "class")}
    local = props.get("name:zh") or props.get("name")
    kind = props.get("class", "")
    if not local or len(local) > 55:
        return None
    if layer.name == "place":
        if kind not in ("city", "town", "village", "suburb", "neighbourhood"): return None
        rank = 0 if kind in ("city", "town") else 2
    elif layer.name == "water_name":
        rank = 1
    else:
        if kind not in ("trunk", "primary", "secondary", "tertiary", "minor", "service"): return None
        rank = 3 if kind in ("trunk", "primary", "secondary") else 4
    x = y = i = 0
    coords = []
    commands = feature.geometry
    while i < len(commands):
        word = commands[i]
        i += 1
        if word & 7 == 7: continue
        for _ in range(word >> 3):
            a, b = commands[i:i + 2]
            i += 2
            x += (a >> 1) ^ -(a & 1)
            y += (b >> 1) ^ -(b & 1)
            if 0 <= x < 4096 and 0 <= y < 4096:
                coords.append((x, y))
    if coords:
        x, y = coords[len(coords) // 2]
        return [rank, x, y, local, props.get("name:en", "")]


def read_tile(path, zoom):
    tile = vector_tile_pb2.tile()
    tile.ParseFromString(path.read_bytes())
    groups = defaultdict(list)
    labels = []
    for layer in tile.layers:
        if layer.name == "place" or (zoom >= 12 and layer.name in ("water_name", "transportation_name")):
            keys = list(layer.keys)
            labels.extend(label for f in layer.features if (label := map_label(layer, f, keys)))
            continue
        if layer.name not in ("water", "waterway", "landcover", "landuse", "park", "building", "transportation"):
            continue
        if layer.extent != 4096:
            raise ValueError(f"Unexpected coordinate extent in {path}")
        class_index = next((i for i, key in enumerate(layer.keys) if key == "class"), -1)
        for feature in layer.features:
            tags = feature.tags
            kind = next((layer.values[tags[j + 1]].string_value for j in range(0, len(tags), 2)
                         if tags[j] == class_index), "")
            style = feature_style(layer.name, kind, feature.type)
            if style:
                groups[style].append(tile_path(feature.geometry))
    chart = {key: "".join(paths) for key, paths in groups.items()}
    names = set()
    for label in sorted(labels, key=lambda row: row[0]):
        if label[3] in names: continue
        names.add(label[3])
        chart.setdefault("labels", []).append(label)
        if len(names) >= 40: break
    return chart


def write_resource(key, data):
    encoded = json.dumps(data, separators=(",", ":")).encode()
    compressed = gzip.compress(encoded, compresslevel=8, mtime=0)
    name = key + "." + hashlib.sha256(compressed).hexdigest()[:12] + ".json.gz"
    (OUTPUT / name).write_bytes(compressed)
    return name


def national_chart(sources):
    w, s, e, n = NATIONAL_BOUNDS
    top = merc(n)
    def xy(lon, lat):
        return round((lon - w) * NATIONAL_UNITS), round((top - merc(lat)) * NATIONAL_UNITS)
    clip = box(w, s, e, n)
    groups = defaultdict(list)

    def add(key, geometry):
        if geometry.is_empty:
            return
        if geometry.geom_type == "Polygon":
            for ring in [geometry.exterior, *geometry.interiors]:
                groups[key].append(path_line((xy(x, y) for x, y in ring.coords), True))
        elif geometry.geom_type == "LineString":
            groups[key].append(path_line((xy(x, y) for x, y in geometry.coords)))
        elif hasattr(geometry, "geoms"):
            for part in geometry.geoms:
                add(key, part)

    def features(name):
        return json.loads((sources / (name + ".json")).read_bytes())["features"]
    focus_shapes = []
    for f in features("admin_0_countries"):
        geo = shape(f["geometry"])
        if geo.intersects(clip):
            focus = f["properties"]["ADM0_A3"] in ("CHN", "TWN", "HKG", "MAC")
            trimmed = geo.intersection(clip)
            key = "focus" if focus else "land"
            outline = trimmed.simplify(.011)
            if focus: focus_shapes.append(outline)
            add(key, outline)
            add("overview_" + key, trimmed.simplify(.23))
    for f in features("admin_1_states_provinces_lines"):
        if f["properties"]["ADM0_A3"] == "CHN":
            add("province", shape(f["geometry"]).intersection(clip).simplify(.012))
    for f in features("rivers_lake_centerlines"):
        geo = shape(f["geometry"])
        if geo.intersects(clip):
            add("river" if f["properties"]["scalerank"] < 5 else "tributary",
                geo.intersection(clip).simplify(.014))

    # Clip engraved strokes once in projected coordinates so camera motion only
    # repaints the ink that is actually visible inside the land outline.
    def project(x, y):
        return ((np.asarray(x) - w) * NATIONAL_UNITS,
                (top - np.degrees(np.arcsinh(np.tan(np.radians(y))))) * NATIONAL_UNITS)
    footprint = transform(unary_union(focus_shapes), project, interleaved=False)
    prepared = prep(footprint)

    def add_hatch(key, pts):
        if not key or len(pts) < 2: return
        line = LineString(pts)
        if prepared.covers(line):
            groups[key].append(path_line(pts))
        elif prepared.intersects(line):
            clipped = line.intersection(footprint)
            for part in getattr(clipped, "geoms", [clipped]):
                if part.geom_type == "LineString":
                    groups[key].append(path_line((round(x), round(y)) for x, y in part.coords))

    with zipfile.ZipFile(sources / "relief.zip") as archive:
        original = Image.open(io.BytesIO(archive.read("GRAY_50M_SR_W.tif")))
        relief = np.asarray(original.filter(ImageFilter.GaussianBlur(2)))
    for my in np.arange(merc(17), merc(55), .30):
        lat = latitude(my)
        row = min(relief.shape[0] - 1, int((90 - lat) / 180 * relief.shape[0]))
        stroke, previous = [], None
        for lon in np.arange(73, 136, .115):
            col = int((lon + 180) / 360 * relief.shape[1])
            shade = float(relief[row, col]) - 160
            weight = "ridgeLight" if shade > 8 else "ridgeDark" if shade < -12 else "ridge"
            pt = (round((lon - w) * NATIONAL_UNITS),
                  round((top - my - .009 * shade - .045 * math.sin(lon * 1.4 + my * .52)) * NATIONAL_UNITS))
            if previous != weight and stroke:
                stroke.append(pt)
                add_hatch(previous, stroke)
                stroke = []
            stroke.append(pt)
            previous = weight
        add_hatch(previous, stroke)
    return {key: "".join(lines) for key, lines in groups.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--tiles", type=Path, default=ROOT / ".vite/place-tiles")
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--fetch-only", action="store_true")
    args = parser.parse_args()
    args.tiles.mkdir(parents=True, exist_ok=True)
    tiles = coverage()
    paths = {tile: tile_file(args.tiles, args.sources, tile) for tile in tiles}
    missing = [t for t in tiles if not paths[t].is_file()]
    print(f"{len(tiles)} geographic tiles; {len(missing)} missing from the source cache", flush=True)
    if missing and (args.fetch or args.fetch_only):
        with ThreadPoolExecutor(max_workers=8) as pool:
            for i, _ in enumerate(pool.map(lambda t: fetch_tile(paths[t], t), missing), 1):
                if i % 75 == 0: print(f"Fetched {i} of {len(missing)}", flush=True)
    elif missing:
        raise SystemExit("Use --fetch to obtain missing OpenFreeMap tiles.")
    if args.fetch_only:
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    national = national_chart(args.sources)
    overview = {k: national.pop("overview_" + k) for k in ("focus", "land")}
    index = {"national": write_resource("national", national), "overview": overview,
             "bounds": NATIONAL_BOUNDS, "units": NATIONAL_UNITS, "packs": {}}
    packs = defaultdict(list)
    for z, x, y in tiles:
        packs[(z, x // PACK, y // PACK)].append((z, x, y))
    for coords, members in sorted(packs.items()):
        key = "-".join(map(str, coords))
        group = {x % PACK + PACK * (y % PACK): read_tile(paths[(z, x, y)], z) for z, x, y in members}
        index["packs"][key] = [sum(1 << slot for slot in group), write_resource(key, group)]
    (MAPS / "vector-index.json").write_text(json.dumps(index, indent=1) + "\n", encoding="utf-8")
    print(f"Built the national engraving and {len(packs)} indexed local vector packs.", flush=True)


if __name__ == "__main__":
    main()

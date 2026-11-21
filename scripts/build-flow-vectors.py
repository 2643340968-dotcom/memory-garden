"""Build street coverage for the additional Flow gardens using the shared atlas cartography."""
import argparse
import importlib.util
import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

spec = importlib.util.spec_from_file_location("atlas_vectors", Path(__file__).with_name("build-atlas-vectors.py"))
atlas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(atlas)
FLOW = atlas.ROOT / "src/flow"


def coverage(places):
    cities = defaultdict(list)
    tiles = set()
    for place in places.values():
        lon, lat = place["center"]
        cities[place["city"]].append((lon, lat))
        for zoom, radius in [(12, .072), (13, .050), (14, .026)]:
            tiles.update(atlas.tile_range([lon-radius, lat-radius*.8, lon+radius, lat+radius*.8], zoom))
    for points in cities.values():
        xs, ys = zip(*points)
        for zoom, margin in [(8, .65), (10, .22), (12, .055)]:
            bounds = [min(xs)-margin, min(ys)-margin*.7, max(xs)+margin, max(ys)+margin*.7]
            tiles.update(atlas.tile_range(bounds, zoom))
    return sorted(tiles)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tiles", type=Path, default=atlas.ROOT / ".vite/place-tiles")
    parser.add_argument("--fetch", action="store_true")
    args = parser.parse_args()
    args.tiles.mkdir(parents=True, exist_ok=True)
    base = json.loads((atlas.MAPS / "vector-index.json").read_bytes())["packs"]
    places = json.loads((FLOW / "extraPlaces.json").read_bytes())
    groups = defaultdict(dict)
    jobs = []
    for z, x, y in coverage(places):
        key = f"{z}-{x//4}-{y//4}"
        slot = x%4 + 4*(y%4)
        if base.get(key, [0])[0] & (1 << slot):
            continue
        path = args.tiles / f"{z}-{x}-{y}.pbf"
        jobs.append((key, slot, (z,x,y), path))

    def fetch(job):
        _, _, tile, path = job
        if args.fetch:
            atlas.fetch_tile(path, tile)
        if not path.is_file():
            raise FileNotFoundError(f"{path} (rerun with --fetch)")

    print(f"{len(jobs)} local vector tiles for {len(places)} gardens", flush=True)
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, _ in enumerate(pool.map(fetch, jobs), 1):
            if i % 100 == 0:
                print(f"Ready {i}/{len(jobs)}", flush=True)
    atlas.OUTPUT = atlas.OUTPUT / "flow"
    atlas.OUTPUT.mkdir(parents=True, exist_ok=True)
    for key, slot, tile, path in jobs:
        groups[key][slot] = (tile, path)
    packs = {}
    for key, members in groups.items():
        group = {slot: atlas.read_tile(path, tile[0]) for slot, (tile, path) in members.items()}
        name = atlas.write_resource(key, group)
        packs[key] = [sum(1 << slot for slot in group), "flow/" + name]
    (FLOW / "place-packs.json").write_text(json.dumps(packs, indent=1) + "\n", encoding="utf-8")
    print(f"Built {len(packs)} packs", flush=True)


if __name__ == "__main__":
    main()

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
});

export const PLACES = Object.freeze({
  jiangdongmen: {
    city: "nanjing", name: "atlas.jiangdongmen", region: "atlas.jianye",
    // Memorial Hall site anchor, Wikidata Q32391.
    center: [118.73659, 32.03759], span: 0.056, latitudeSpan: 0.034,
    context: "atlas.placeKicker", introduction: "atlas.placeIntro", flower: "atlas.flower",
    loadCollection: () => import("../data/jiangdongmen.js").then((module) => module.JIANGDONGMEN),
  },
});

export function readAtlasRoute(hash) {
  const [layer, city, place, extra] = hash.replace(/^#\/?/, "").split("/");
  if (!extra && Object.hasOwn(CITIES, city)) {
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

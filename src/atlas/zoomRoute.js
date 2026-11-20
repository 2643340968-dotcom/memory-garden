import { CITIES, PLACES } from "./places.js";

const allSites = Object.keys(PLACES);
// At regional scales the atlas still draws road charts around the city. Keep
// its index until the field widens enough to browse between city markers.
const enterCitySpan = 4.8;
const leaveCitySpan = 7.5;

// A large pinch can cross two thresholds in one input sample. Show the
// intervening city first and carry the rest of the gesture into the next stop.
export function adjacentStop(current, proposed) {
  if (current.level === "country" && proposed.level === "place") return { level: "city", city: proposed.city };
  if (current.level === "place" && proposed.level === "country") return { level: "city", city: current.city };
  return proposed;
}

// Thresholds use the fitted map for this viewport. The gap between entering
// and leaving a layer keeps small trackpad reversals from flickering the trail.
export function routeAtZoom(route, span, widening, [lon, lat], fittedSpan) {
  if (widening) {
    if (!route.city) return route;
    const city = { level: "city", city: route.city };
    if (span >= Math.max(leaveCitySpan, fittedSpan(city) * 1.75)) return { level: "country" };
    if (route.place && span >= fittedSpan(route) * 1.5) return city;
    return route;
  }

  const candidates = route.city ? CITIES[route.city].places : allSites;
  const latitudeScale = 1 / Math.cos(lat * Math.PI / 180);
  let nearest, distance = Infinity;
  for (const id of candidates) {
    const [x, y] = PLACES[id].center;
    const d = Math.hypot(x - lon, (y - lat) * latitudeScale);
    if (d < distance) { nearest = id; distance = d; }
  }
  const city = { level: "city", city: PLACES[nearest].city };
  if (!route.city && (span > Math.max(enterCitySpan, fittedSpan(city) * 1.25) ||
      distance > Math.min(1.2, Math.max(0.16, span * 0.55)))) return route;

  const place = { ...city, level: "place", place: nearest };
  if (span <= fittedSpan(place) * 0.88 && distance < span * 0.10) {
    return route.place === nearest ? route : place;
  }
  return route.city ? route : city;
}

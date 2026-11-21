import {CITIES, PLACES, atlasHash, readAtlasRoute} from "../atlas/places.js";

export function flowHash(route) {
  return route.level === "arrival" ? "#arrival/"+route.city+"/"+route.place : atlasHash(route);
}
export function readFlowRoute(hash) {
  if (/^#\/?arrival\//.test(hash)) {
    const route = readAtlasRoute(hash.replace("arrival/", "garden/"));
    return route.level === "garden" ? {...route, level:"arrival"} : route;
  }
  return readAtlasRoute(hash);
}

// A blank stretch of paper follows the last browsed branch. On the first visit
// that branch begins at the project's original collection in Jiangdongmen.
export function nextMapLevel(route, inward, mark, remembered = {}) {
  const {level, city, place} = route;
  if (!inward) {
    if (level === "garden") return {level:"arrival", city, place};
    if (level === "arrival") return {level:"place", city, place};
    if (level === "place") return {level:"city", city};
    if (level === "city") return {level:"country"};
    if (level === "country") return {level:"opening"};
    return null;
  }
  if (level === "opening") return {level:"country"};
  if (level === "arrival") return {level:"garden", city, place};
  if (level === "country") {
    const destination = mark ? mark.city : remembered.city ?? "nanjing";
    return Object.hasOwn(CITIES, destination) ? {level:"city", city:destination} : null;
  }
  if (level === "city" || level === "place") {
    const site = mark?.site ?? (level === "place" ? place : remembered[city] ?? CITIES[city]?.places[0]);
    if (mark?.national || PLACES[site]?.city !== city) return null;
    return {level:level === "place" ? "arrival" : "place", city, place:site};
  }
  return null;
}

// A wheel notch and a trackpad swipe both own at most one landing. Keep
// consuming the inertial tail even when a different pin moves under it.
export class WheelGesture {
  consume(delta, now) {
    const sign = Math.sign(delta);
    if (!sign) return false;
    const magnitude = Math.abs(delta);
    // A street tile can delay delivery of a small inertial tick during a flight.
    // A fresh full notch or a reversal still responds immediately after a short pause.
    const tail = this.used && magnitude <= Math.min(16, this.peak * .35);
    if (sign !== this.sign || now - this.last > (tail ? 620 : 180)) {
      this.peak = 0;
      this.sum = 0;
      this.used = false;
    }
    this.sign = sign;
    this.last = now;
    this.peak = Math.max(this.peak, magnitude);
    this.sum += magnitude;
    if (this.used || this.sum < 8) return false;
    this.used = true;
    return true;
  }
}

export function chartLabelInLanguage(name, language) {
  const han = /\p{Script=Han}/u.test(name), latin = /\p{Script=Latin}/u.test(name);
  return language === "en" ? latin && !han : han && !latin;
}

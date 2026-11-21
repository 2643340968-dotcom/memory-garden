import {CITIES, PLACES} from "../atlas/places.js";

export function nextMapLevel(route, inward, mark) {
  if (!inward) {
    if (route.level === "place") return {level: "city", city: route.city};
    if (route.level === "city") return {level: "country"};
    return null;
  }
  if (route.level === "country" && mark?.national && Object.hasOwn(CITIES, mark.city))
    return {level: "city", city: mark.city};
  if (route.level === "city" && !mark?.national && PLACES[mark?.site]?.city === route.city)
    return {level: "place", city: route.city, place: mark.site};
  return null;
}

// A wheel notch and a trackpad swipe both own at most one landing. Keep
// consuming the inertial tail even when a different pin moves under it.
export class WheelGesture {
  consume(delta, now) {
    const sign = Math.sign(delta);
    if (!sign) return false;
    if (sign !== this.sign || now - this.last > 180) {
      this.sum = 0;
      this.used = false;
    }
    this.sign = sign;
    this.last = now;
    this.sum += Math.abs(delta);
    if (this.used || this.sum < 8) return false;
    this.used = true;
    return true;
  }
}

export function chartLabelInLanguage(name, language) {
  const han = /\p{Script=Han}/u.test(name), latin = /\p{Script=Latin}/u.test(name);
  return language === "en" ? latin && !han : han && !latin;
}

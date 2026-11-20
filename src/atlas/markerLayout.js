// Keep the first site's true coordinate as the cluster anchor. At street scale
// each record has its own flower.
export function groupMarkers(points, radius) {
  const groups = [];
  for (const point of points) {
    const group = radius > 0 && groups.find((entry) => entry.city === point.city &&
      Math.hypot(entry.x - point.x, entry.y - point.y) < radius);
    if (group) group.members.push(point.id);
    else groups.push({ ...point, members: [point.id] });
  }
  return groups;
}

export function overlaps(a, b, padding = 4) {
  return a.left < b.right + padding && a.right > b.left - padding &&
    a.top < b.bottom + padding && a.bottom > b.top - padding;
}

// Keep the specimen attached to its pin while leaving nearby flowers and
// controls available. The preference for the previous position avoids flips
// as a hover eases to rest or a paragraph reflows after a language change.
export function placeSpecimen(x, y, w, h, gap, bounds, keepClear, previous) {
  const clamp = (n, a, b) => Math.max(a, Math.min(n, b));
  const above = y - h - gap, below = y + gap;
  const options = [
    [x-w/2, above], [x-w*.08, above], [x-w*.92, above],
    [x-w/2, below], [x-w*.08, below], [x-w*.92, below],
    [x+gap, y-h/2], [x-w-gap, y-h/2],
  ];
  let best;
  for (const [index, [originX, originY]] of options.entries()) {
    const left = clamp(originX, bounds.left, bounds.right-w);
    const top = clamp(originY, bounds.top, bounds.bottom-h);
    const box = { left, top, right:left+w, bottom:top+h };
    const covered = keepClear.filter(other => overlaps(box, other, 4)).length;
    const onPin = overlaps(box, { left:x-12, top:y-12, right:x+12, bottom:y+12 }, 2);
    const score = (onPin ? 10000 : 0) + covered*1000 + index*3 +
      (Math.abs(left-originX) + Math.abs(top-originY))*.3 - (index === previous ? 8 : 0);
    if (!best || score < best.score) best = { ...box, score, index };
  }
  return best;
}

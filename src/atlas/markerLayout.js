// Keep the first site's true coordinate as the cluster anchor. At street scale
// each record has its own pin; the place index always contains every record.
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

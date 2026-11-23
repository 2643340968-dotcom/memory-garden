// CSS coordinates stay exact. Cap only the physical pixels a layer retains.
export function pixelRatio(w, h, requested, maxPixels, maxSide = 4096) {
  return Math.min(requested, Math.sqrt(maxPixels / (w * h)), maxSide / Math.max(w, h));
}

export function releaseCanvas(canvas) {
  if (!canvas) return;
  if (canvas.width !== 1) canvas.width = 1;
  if (canvas.height !== 1) canvas.height = 1;
}

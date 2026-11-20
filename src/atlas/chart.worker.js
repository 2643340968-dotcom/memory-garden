import { VectorBasemap, paintChart } from "./VectorBasemap.js";

let map;
const surfaces = new Map();
self.onmessage = ({ data: job }) => {
  map ??= new VectorBasemap(() => self.postMessage({ updated: true }), job.assetRoot);
  if (!surfaces.has(job.layer)) surfaces.set(job.layer, new OffscreenCanvas(1, 1));
  const surface = surfaces.get(job.layer);
  const result = paintChart(map, surface, job);
  const bitmap = surface.transferToImageBitmap();
  self.postMessage({ ...result, bitmap }, [bitmap]);
};

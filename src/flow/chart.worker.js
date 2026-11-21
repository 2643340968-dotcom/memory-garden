import {FlowBasemap, paintChart} from "./FlowBasemap.js";

let painter, surface;
self.onmessage = ({data : job}) => {
  painter ??= new FlowBasemap(() => self.postMessage({updated : true}), job.assetRoot);
  surface ??= new OffscreenCanvas(1, 1);
  const result = paintChart(painter, surface, job);
  const bitmap = surface.transferToImageBitmap();
  self.postMessage({...result, bitmap}, [ bitmap, result.dots.buffer, result.offsets.buffer ]);
};

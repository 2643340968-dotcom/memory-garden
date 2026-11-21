import {flowers, makePlates} from "./coverPigments.js";

try {
  const plates = flowers.map((specimen, index) => {
    const {body, ring, petal} = makePlates(specimen, index, size => new OffscreenCanvas(size, size));
    return {body:body.transferToImageBitmap(), ring:ring.transferToImageBitmap(),
            petal:petal.transferToImageBitmap()};
  });
  self.postMessage(plates, plates.flatMap(plate => Object.values(plate)));
} catch {
  self.postMessage(null);
}
self.close();

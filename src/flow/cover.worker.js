import {allForms} from "./flowerForms.js";
import {makePlates} from "./coverPigments.js";

self.onmessage = ({data: keys}) => {
  try {
    const plates = {}, transfer = [];
    for (const key of keys) {
      const {body, ring, light, outline, reserve} = makePlates(allForms[key], size => new OffscreenCanvas(size, size));
      const plate = {
        body: body.transferToImageBitmap(),
        ring: ring.transferToImageBitmap(),
        light: light.transferToImageBitmap(),
        outline,
        reserve
      };
      plates[key] = plate;
      transfer.push(plate.body, plate.ring, plate.light, outline.buffer, reserve.buffer);
    }
    self.postMessage(plates, transfer);
  } catch {
    self.postMessage(null);
  }
  self.close();
};

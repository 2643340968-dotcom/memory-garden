import {forms} from "./flowerForms.js";
import {makePlates} from "./coverPigments.js";

try {
  const plates = {}, transfer = [];
  for (const [i, [city, form]] of Object.entries(forms).entries()) {
    const {body, ring, light, outline, reserve} =
        makePlates(form, i, size => new OffscreenCanvas(size, size));
    const plate = {
      body: body.transferToImageBitmap(),
      ring: ring.transferToImageBitmap(),
      light: light.transferToImageBitmap(),
      outline,
      reserve
    };
    plates[city] = plate;
    transfer.push(plate.body, plate.ring, plate.light, outline.buffer, reserve.buffer);
  }
  self.postMessage(plates, transfer);
} catch {
  self.postMessage(null);
}
self.close();

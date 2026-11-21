import {forms} from "./flowerForms.js";
import {makePlates} from "./coverPigments.js";

function workerPlates() {
  return new Promise(resolve => {
    let worker;
    const finish = value => {
      worker?.terminate();
      resolve(value);
    };
    try {
      worker = new Worker(new URL("./cover.worker.js", import.meta.url), {type: "module"});
      worker.onmessage = event => finish(event.data);
      worker.onmessageerror = () => finish(null);
      worker.onerror = event => {
        event.preventDefault();
        finish(null);
      };
    } catch {
      finish(null);
    }
  });
}

async function bake() {
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    const result = await workerPlates();
    if (result) return result;
  }
  const surface = size => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  const plates = {};
  for (const [index, [city, form]] of Object.entries(forms).entries()) {
    await new Promise(resolve => setTimeout(resolve, 0));
    plates[city] = makePlates(form, index, surface);
  }
  return plates;
}

let collection;
export function loadPlates() {
  return collection ??= bake();
}

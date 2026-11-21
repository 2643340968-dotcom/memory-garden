import {allForms, forms} from "./flowerForms.js";
import {makePlates} from "./coverPigments.js";

function workerPlates(keys) {
  return new Promise(resolve => {
    let worker;
    const finish = value => {
      worker?.terminate();
      resolve(value);
    };
    try {
      worker = new Worker(new URL("./cover.worker.js", import.meta.url), {type: "module"});
      worker.onmessage = event => finish(event.data);
      worker.postMessage(keys);
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

async function bake(keys) {
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    const result = await workerPlates(keys);
    if (result) return result;
  }
  const surface = size => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  const plates = {};
  for (const key of keys) {
    await new Promise(resolve => setTimeout(resolve, 0));
    plates[key] = makePlates(allForms[key], surface);
  }
  return plates;
}

let cities, sites;
export function loadPlates(includeSites = false) {
  cities ??= bake(Object.keys(forms));
  if (!includeSites) return cities;
  sites ??= Promise.all([cities, bake(Object.keys(allForms).filter(key => !forms[key]))])
    .then(([a, b]) => ({...a, ...b}));
  return sites;
}

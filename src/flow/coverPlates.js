import {allForms, forms} from "./flowerForms.js";
import {makePlates} from "./coverPigments.js";

function workerPlates(keys) {
  return new Promise(resolve => {
    let worker;
    const timeout = setTimeout(() => finish(null), 10000);
    const finish = value => {
      clearTimeout(timeout);
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

// Deep links request just their own flower. A cover request batches the
// remaining species in one job and shares in-flight work with the atlas.
const pending = new Map();
function request(keys) {
  const missing = keys.filter(key => !pending.has(key));
  if (missing.length) {
    const batch = bake(missing);
    for (const key of missing) {
      pending.set(key, batch.then(plates => plates[key]).catch(error => {
        pending.delete(key);
        throw error;
      }));
    }
  }
  return Promise.all(keys.map(key => pending.get(key)));
}

export function retainFlowerPlate(city) {
  for (const key of pending.keys()) if (key !== city) pending.delete(key);
}

export function loadFlowerPlate(key) {
  return request([key]).then(([plate]) => plate);
}
export function loadPlates() {
  const keys = Object.keys(forms);
  return request(keys).then(plates => Object.fromEntries(keys.map((key,i) => [key,plates[i]])));
}

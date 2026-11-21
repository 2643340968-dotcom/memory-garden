import {PLACES} from "./places.js";
import {createMemoryItem} from "../data/memoryPool.js";

export function gardenFor(id) {
  const site = PLACES[id];
  const [lon,lat] = site.center;
  const note = (suffix, body, sourceNames, sourceUrl) => ({
    ...createMemoryItem({id:id+suffix, text:body[1], source:sourceNames[1], sourceUrl, verified:true, isPrototype:false}),
    body, sourceNames
  });
  const record = note("-record",site.introduction,["地点资料","Site history"],site.sourceUrl);
  const position = note("-position",
    [`${site.name[0]}位于北纬 ${lat.toFixed(4)}°、东经 ${lon.toFixed(4)}°。`,
     `${site.name[1]} lies at ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E.`],
    ["开放街图","OpenStreetMap"],`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`);
  return {memories:[record,position],featuredLabels:{[record.id]:"memory.historical",[position.id]:"memory.mapNote"}};
}

// Static, petal-clipped grain. The two spatial scales survive downsampling on a small pin.
let grain;
export function frostPetals(ctx, size) {
  if (!grain) {
    grain = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(96,96) : document.createElement("canvas");
    grain.width = grain.height = 96;
    const ink = grain.getContext("2d"), pixels = ink.createImageData(96,96);
    let seed = 1947;
    const noise = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const flecks = Array.from({length:32*32}, noise);
    for (let y=0;y<96;y++) for (let x=0;x<96;x++) {
      const value = .59*noise()+.41*flecks[(y/3|0)*32+(x/3|0)], off=4*(y*96+x);
      const light = value>.5;
      pixels.data.set(light?[254,247,230]:[103,85,105],off);
      pixels.data[off+3] = 8+Math.abs(value-.5)*86;
    }
    ink.putImageData(pixels,0,0);
  }
  ctx.save();
  ctx.setTransform(size/110,0,0,size/110,0,0);
  ctx.globalCompositeOperation="source-atop";
  ctx.fillStyle=ctx.createPattern(grain,"repeat");
  ctx.fillRect(0,0,110,110);
  ctx.restore();
}

export function svgPaperFilter(frequency) {
  return '<filter id="paper" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="'+frequency+'" numOctaves="2" seed="19"/>' +
    '<feColorMatrix values=".23 .17 .10 0 .25  .23 .17 .10 0 .25  .23 .17 .10 0 .25  0 0 0 0 1"/>' +
    '<feBlend in2="SourceGraphic" mode="soft-light"/><feComposite in2="SourceGraphic" operator="in"/></filter>';
}

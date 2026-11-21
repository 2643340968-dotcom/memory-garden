// Diffuse the pigment first. The grain sits on the finished face at viewing scale.
function surface(size) {
  const c = typeof OffscreenCanvas === "undefined" ? document.createElement("canvas") : new OffscreenCanvas(size,size);
  c.width = c.height = size;
  return c.getContext("2d");
}
const plates = new Map();
export function pigmentPlate(size) {
  if (!plates.has(size)) plates.set(size, {ink:surface(size), wash:surface(size)});
  const plate = plates.get(size);
  plate.ink.clearRect(0,0,size,size);
  return plate;
}

let grain;
export function paperGrain(ctx) {
  if (!grain) {
    const n=144, tile=surface(n), pixels=tile.createImageData(n,n);
    let seed=1947;
    const noise=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for (let p=0; p<pixels.data.length; p+=4) {
      const dye = noise()+noise()-1;
      const value = dye<0 ? 32 : 255;
      pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=value;
      pixels.data[p+3]=Math.round(Math.abs(dye)*(dye<0 ? 57 : 103));
    }
    tile.putImageData(pixels,0,0);
    grain=tile.canvas;
  }
  return ctx.createPattern(grain,"repeat");
}

export function printPetals(target, {ink,wash}, size, displaySize) {
  wash.clearRect(0,0,size,size);
  wash.save();
  wash.filter="blur("+Math.max(.64,size*.016)+"px)";
  wash.drawImage(ink.canvas,0,0);
  wash.filter="none";
  wash.globalAlpha=.27;
  wash.drawImage(ink.canvas,0,0);
  wash.restore();
  wash.save();
  const pitch=Math.max(.76, size/displaySize*.84);
  wash.scale(pitch,pitch);
  wash.globalCompositeOperation="source-atop";
  wash.fillStyle=paperGrain(wash);
  wash.fillRect(0,0,size/pitch,size/pitch);
  wash.restore();
  target.drawImage(wash.canvas,0,0);
}

// The book and the upright drawings are self-contained vectors. Give their
// two coordinate systems the same relative diffusion and a single fine grain.
export function svgPaperFilter(frequency) {
  const blur=frequency>1 ? .032 : 2.15;
  return '<filter id="paper" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="'+blur+'" result="wash"/>' +
    '<feComposite in="SourceGraphic" in2="wash" operator="arithmetic" k2=".24" k3=".76" result="dye"/>' +
    '<feColorMatrix in="dye" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="pigment"/>' +
    '<feTurbulence type="fractalNoise" baseFrequency="'+frequency*1.74+'" numOctaves="1" seed="19"/>' +
    '<feColorMatrix values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="grain"/>' +
    '<feComposite in="pigment" in2="grain" operator="arithmetic" k2="1" k3=".26" k4="-.13"/>' +
    '<feComposite in2="dye" operator="in"/></filter>';
}

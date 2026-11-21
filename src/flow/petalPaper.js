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

// One physical grain pitch for both the narrow blades and the broad leaves.
const foliageSwatches = new Map();
export function foliageSwatch(colours) {
  const key=colours.join("/");
  if (!foliageSwatches.has(key)) {
    const n=128, tile=document.createElement("canvas");
    tile.width=tile.height=n;
    const ctx=tile.getContext("2d");
    const values=colours.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
    const pixels=ctx.createImageData(n,n), tau=Math.PI*2;
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
      const u=x*tau/n, v=y*tau/n;
      const t=.5+.23*Math.sin(u+.8*Math.cos(v))+.17*Math.cos(v-u)+.10*Math.sin(v*2+u);
      const p=(y*n+x)*4;
      for (let k=0;k<3;k++) pixels.data[p+k]=values[0][k]+t*(values[1][k]-values[0][k]);
      pixels.data[p+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    ctx.fillStyle=paperGrain(ctx);
    ctx.fillRect(0,0,n,n);
    foliageSwatches.set(key,{tile,url:tile.toDataURL("image/png")});
  }
  return foliageSwatches.get(key);
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

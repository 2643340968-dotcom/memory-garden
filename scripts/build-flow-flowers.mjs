// Rebuild the finished transparent plates from the same whorls as the interactive studies.
import {mkdir, writeFile} from "node:fs/promises";
import {allForms} from "../src/flow/flowerForms.js";
import {blades} from "../src/flow/drawCorolla.js";
import {cityFlowers} from "../src/flow/cityFlowers.js";
import {flowerNames} from "../src/data/placeFlowers.js";

const out = new URL("../public/assets/flow-flowers/", import.meta.url);
await mkdir(out, {recursive: true});
const f = n => +n.toFixed(4);
const rotate = (deg, r) => [f(r * Math.cos(deg * Math.PI / 180)), f(r * Math.sin(deg * Math.PI / 180))].join(" ");
const eye = "M0 -1Q.18 -.27 1 0Q.22 .26 0 1Q-.22 .26 -1 0Q-.18 -.27 0 -1Z";
const seed = "M0 -1C.55 -.69 .69 -.16 .49 .28Q.34 .76 0 1Q-.43 .64 -.49 .23C-.64 -.21 -.42 -.77 0 -1Z";
const drop = (shape, x, y, w, h, ink, turn = 0) =>
  `<path d="${shape}" fill="${ink}" transform="translate(${x} ${y}) rotate(${turn}) scale(${w} ${h})"/>`;
const bead = (x,y,r,ink) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/>`;
const ring = (n,rad,w,h,ink,turn=0) => Array.from({length:n},(_,i) => {
  const a=turn+i*360/n, [x,y]=rotate(a,rad).split(" ");
  return drop(seed,x,y,w,h,ink,a+90);
}).join("");
function centre(form) {
  const {heart,hem,root} = form, cream="#fff5d1", mint="#98c7ad";
  switch (form.centre) {
    case "pod": return bead(0,0,.153,heart)+ring(7,.080,.016,.024,cream)+bead(0,0,.022,cream);
    case "disc": return bead(0,0,.167,heart)+ring(11,.109,.017,.024,cream)+ring(6,.056,.012,.018,cream,30);
    case "coil": return drop(seed,-.014,0,.095,.144,heart,53)+drop(seed,.025,.008,.038,.091,root,52);
    case "throat": return drop(seed,0,0,.145,.18,hem,51)+drop(eye,.019,.024,.068,.075,cream,24);
    case "column": return drop(seed,.017,-.064,.050,.205,cream,18)+drop(eye,.064,-.227,.076,.072,heart,18);
    case "base": return drop(seed,.025,-.005,.076,.145,mint,62);
    case "bracts": return [0,120,240].map(a=>`<g transform="rotate(${a}) translate(0 -.095)">${ring(5,.040,.033,.044,cream)}${bead(0,0,.026,heart)}</g>`).join("");
    case "cross": return drop(eye,0,0,.18,.18,cream)+ring(4,.074,.023,.046,heart,45)+drop(eye,0,0,.038,.038,mint);
    case "six": return ring(6,.14,.029,.066,heart,30)+drop(eye,0,0,.09,.09,mint);
    case "brush": return ring(13,.14,.023,.050,heart)+ring(7,.073,.019,.035,cream,15)+bead(0,0,.045,mint);
    case "bundles": return ring(5,.16,.033,.081,heart,-5)+ring(5,.16,.026,.067,heart,10)+drop(eye,0,0,.07,.07,cream);
    case "threads": return ring(10,.145,.019,.040,heart)+drop(eye,0,0,.078,.078,heart,45);
    case "eye": return drop(eye,0,0,.175,.175,cream)+bead(0,0,.056,heart);
    default: return drop(eye,0,0,.19,.19,cream,form.centre==="button"?45:0)+drop(eye,0,0,.126,.126,heart)+bead(-.01,-.015,.022,cream);
  }
}

function mouth(layer) {
  const step=360/layer.petals, l=layer.length;
  let path="M"+rotate(layer.rotation-step/2,l*.73);
  for(let i=0;i<layer.petals;i++) {
    const a=layer.rotation+i*step;
    path+="C"+rotate(a-.33*step,l*1.18)+" "+rotate(a+.33*step,l*1.18)+" "+rotate(a+step/2,l*.73);
  }
  return path+"Z";
}
function plate(key, form) {
  const defs=[], rows=[];
  const {root,mid,tip,hem}=form;
  for(const [j,layer] of form.whorls.entries()) {
    const {shape,petals,length,width,rotation}=layer;
    const id="petal"+j;
    // A luminous basin, a saturated shoulder, and a cool turn at the outer lip.
    defs.push(`<radialGradient id="ink${j}" gradientUnits="userSpaceOnUse" cx=".20" cy="0" r=".88" fx=".36" fy="-.13" gradientTransform="scale(1 1.30)"><stop offset="0" stop-color="${root}"/><stop offset=".24" stop-color="${root}"/><stop offset=".55" stop-color="${mid}"/><stop offset=".86" stop-color="${tip}"/><stop offset="1" stop-color="${hem}"/></radialGradient>`);
    if(shape==="mouth") {
      const path=mouth(layer);
      defs.push(`<radialGradient id="bell" cx="43%" cy="55%" r="60%"><stop offset="0" stop-color="${root}"/><stop offset=".46" stop-color="${mid}"/><stop offset=".85" stop-color="${tip}"/><stop offset="1" stop-color="${hem}"/></radialGradient>`);
      rows.push(`<path d="${path}" fill="url(#bell)"/>`);
      continue;
    }
    // All the reflected light is inside a blade, leaving the silhouette printable.
    defs.push(`<path id="outline${j}" d="${blades[shape]}"/><clipPath id="cut${j}"><use href="#outline${j}"/></clipPath><g id="${id}"><use href="#outline${j}" fill="url(#ink${j})"/><g clip-path="url(#cut${j})"><path d="M.02 .06Q.44 -.07 .85 -.54Q.63 -.14 .32 .022Z" fill="${root}" opacity=".35"/><path d="M.28 .08Q.67 .14 .94 .45Q.65 .23 .28 .08Z" fill="${hem}" opacity=".20"/></g></g>`);
    const transform=i=>`rotate(${f(rotation+i*360/petals)}) scale(${length} ${width})`;
    const petal=i=>`<use href="#${id}" transform="${transform(i)}"/>`;
    let layerArt=Array.from({length:petals},(_,i)=>petal(i)).join("");
    if(petals>2) {
      defs.push(`<clipPath id="seam${j}"><path d="${blades[shape]}" transform="${transform(petals-1)}"/></clipPath>`);
      layerArt+=`<g clip-path="url(#seam${j})">${petal(0)}</g>`;
    }
    rows.push("<g>"+layerArt+"</g>");
  }
  defs.push('<g id="blossom">'+rows.join("")+centre(form)+'</g>');
  let art=form.centre==="base"?'<path d="M-.31 .78Q.06 .06 .20 -.59" fill="none" stroke="#9dcbb1" stroke-width=".035" stroke-linecap="round"/>':"";
  for(const [x,y,r,a] of form.florets??[[0,0,1,0]])
    art+=`<use href="#blossom" transform="translate(${x} ${y}) rotate(${a}) scale(${r} ${f(r*(form.centre==="throat"?.87:1))})"/>`;
  const name=(cityFlowers[key]?.name??flowerNames[key]).join(" / ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.18 -1.18 2.36 2.36" width="512" height="512" role="img"><title>${name}</title>\n<defs>\n${defs.join("\n")}\n</defs>\n${art}\n</svg>\n`;
}
for(const [key,form] of Object.entries(allForms)) await writeFile(new URL(key+".svg",out),plate(key,form));

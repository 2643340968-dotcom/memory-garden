import {clamp, hash} from "./geometry.js";
import {profileURL} from "./flowerForms.js";

const ns = "http://www.w3.org/2000/svg";
function svg(tag, props={}) {
  const node = document.createElementNS(ns,tag);
  for (const [name,value] of Object.entries(props)) node.setAttribute(name,value);
  return node;
}
export function gardenPositions(count, area) {
  const {x,y,w,h} = area;
  const pts = [[x+w*.28,y+h*.22],[x+w*.72,y+h*.39]];
  // Reserve space around the two taller stems and the crowns already placed.
  for (let i=2;i<count;i++) {
    let best=null, score=-Infinity;
    for (let j=0;j<60;j++) {
      const n=i*41+j, u=.025+.95*((n*.61803398875)%1);
      const v=.26+.61*((n*.41421356237)%1)+.045*Math.sin(u*8);
      const px=x+w*u, py=y+h*v;
      const gap=Math.min(...pts.map(([a,b],k)=>Math.hypot(px-a,py-b)-(k<2?Math.min(w*.12,74):0)));
      if (gap>score) {best=[px,py]; score=gap;}
    }
    pts.push(best);
  }
  return pts.slice(0,count);
}
function blade(length,width,colour,lotus) {
  const group=svg("g",{class:"plant-leaf"});
  const leaf=svg("g",{transform:"scale("+length+" "+width+")"});
  leaf.append(svg("path",{d:lotus ?
    "M0 0C.13 -.74 .38 -1.11 .64 -.87C.97 -.91 1.14 -.42 .95 -.05Q.76 .60 .27 .30Z" :
    "M0 0C.19 -.38 .36 -.83 .58 -.77Q.80 -.73 1 -.54Q.89 -.08 .67 .10C.43 .40 .18 .29 0 0Z",fill:colour}));
  leaf.append(svg("path",{d:"M.02 0Q.41 -.19 .91 -.49",fill:"none",stroke:"#ebedcf","stroke-width":".035"}));
  group.append(leaf);
  return group;
}
function stemCurve(x,y,bottom,reach,phase) {
  const root=x+(phase-.5)*reach, length=bottom-y;
  const middle=root+(x-root)*.34+(phase-.48)*reach*.53;
  const end=x-(phase-.56)*reach*.40;
  const control=[[root,bottom],[middle,bottom-length*.40],[end,y+length*.20],[x,y]];
  return {
    d:"M"+control[0]+"C"+control[1]+" "+control[2]+" "+control[3],
    at(t) {
      const q=1-t, weights=[q*q*q,3*q*q*t,3*q*t*t,t*t*t];
      return [0,1].map(c=>control.reduce((v,p,i)=>v+weights[i]*p[c],0));
    },
  };
}
function line(d,width,twig=false) {
  return svg("path",{d,fill:"none",stroke:"url(#stem-ink)","stroke-width":width,
    "stroke-linecap":"round",pathLength:1,class:twig?"plant-twig":"plant-stem"});
}
export function plantArtwork({x,y,size,phase,featured,city,view,bottom,width,birth}) {
  const socket=y+size*54/160;
  const stem=stemCurve(x,socket,bottom+5,Math.min(width*.23,featured?195:110),phase);
  const plant=svg("g",{class:"plant"+(birth>-2850?" growing":""), "data-view":view});
  plant.style.setProperty("--birth",birth+"ms");
  const thick=featured?clamp(size*.032,3.6,6.5):clamp(size*.043,1.5,3.1);
  const main=line(stem.d,thick);
  plant.append(main);
  const lotus=city==="dunhuang", direction=phase<.49?-1:1;
  const leaves=featured?4:2;
  for (let i=0;i<leaves;i++) {
    const t=.23+.58*i/leaves+(phase-.5)*.07, [px,py]=stem.at(t);
    const dir=direction*(i%2?-1:1), len=size*(featured?.55:.69)*(1-i*.10);
    const leaf=svg("g",{transform:"translate("+px+" "+py+") scale("+dir+" 1) rotate("+(-26-phase*28-i*3)+")"});
    leaf.style.setProperty("--sprout",Math.round(170+650*t)+"ms");
    leaf.append(blade(len,len*(lotus?.52:.34),i%2?"url(#leaf-light)":"url(#leaf-dark)",lotus));
    plant.append(leaf);
  }
  const branches=featured?2:(phase>.55?1:0);
  for (let i=0;i<branches;i++) {
    const t=.53+i*.20,[px,py]=stem.at(t), dir=direction*(i?-1:1);
    const reach=Math.min(size*(i?.59:.75),width*.16);
    const tipX=clamp(px+dir*reach,16,width-16);
    const tipY=py-size*(i?.52:.64);
    const d="M"+px+" "+py+"Q"+(tipX-dir*reach*.16)+" "+(py-size*.14)+" "+tipX+" "+tipY;
    plant.append(line(d,Math.max(1.1,thick*.54),true));
    if (featured && i===0) {
      const mini=size*(city==="nanjing"?.46:.39);
      const off=svg("g",{transform:"translate("+tipX+" "+tipY+") rotate("+(dir*13)+")"});
      off.append(svg("image",{href:profileURL(city,view==="front"?"side":"front"),x:-mini/2,y:-mini*126/160,
        width:mini,height:mini*.9,class:"plant-floret"}));
      plant.append(off);
    } else {
      const bud=svg("g",{transform:"translate("+tipX+" "+tipY+") rotate("+(dir*28)+") scale("+size*.12+")"});
      const folded=svg("g",{class:"plant-bud"});
      folded.append(svg("path",{d:"M0 0C-.55 -.21 -.55 -1.05 -.07 -1.48Q.59 -1.16 .48 -.60Q.38 -.19 0 0Z",fill:"url(#bud-colour)"}),
        svg("path",{d:"M0 .08Q-.48 -.10 -.49 -.65Q-.21 -.49 0 -.37L.42 -.72Q.41 -.18 0 .08Z",fill:"url(#leaf-dark)"}));
      bud.append(folded); plant.append(bud);
    }
  }
  return plant;
}
export function gardenDefs(form) {
  const defs=svg("defs");
  const gradients=[
    ["stem-ink","#80ab98","#bad5ab","#6f9f8a"],
    ["leaf-light","#a2c6a5","#d2e2bc","#9ebfab"],
    ["leaf-dark","#83b29b","#b3d0a5","#7baa94"],
    ["bud-colour",form.tip,form.root,form.hem],
  ];
  for (const [id,start,mid,end] of gradients) {
    const grad=svg("linearGradient",{id,x1:0,y1:1,x2:.8,y2:0});
    for(const [offset,colour] of [[0,start],[.55,mid],[1,end]]) grad.append(svg("stop",{offset,"stop-color":colour}));
    defs.append(grad);
  }
  return defs;
}

export function drawUnderstory(ctx,w,h,seed,form) {
  ctx.fillStyle="#fbfaf4"; ctx.fillRect(0,0,w,h);
  const light=ctx.createLinearGradient(0,h*.28,0,h);
  light.addColorStop(0,"#f9f7ee00"); light.addColorStop(.53,"#e8efde64"); light.addColorStop(1,"#dce8ce");
  ctx.fillStyle=light; ctx.fillRect(0,0,w,h);
  for (const [x,y,r,colour] of [[w*.23,h*.52,h*.48,form.mid],[w*.82,h*.63,h*.43,form.tip]]) {
    const wash=ctx.createRadialGradient(x,y,0,x,y,r);
    wash.addColorStop(0,colour+"35"); wash.addColorStop(1,colour+"00");
    ctx.fillStyle=wash; ctx.fillRect(x-r,y-r,2*r,2*r);
  }
  // Thin distant leaves give sparse gardens a ground plane without inventing memory records.
  const count=Math.round(clamp(w/17,20,100));
  for(let i=0;i<count;i++) {
    const root=w*hash(i,seed+3), lean=(hash(i,9)-.5)*w*.17;
    const length=h*(.065+.30*hash(i,seed+15)**2);
    ctx.beginPath(); ctx.moveTo(root,h+3);
    ctx.quadraticCurveTo(root+lean*.13,h-length*.62,root+lean,h-length);
    ctx.quadraticCurveTo(root+lean*.32+9,h-length*.38,root+3,h+3);
    ctx.fillStyle=i%4?"#92b49c26":"#89ad9e39"; ctx.fill();
  }
}

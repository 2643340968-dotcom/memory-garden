import {clamp, hash} from "./geometry.js";
import {paperGrain, foliageSwatch} from "./petalPaper.js";

const ns = "http://www.w3.org/2000/svg";
function svg(tag, props={}) {
  const node = document.createElementNS(ns,tag);
  for (const [name,value] of Object.entries(props)) node.setAttribute(name,value);
  return node;
}
export function gardenPositions(count, area, featured = 2) {
  const {x,y,w,h} = area;
  const narrow = w<520;
  const featuredLayout = featured<=2 ? [[.28,.22],[.72,.39]] : narrow ?
    [[.23,.14],[.77,.22],[.48,.39],[.17,.53],[.80,.59],[.48,.74]] :
    [[.18,.19],[.49,.13],[.80,.25],[.32,.45],[.66,.49],[.89,.59]];
  const pts = featuredLayout.slice(0,Math.min(count,featured)).map(([u,v])=>[x+w*u,y+h*v]);
  for (let i=pts.length;i<count;i++) {
    let best=null, score=-Infinity;
    for (let j=0;j<60;j++) {
      const n=i*41+j, u=.025+.95*((n*.61803398875)%1);
      const v=.24+.65*((n*.41421356237)%1)+.042*Math.sin(u*8);
      const px=x+w*u, py=y+h*v;
      const gap=Math.min(...pts.map(([a,b],k)=>Math.hypot(px-a,py-b)-(k<featured?Math.min(w*.13,78):0)));
      if (gap>score) {best=[px,py]; score=gap;}
    }
    pts.push(best);
  }
  return pts;
}
const foliage = {
  "stem-ink":["#749380","#a6c3a0"],
  "leaf-light":["#9fbc9b","#d2dcaf"],
  "leaf-dark":["#739d88","#bad1a8"],
  "field-mint":["#81a492","#bdd4af"]
};
function sizedPath(d,w,h) {
  return d.replace(/(-?[\d.]+) (-?[\d.]+)/g,(_,x,y)=>(Number(x)*w).toFixed(2)+" "+(Number(y)*h).toFixed(2));
}
function inkedLeaf(d,ink) {
  return svg("path",{d,fill:ink,stroke:ink,"stroke-width":2.4,"stroke-opacity":.22,"stroke-linejoin":"round","paint-order":"stroke"});
}
function blade(length,width,colour,lotus) {
  const group=svg("g",{class:"plant-leaf"});
  const shape = lotus ?
    "M0 0C.13 -.74 .38 -1.11 .64 -.87C.97 -.91 1.14 -.42 .95 -.05Q.76 .60 .27 .30Z" :
    "M0 0C.19 -.38 .36 -.83 .58 -.77Q.80 -.73 1 -.54Q.89 -.08 .67 .10C.43 .40 .18 .29 0 0Z";
  group.append(inkedLeaf(sizedPath(shape,length,width),colour),
    svg("path",{d:sizedPath("M.02 0Q.41 -.19 .91 -.49",length,width),fill:"none",stroke:"url(#stem-ink)","stroke-opacity":.43,"stroke-width":.85}));
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
  const group=svg("g"), props={d,fill:"none",stroke:"url(#stem-ink)","stroke-linecap":"round",
    pathLength:1,class:twig?"plant-twig":"plant-stem"};
  group.append(svg("path",{...props,"stroke-width":width+2.1,opacity:.24}),
    svg("path",{...props,"stroke-width":width}));
  return group;
}
export function plantArtwork({x,y,size,phase,featured,city,view,prints,bottom,width,birth}) {
  const socket=y+size*54/160;
  const stem=stemCurve(x,socket,bottom+5,Math.min(width*.23,featured?195:110),phase);
  const plant=svg("g",{class:"plant"+(birth>-2850?" growing":""), "data-view":view});
  const [rootX,rootY] = stem.at(0);
  plant.dataset.rootX = rootX;
  plant.dataset.rootY = rootY;
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
      const floret=svg("image",{x:-mini/2,y:-mini*126/160,width:mini,height:mini*.9,class:"plant-floret"});
      floret.setAttribute("href",prints[view==="front"?"side":"front"]);
      off.append(floret);
      plant.append(off);
    } else {
      const bud=svg("g",{transform:"translate("+tipX+" "+tipY+") rotate("+(dir*28)+")"});
      const folded=svg("g",{class:"plant-bud"});
      const unit=size*.12;
      folded.append(inkedLeaf(sizedPath("M0 0C-.55 -.21 -.55 -1.05 -.07 -1.48Q.59 -1.16 .48 -.60Q.38 -.19 0 0Z",unit,unit),"url(#bud-colour)"),
        inkedLeaf(sizedPath("M0 .08Q-.48 -.10 -.49 -.65Q-.21 -.49 0 -.37L.42 -.72Q.41 -.18 0 .08Z",unit,unit),"url(#leaf-dark)"));
      bud.append(folded); plant.append(bud);
    }
  }
  return plant;
}
// A stand shares a root and a real, nearby memory. Sampling in depth bands
// keeps a small screen densely planted without multiplying its reading stops.
export function gardenStands(w, h, top, seed, anchors) {
  if (!anchors.length) return [];
  const stands=[], rows=clamp(Math.round(w/148),3,13);
  const height=Math.max(90,h-top);
  for (let tier=0; tier<3; tier++) {
    const count=rows+tier;
    for (let i=0; i<count; i++) {
      const key=(tier+1)*113+i, rand=salt=>hash(key,seed+salt);
      const u=(i+.14+.72*rand(1))/count;
      const v=.28+tier*.209+.115*Math.sin(u*6.5+tier*.87)+.155*(rand(2)-.5);
      const x=w*u, y=top+v*height;
      const owner=anchors.reduce((a,b)=>Math.hypot(x-a.x,y-a.y)<Math.hypot(x-b.x,y-b.y)?a:b);
      const rootX=x+(rand(8)-.5)*Math.min(96,w*.15);
      const scale=clamp(Math.min(w*.069,h*.083),23,65)*(.42+.25*tier);
      const spread=Math.min(w/count*.79,scale*2.2);
      const heads=Array.from({length:4+Math.floor(rand(3)*4)},(_,j)=>{
        const order=(j+.22+.56*rand(11+j))/(7);
        const fx=clamp(x+(order-.43)*spread*1.7,5,w-5);
        const fy=Math.min(h-17,y+(rand(23+j)-.5)*scale*1.55+.25*Math.abs(fx-x));
        return {x:fx,y:fy,size:scale*(.61+.63*rand(36+j)),tilt:(rand(48+j)-.5)*44,
          view:rand(59+j)<.42?"front":"side"};
      });
      stands.push({id:owner.id,x,y,rootX,tier,heads,delay:rand(9)*770+tier*135});
    }
  }
  return stands;
}

export function plantStand(stand, bottom, age) {
  const {x,y,rootX,tier,heads,delay}=stand;
  const group=svg("g",{class:"memory-stand","data-memory":stand.id});
  const spray=svg("g",{class:"spray"});
  const birth=delay-age;
  if (birth>-1950) {
    spray.classList.add("sprouting");
    spray.style.transformOrigin=rootX+"px "+bottom+"px";
    spray.style.setProperty("--birth",Math.round(birth)+"ms");
  }
  const stemInk=["url(#leaf-light)","url(#field-mint)","url(#stem-ink)"][tier];
  const stems=[], leaves=[];
  spray.setAttribute("opacity",[.57,.73,.93][tier]);
  heads.forEach(({x:cx,y:cy,size,tilt,view},i)=>{
    const mid=(bottom-cy)*.49, bow=(cx-rootX)*.53+(i%2?1:-1)*size*.28;
    stems.push("M"+rootX+" "+(bottom+2)+"Q"+(rootX+bow)+" "+(cy+mid)+" "+cx+" "+cy);
    const t=.53, q=1-t;
    const lx=rootX*q*q+2*(rootX+bow)*q*t+cx*t*t, ly=(bottom+2)*q*q+2*(cy+mid)*q*t+cy*t*t;
    const dx=(i%2?1:-1)*size*.49;
    leaves.push("M"+lx+" "+ly+"q"+(dx*.36)+" "+(-size*.43)+" "+dx+" "+(-size*.40)+"q"+(-dx*.18)+" "+(size*.36)+" "+(-dx)+" "+(size*.40)+"Z");
    const flower=svg("use",{href:"#stand-"+view,class:"stand-flower",
      transform:"translate("+cx+" "+cy+") rotate("+tilt+") scale("+size/100+")"});
    spray.append(flower);
  });
  spray.prepend(svg("path",{d:stems.join(""),fill:"none",stroke:stemInk,"stroke-width":[1.1,1.5,1.95][tier],"stroke-opacity":.82}),
    inkedLeaf(leaves.join(""),stemInk));
  group.append(spray);
  return {stem:group,x,y,rootX,rootY:bottom};
}

// Every distant stem references one shared, preprinted face per view.
export function gardenDefs(form, prints) {
  const defs=svg("defs");
  for (const [id,colours] of Object.entries({...foliage,"bud-colour":[form.tip,form.root]})) {
    const swatch=foliageSwatch(colours);
    const pattern=svg("pattern",{id,width:112,height:112,patternUnits:"userSpaceOnUse"});
    pattern.append(svg("image",{href:swatch.url,width:112,height:112}));
    defs.append(pattern);
  }
  for (const view of ["front","side"]) {
    const face=svg("image",{id:"stand-"+view,x:-50,y:-78.75,width:100,height:90});
    face.setAttribute("href",prints[view]);
    defs.append(face);
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
  ctx.save();
  ctx.globalAlpha=.26;
  ctx.fillStyle=paperGrain(ctx);
  ctx.fillRect(0,0,w,h);
  ctx.restore();
  // Thin distant leaves tie the bases of the clusters together.
  const count=Math.round(clamp(w/17,20,100));
  const grass=ctx.createPattern(foliageSwatch(foliage["field-mint"]).tile,"repeat");
  ctx.save();
  ctx.fillStyle=ctx.strokeStyle=grass;
  for(let i=0;i<count;i++) {
    const root=w*hash(i,seed+3), lean=(hash(i,9)-.5)*w*.17;
    const length=h*(.065+.30*hash(i,seed+15)**2);
    ctx.beginPath(); ctx.moveTo(root,h+3);
    ctx.quadraticCurveTo(root+lean*.13,h-length*.62,root+lean,h-length);
    ctx.quadraticCurveTo(root+lean*.32+9,h-length*.38,root+3,h+3);
    ctx.globalAlpha=i%4?.48:.65; ctx.fill();
    ctx.globalAlpha=.16; ctx.lineWidth=2.3; ctx.stroke();
  }
  ctx.restore();
}

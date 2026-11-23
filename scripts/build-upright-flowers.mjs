// Front and side elevations. Each drawing meets its stem at (80, 126) in the plate.
import {mkdir, writeFile} from "node:fs/promises";
import {svgPaperFilter} from "../src/flow/petalPaper.js";
import {forms} from "../src/flow/flowerForms.js";
import {cityFlowers} from "../src/flow/cityFlowers.js";

const out = new URL("../public/assets/flow-flowers/upright/", import.meta.url);
await mkdir(out,{recursive:true});
const shapes = {
  silk:"M0 0C-.16 -.09 -.85 -.31 -.99 -.61C-1.12 -.87 -.71 -1.04 -.31 -.99Q-.08 -.96 .04 -.91C.30 -1.05 .85 -1.02 .97 -.79C1.12 -.49 .53 -.16 0 0Z",
  spoon:"M0 0C-.17 -.22 -.29 -.33 -.68 -.48C-1.08 -.65 -1.06 -.92 -.66 -.99C-.29 -1.07 .08 -.93 .25 -.96C.67 -1.05 1.02 -.89 .96 -.69C.92 -.44 .45 -.31 0 0Z",
  ruffle:"M0 0C-.18 -.12 -.86 -.35 -.97 -.57Q-1.11 -.72 -.92 -.76Q-1.01 -.96 -.66 -.92Q-.57 -1.08 -.33 -.98Q-.12 -1.09 .05 -.98Q.32 -1.09 .50 -.98Q.79 -1.05 .83 -.89Q1.12 -.88 .96 -.68C1.08 -.38 .40 -.19 0 0Z",
  tip:"M0 0C-.31 -.12 -1.00 -.32 -.88 -.59Q-.80 -.79 .02 -1.04Q.86 -.79 .94 -.55C1.02 -.29 .40 -.11 0 0Z",
  fold:"M0 0C-.21 -.17 -.88 -.27 -.96 -.61C-1.01 -.85 -.54 -1.04 -.12 -.99Q.13 -.94 .29 -.84Q.71 -1.03 .95 -.85C1.06 -.63 .76 -.41 .43 -.37Q.71 -.49 .64 -.60Q.26 -.51 0 0Z",
  ribbon:"M0 0C-.24 -.08 -.71 -.21 -.91 -.42Q-1.02 -.60 -.82 -.73Q-.66 -.87 -.59 -.99C-.21 -1.05 .26 -.88 .62 -.72C.99 -.52 1.01 -.36 .79 -.25Q.49 -.13 0 0Z",
  lip:"M0 0C-.41 -.04 -1.02 -.22 -1 -.61Q-.98 -.89 -.74 -.92Q-.40 -.99 -.12 -.90Q.21 -1.11 .47 -.98Q.88 -1.00 .97 -.73C1.12 -.39 .49 -.09 0 0Z",
  keel:"M0 0C-.15 -.18 -.57 -.26 -.78 -.46C-1.09 -.76 -.70 -.94 .31 -1.03Q.15 -.81 .49 -.69C1.18 -.43 .78 -.21 0 0Z",
  paper:"M0 0Q-.82 -.18 -1 -.53Q-.90 -.80 .12 -1.05Q.69 -.84 .95 -.52Q.83 -.22 0 0Z",
};
const round = x => +x.toFixed(2);
const path = (d, fill, attrs="") => '<path d="'+d+'" fill="'+fill+'" '+attrs+'/>';
const group = (transform, art) => '<g transform="'+transform+'">'+art+'</g>';
const ellipse = (x,y,rx,ry,fill) => '<ellipse cx="'+round(x)+'" cy="'+round(y)+'" rx="'+round(rx)+'" ry="'+round(ry)+'" fill="'+fill+'"/>';
const stroke = (d, ink, w) => path(d,"none",'stroke="'+ink+'" stroke-width="'+w+'" stroke-linecap="round"');
const defsFor = f => {
  const radial = (id,x,y,r,colors) => '<radialGradient id="'+id+'" cx="'+x+'%" cy="'+y+'%" r="'+r+'%">'+
    colors.map(([s,c])=>'<stop offset="'+s+'" stop-color="'+c+'"/>').join("")+'</radialGradient>';
  return [
    radial("ivory",47,74,91,[[0,"#fff7d1"],[.38,f.root],[.66,f.mid],[.89,f.tip],[1,f.hem]]),
    radial("silk",39,67,89,[[0,f.root],[.30,f.root],[.62,f.mid],[.87,f.tip],[1,f.hem]]),
    radial("edge",54,24,88,[[0,f.root],[.33,f.mid],[.73,f.tip],[1,f.hem]]),
    radial("back",45,73,86,[[0,f.mid],[.52,f.tip],[1,f.hem]]),
    radial("fold",44,17,100,[[0,"#fff5d2"],[.36,f.mid],[.79,f.tip],[1,f.hem]]),
    '<linearGradient id="green" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#d6e5b7"/><stop offset=".55" stop-color="#9ac4a5"/><stop offset="1" stop-color="#77aa99"/></linearGradient>',
    '<linearGradient id="pollen" x2=".3" y2="1"><stop stop-color="#fff0ad"/><stop offset=".66" stop-color="#e5b577"/><stop offset="1" stop-color="#b18b75"/></linearGradient>',
  ].join("\n");
};
function petal(x,y,w,h,a,shape,ink) {
  return group('translate('+[x,y].map(round).join(" ")+') rotate('+round(a)+') scale('+[w,h].map(round).join(" ")+')',
    path(shapes[shape],"url(#"+ink+")"));
}
function row(x,y,angles,w,h,shape,ink) {
  return angles.map((a,i)=>petal(x,y,w*(.98+.035*(i%2)),h*(1-.055*(i%2)),a,shape,ink)).join("");
}
function cup(x,y,w,h) {
  return group('translate('+x+' '+y+') scale('+w+' '+h+')',
    path("M-1 -.8Q-.41 -.37 -.51 -1Q-.13 -.65 0 -.52Q.38 -.74 .58 -1Q.57 -.58 1 -.83C.72 -.30 .40 -.19 .10 0L-.07 0Q-.66 -.33 -1 -.8Z","url(#green)"));
}
function pollen(x,y,n,width,height) {
  return Array.from({length:n},(_,i)=>{
    const t=n===1?.5:i/(n-1), dx=(t-.5)*width, dy=height*(.69+.29*Math.sin(t*Math.PI)+.09*(i%2));
    return stroke("M"+x+" "+y+"Q"+round(x+dx*.52)+" "+round(y-dy*.67)+" "+round(x+dx)+" "+round(y-dy),"#dfb878",1.15)+
      ellipse(x+dx,y-dy,1.6,2.3,"url(#pollen)");
  }).join("");
}
function four(side) {
  if (side) return cup(80,126,14,31)+
    petal(79,102,19,65,-49,"spoon","back")+petal(79,100,24,78,-15,"spoon","silk")+
    petal(78,100,20,57,19,"silk","ivory")+pollen(77,99,4,15,24)+
    petal(80,109,27,60,-76,"lip","fold")+petal(80,111,17,48,38,"fold","edge")+cup(80,126,11,19);
  return cup(80,126,15,35)+petal(78,84,25,58,-32,"spoon","back")+petal(80,85,25,57,31,"spoon","silk")+
    pollen(79,88,6,19,11)+petal(78,86,23,56,-104,"silk","ivory")+petal(80,87,23,52,110,"silk","edge")+
    path("M77 88Q80 84 81 80Q82 86 86 88Q82 90 80 94Q79 90 77 88Z","#e9c379")+cup(80,126,10,14);
}
function peony(side, rose=false) {
  const x=side?73:80;
  return cup(80,126,24,32)+row(x,104,side?[-63,-39,-12,13,42]:[-55,-28,0,28,55],27,77,rose?"fold":"ruffle","back")+
    row(x-1,97,side?[-57,-29,3,29]:[-60,-32,0,32,60],24,56,"silk","silk")+
    row(x,89,[-36,-7,24],19,36,rose?"fold":"ruffle","ivory")+pollen(x,88,7,22,11)+
    row(x,110,side?[-67,-36,-9,24]:[-67,-37,0,37,67],23,50,rose?"fold":"ruffle","fold")+
    petal(80,117,27,40,side?-23:-4,"lip","edge")+cup(80,126,15,14);
}
function lotus(side) {
  const x=side?74:80;
  return cup(80,126,16,20)+row(x,108,side?[-45,-22,3,29]:[-48,-24,0,24,48],20,84,"tip","back")+
    row(x,103,side?[-63,-32,2,43]:[-66,-36,0,36,66],22,70,"tip","silk")+
    ellipse(x,87,16,5.5,"#a0c397")+pollen(x,91,9,31,8)+
    row(80,116,side?[-69,-38,2,43]:[-76,-44,0,44,76],22,55,"tip","fold")+
    petal(80,120,21,36,side?-18:8,"tip","edge");
}
function fan(side, {shape="silk",deep=1, column=false}={}) {
  const x=side?72:80;
  const columnArt=stroke("M"+x+" 95Q"+(x+7)+" 74 "+(x+21)+" 54","#cf9b7e",3.6)+
    pollen(x+17,62,6,12,9)+ellipse(x+21,52,3.3,3,"#d38a9f");
  return cup(80,126,18,34)+row(x,93,side?[-57,-29,4,40]:[-56,-29,1,32,58],25,66*deep,shape,"silk")+
    (column?columnArt:pollen(x,92,10,29,19))+
    petal(79,112,28,54,side?-70:-62,shape,"ivory")+petal(80,115,29,side?40:48,side?34:64,shape,"fold")+
    petal(80,118,23,34,side?-24:2,"lip","edge")+cup(80,126,13,15);
}
function coral(side) {
  let art=stroke("M80 126Q72 79 92 23","#8cb49b",3.4);
  for(const [x,y,s,turn] of [[79,105,.84,-60],[80,96,.94,39],[81,82,.70,-53],[84,73,.77,40],[87,58,.58,-42],[91,45,.55,19],[91,32,.35,-6]])
    art+=group('translate('+x+' '+y+') rotate('+(turn+(side?-14:0))+') scale('+s+')',
      petal(0,0,11,44,7,"keel","back")+petal(0,0,8,35,-7,"keel","silk")+cup(0,3,6,11));
  return art;
}
function tulip(side) {
  return cup(80,126,13,19)+row(side?75:80,113,[-30,0,27],22,84,"tip","back")+
    petal(80,117,27,76,-23,"silk","silk")+petal(80,118,27,73,side?12:25,"silk","fold")+
    petal(80,118,24,62,side?-15:0,"tip","edge")+cup(80,126,10,12);
}
function flute(x,y,s,a,open) {
  return group('translate('+x+' '+y+') rotate('+a+') scale('+s+')',
    path("M-4 0Q-7 -18 -22 -29Q-28 -38 -18 -44Q-10 -51 0 -47Q12 -54 20 -46Q32 -43 25 -33Q10 -20 4 0Z","url(#silk)")+
    (open?path("M-22 -38Q-20 -49 -9 -45Q-1 -53 8 -47Q21 -52 25 -41Q24 -35 10 -35Q-3 -30 -14 -33Z","url(#back)"):"")+
    ellipse(0,-38,4.8,1.9,"#ffebbe")+cup(0,2,6,9));
}
function spray(side,bells) {
  let art=stroke("M80 126Q74 82 87 34","#9db89e",3.1);
  const pos=bells?[[76,95,.93,-54],[80,89,1.04,35],[83,65,.75,-20],[85,57,.61,39]]:
    [[73,95,.44,-69],[85,94,.49,53],[69,81,.50,-43],[91,77,.48,45],[80,76,.54,2],[75,60,.44,-26],[91,58,.40,30],[84,45,.37,0],[88,33,.27,-8]];
  for(const [x,y,s,a] of pos) art+=bells?flute(x,y,s,a+(side?-18:0),true):group('translate('+x+' '+y+') rotate('+(side?a*.78-15:a)+') scale('+s+')',
    row(0,0,side?[-50,-18,10]:[-44,-14,20,51],side?10:12,36,"spoon","silk")+petal(0,0,13,26,side?-48:-69,"lip","fold")+ellipse(0,-12,2.5,3,"#f3cf89"));
  return art;
}
function draw(city,side) {
  switch(city) {
    case "nanjing": return four(side);
    case "beijing": return peony(side);
    case "dunhuang": return lotus(side);
    case "chengdu": return fan(side,{shape:"ruffle",column:true});
    case "quanzhou": return coral(side);
    case "harbin": return spray(side,false);
    case "kunming": return spray(side,true);
    case "xining": return tulip(side);
    case "urumqi": return group("translate(8.8 8.82) scale(.89 .93)",peony(side,true));
    case "shenyang": return peony(side,true);
    case "lhasa": return cup(80,126,15,26)+row(80,99,side?[-69,-48,-27,-6,20,41]:[-74,-53,-31,-11,11,31,53,74],14,65,"ruffle","silk")+ellipse(80,91,16,6,"url(#pollen)")+row(80,114,[-72,-38,4,42,74],13,38,"lip","fold");
    case "hohhot": return fan(side,{shape:"ruffle",deep:1.06});
    case "kashgar": return fan(side,{deep:.83});
    case "wuhan": return fan(side,{shape:"spoon",deep:.89});
    case "qingdao": return peony(side)+pollen(side?72:80,86,9,22,13);
    case "xian": return fan(side,{shape:"ruffle",deep:.74})+cup(80,126,23,32);
    case "guangzhou": return fan(side,{shape:"ribbon",deep:1.06});
    case "haikou": return cup(80,126,12,23)+row(80,111,side?[-48,-6,29]:[-52,0,51],27,83,"paper","silk")+pollen(78,83,3,17,16)+row(80,119,[-35,30],17,43,"paper","fold");
    default: throw new Error("Missing flower elevation: "+city);
  }
}
for(const [city,form] of Object.entries(forms)) {
  for(const view of ["front","side"]) {
    const name=cityFlowers[city].name.join(" / ");
    // These layered lateral petals extend past the left edge. Scale the two
    // views around their common stem socket to preserve their registration.
    const art = draw(city,view==="side");
    const crown = ["beijing","qingdao","shenyang"].includes(city) ?
      '<g transform="translate(80 126) scale(.88) translate(-80 -126)">'+art+'</g>' : art;
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="160" height="144" viewBox="0 0 160 144" role="img"><title>'+name+'</title>\n<defs>'+defsFor(form)+svgPaperFilter(.39)+'</defs>\n<g filter="url(#paper)">'+crown+'</g>\n</svg>\n';
    await writeFile(new URL(city+"-"+view+".svg",out),svg);
  }
}

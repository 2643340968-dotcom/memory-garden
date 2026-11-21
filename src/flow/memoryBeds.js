import {CITIES, PLACES} from "./places.js";
import {clamp, hash, mercator, project, smooth, TAU} from "./geometry.js";
import {forms} from "./flowerForms.js";
import {loadPlates} from "./coverPlates.js";
import {drawInnerFronts, drawOuterFronts, focusedBody, frontsAt, stamp} from "./coverFlowers.js";
import {petalBreath, rhythmFor} from "./petalLight.js";
import {PetalCurrent} from "./petalCurrent.js";
import {WetPaper} from "./wetPaper.js";

const width = 320, height = 246;
const ease = n => smooth(clamp(n, 0, 1));
const tint = (a, b, mix) => "#" + [1,3,5].map(i => Math.round(
  parseInt(a.slice(i,i+2),16) * (1-mix) + parseInt(b.slice(i,i+2),16) * mix
).toString(16).padStart(2,"0")).join("");

export function meadowFlowers(id, city) {
  let seed = 17;
  for (const c of id) seed = Math.imul(31,seed) + c.charCodeAt(0);
  const rand = (i, n) => hash(seed+i,n);
  const phase = rand(0,23)*TAU, lean = (rand(0,31)-.5)*.72;
  const palette = [forms[city].tip, tint(forms[city].tip,"#de91ae",.42), tint(forms[city].tip,"#a1ace0",.42)];
  return Array.from({length:46 + Math.floor(rand(1,18)*9)}, (_, i) => {
    const lobe = i % 6, u = (lobe - 2.5) / 2.5;
    const around = rand(i,2)*TAU, d = Math.sqrt(rand(i,5)) * (i < 6 ? 8 : 33);
    const x = u*106 + Math.cos(around)*d;
    const y = 23*Math.sin(phase + u*3.2) + .12*x + Math.sin(around)*d*1.22 + 12*Math.cos(phase+lobe*1.8);
    const tone = Math.floor(rand(i,11)*3);
    return {
      x:width/2 + x*Math.cos(lean) - y*Math.sin(lean),
      y:height/2 + x*Math.sin(lean) + y*Math.cos(lean),
      radius:9 + rand(i,9)**1.25 * 19, angle:(rand(i,14)-.5)*2.6,
      delay:-3 - rand(i,42)*7, type:city, tone, ink:palette[tone], rhythm:rhythmFor(id+"-"+i),
    };
  });
}

function surface(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c.getContext("2d");
}
function at(ctx, flower, paint) {
  ctx.save();
  ctx.translate(flower.x, flower.y);
  ctx.rotate(flower.angle);
  paint();
  ctx.restore();
}

class Meadow {
  constructor(id, city, plates, bodies) {
    this.blooms = meadowFlowers(id, city);
    this.plate = plates[city];
    this.bodies = bodies;
    this.layers = [surface(width,height), surface(width,height), surface(width,height)];
    this.blooms.forEach((b,i) => {
      const layer = this.layers[i < 6 ? 0 : i < 20 ? 1 : 2];
      at(layer, b, () => stamp(layer, bodies[b.tone], b.radius));
    });
    this.current = new PetalCurrent(this.blooms);
    this.plates = plates;
  }
  breathing(time, depth) {
    this.dry ??= surface(width,height);
    const ctx=this.dry;
    ctx.clearRect(0,0,width,height);
    this.blooms.forEach((b,i) => {
      const tier=i<6?0:i<20?1:2, light=petalBreath(time,b.rhythm);
      ctx.globalAlpha=ease((depth-tier*.25)/.32)*(.76+.24*light);
      if (ctx.globalAlpha) at(ctx,b,()=>stamp(ctx,this.bodies[b.tone],b.radius*(.78+.60*light)));
    });
    ctx.globalAlpha=1;
    return ctx.canvas;
  }
  wet(dt, time) {
    if (!this.paper) {
      this.paper = new WetPaper(width, height, this.blooms, this.plates);
      const {width:w, height:h, pixels, erosion} = this.paper;
      this.pool = surface(w,h);
      this.rim = surface(w,h);
      this.dyeImage = new ImageData(pixels,w,h);
      this.rimImage = new ImageData(erosion,w,h);
      this.waves = surface(width,height);
      this.faces = surface(width,height);
    }
    this.current.advance(dt,time);
    const fronts = this.blooms.map((b,i) => frontsAt(b,time).concat(this.current.fronts(i,time)));
    this.paper.step(fronts,dt);
    this.pool.putImageData(this.dyeImage,0,0);
    this.rim.putImageData(this.rimImage,0,0);
    const {spacing,top,width:w,height:h} = this.paper;
    const bounds = [-spacing,top-spacing,w*spacing,h*spacing];
    const wash = this.waves, faces = this.faces;
    wash.clearRect(0,0,width,height);
    faces.clearRect(0,0,width,height);
    this.blooms.forEach((b,i) => {
      const state = this.current.states[i], light = petalBreath(time,b.rhythm);
      const radius = b.radius*(.78+.60*light);
      at(wash,b,() => drawOuterFronts(wash,this.plate,radius,fronts[i],1.9));
      at(faces,b,() => {
        faces.globalAlpha = .76+.24*light;
        const body = Math.hypot(state.x,state.y) > .018 ? focusedBody(b,state,this.plate,1,time) : this.bodies[b.tone];
        stamp(faces,body,radius);
        drawInnerFronts(faces,this.plate,radius,fronts[i],1.25);
      });
    });
    wash.drawImage(this.pool.canvas,...bounds);
    faces.globalCompositeOperation = "destination-out";
    faces.drawImage(this.rim.canvas,...bounds);
    faces.globalCompositeOperation = "source-over";
    wash.drawImage(faces.canvas,0,0);
    return wash.canvas;
  }
}

export class MemoryBeds {
  constructor(canvas, motion) {
    this.canvas = canvas;
    this.ink = canvas.getContext("2d");
    this.motion = motion;
    this.cache = new Map();
    this.tints = new Map();
    this.visible = [];
    this.clock = 4;
    motion.addEventListener("change", () => { this.release(); this.paint(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; this.release(); }
      else this.paint();
    });
  }
  resize(w,h,dpr) {
    this.w = w; this.h = h;
    this.projection = null;
    const scale = Math.min(dpr,1.6);
    this.canvas.width = Math.round(w*scale);
    this.canvas.height = Math.round(h*scale);
    this.ink.setTransform(this.canvas.width/w,0,0,this.canvas.height/h,0,0);
  }
  clear(hold = false) {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.release();
    this.city = null;
    this.projection = null;
    this.visible = [];
    this.heldFrame = hold;
    if (!hold) this.ink.clearRect(0,0,this.w,this.h);
    this.canvas.dataset.flowers = "0";
  }
  bodies(city) {
    if (!this.tints.has(city)) {
      const {body} = this.plates[city];
      const dye = [body, ...["#dd9cb7","#a7afe0"].map(colour => {
        const ctx = surface(144,144);
        ctx.drawImage(body,0,0,144,144);
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = colour + "45";
        ctx.fillRect(0,0,144,144);
        return ctx.canvas;
      })];
      this.tints.set(city,dye);
    }
    return this.tints.get(city);
  }
  place(city, view, moving) {
    if (!city) { if (this.city || this.heldFrame) this.clear(); return; }
    this.city = city; this.view = view; this.moving = moving;
    if (!this.plates) {
      this.loading ??= loadPlates().then(plates => {
        this.plates = plates;
        if (this.city) this.place(this.city,this.view,this.moving);
      });
      return;
    }
    const previous = this.projection;
    if (previous && previous.city === city && previous.moving === moving && previous.x === view.x &&
        previous.y === view.y && previous.span === view.span) return;
    this.projection = {city, moving, ...view};
    const k = this.w/view.span, entries = [];
    for (const id of CITIES[city].places) {
      const site = PLACES[id], lat = site.center[1], dy = site.latitudeSpan / 2;
      const closeScale = Math.min(this.w*(this.w>=820?.73:.82)/site.span,
        this.h*.68/(mercator(lat+dy)-mercator(lat-dy)));
      const depth = ease((k/closeScale-.10)/.78);
      if (depth < .012) continue;
      const [x,y] = project(view,this.w,this.h,site.center);
      const size = site.span*k*.65, scale = size/width;
      if (x+size/2<0 || x-size/2>this.w || y+height*scale/2<0 || y-height*scale/2>this.h) continue;
      if (!this.cache.has(id)) this.cache.set(id,new Meadow(id,city,this.plates,this.bodies(city)));
      entries.push({id,x,y,scale,depth,bed:this.cache.get(id)});
    }
    this.visible = entries;
    if (this.cache.size > Math.max(8,entries.length)) {
      const onPage = new Set(entries.map(e=>e.id));
      for (const id of this.cache.keys()) if (!onPage.has(id)) this.cache.delete(id);
    }
    this.paint();
  }
  local(e, p) {
    return {x:(p[0]-e.x)/e.scale + width/2, y:(p[1]-e.y)/e.scale + height/2};
  }
  hit(point) {
    let best = null, nearest = 1.24;
    for (const e of this.visible) {
      if (e.depth < .28) continue;
      const p = this.local(e,point);
      if (p.x < 0 || p.x>width || p.y<0 || p.y>height) continue;
      for (const b of e.bed.blooms) {
        const d = Math.hypot(p.x-b.x,p.y-b.y)/b.radius;
        if (d<nearest) {nearest=d; best=e.id;}
      }
    }
    return best;
  }
  hover(point) {
    if (this.motion.matches) return;
    this.attended = this.hit(point);
    for (const e of this.visible) {
      if (e.bed.current.hover(this.local(e,point), this.clock)) e.bed.lastTouched = this.clock;
    }
  }
  pull(from,to,dt) {
    if (this.motion.matches) return;
    this.attended = this.hit(to) ?? this.attended;
    for (const e of this.visible) {
      e.bed.current.pull(this.local(e,from),this.local(e,to),dt,this.clock);
      if (e.id === this.attended) e.bed.lastTouched = this.clock;
    }
  }
  release() {
    this.attended = null;
    for (const e of this.visible) e.bed.current.release();
  }
  paint(now = performance.now()) {
    cancelAnimationFrame(this.frame); this.frame = 0;
    if (!this.city || document.hidden) return;
    this.heldFrame = false;
    const ctx = this.ink, dt = clamp((now-(this.last??now))/1000,0,.13);
    this.clock += dt; this.last = now;
    ctx.clearRect(0,0,this.w,this.h);
    const wetUntil = e => Math.max(0, (e.bed.lastTouched ?? -Infinity) + 3.6 - this.clock);
    const live = this.moving || this.motion.matches ? [] : this.visible.filter(e=>e.depth>.84)
      .sort((a,b)=>Number(b.id===this.attended)-Number(a.id===this.attended) || wetUntil(b)-wetUntil(a) ||
        Math.hypot(a.x-this.w/2,a.y-this.h/2)-Math.hypot(b.x-this.w/2,b.y-this.h/2)).slice(0,4);
    const breathe = !this.moving && !this.motion.matches && this.visible.some(e=>e.depth>.48);
    let count = 0;
    for (const e of this.visible) {
      const {depth,scale,bed}=e;
      const bounds=[e.x-width*scale/2,e.y-height*scale/2,width*scale,height*scale];
      if (live.includes(e)) {
        ctx.globalAlpha=.88;
        ctx.drawImage(bed.wet(dt,this.clock),...bounds);
        count+=bed.blooms.length;
      } else if (breathe && depth>.48) {
        ctx.globalAlpha=.88;
        ctx.drawImage(bed.breathing(this.clock,depth),...bounds);
        count+=depth>.5 ? bed.blooms.length : 20;
      } else {
        for (let i=0;i<3;i++) {
          const alpha=ease((depth-i*.25)/.32);
          if (!alpha) continue;
          ctx.globalAlpha=alpha*.88;
          ctx.drawImage(bed.layers[i].canvas,...bounds);
          count+= i===0 ? 6 : i===1 ? 14 : bed.blooms.length-20;
        }
      }
    }
    ctx.globalAlpha=1;
    this.canvas.dataset.flowers=String(count);
    if (breathe) {
      const tick = time => {
        if (time-now<42) this.frame=requestAnimationFrame(tick);
        else this.paint(time);
      };
      this.frame=requestAnimationFrame(tick);
    }
  }
}

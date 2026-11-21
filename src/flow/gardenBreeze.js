import {clamp} from "./geometry.js";

function distanceToStroke(x, y, from, to) {
  const dx = to.x-from.x, dy = to.y-from.y;
  const t = clamp(((x-from.x)*dx+(y-from.y)*dy)/(dx*dx+dy*dy || 1),0,1);
  return Math.hypot(x-from.x-t*dx,y-from.y-t*dy);
}

// The crown catches the most wind. A stroke through the upper stem reaches it too.
export function windImpulse(plant, from, to, radius, dt) {
  const dx = to.x-from.x;
  if (!dx) return 0;
  const distance = Math.min(distanceToStroke(plant.x,plant.y,from,to),
    distanceToStroke(plant.x*.67+plant.rootX*.33,plant.y*.67+plant.rootY*.33,from,to)+radius*.17);
  const near = Math.max(0,1-distance/radius);
  const speed = Math.min(1,Math.abs(dx)/Math.max(5,dt)/1.65);
  return Math.sign(dx)*Math.min(34,Math.abs(dx)*.66)*near*near*(.38+.62*speed);
}

export function settleStem(p, dt) {
  const omega = p.frequency;
  // Exact solution of a damped oscillator, independent of input or display rate.
  const drag = 3.0, decay = Math.exp(-drag*dt);
  const c = Math.cos(omega*dt), s = Math.sin(omega*dt);
  const b = (p.velocity+drag*p.angle)/omega;
  const angle = decay*(p.angle*c+b*s);
  p.velocity = decay*(-omega*p.angle*s+omega*b*c)-drag*angle;
  p.angle = clamp(angle,-4.6,4.6);
  if (Math.abs(p.angle)<.012 && Math.abs(p.velocity)<.07) p.angle=p.velocity=0;
}

export function displacedCrown(p, angle) {
  const radians=angle*Math.PI/180, c=Math.cos(radians)-1, s=Math.sin(radians);
  const x=p.x-p.rootX, y=p.y-p.rootY;
  return [x*c-y*s,x*s+y*c];
}

export class GardenBreeze {
  constructor(root, sheet) {
    this.root=root;
    this.sheet=sheet;
    this.plants=[];
    this.quiet=matchMedia("(prefers-reduced-motion: reduce)");
    this.quiet.addEventListener("change",()=>this.rest());
    document.addEventListener("visibilitychange",()=>this.rest());
    root.addEventListener("pointermove",e=>this.move(e));
    root.addEventListener("pointerdown",e=>{
      this.last=null;
      this.start=e.pointerType==="touch" && !e.target.closest("#garden-invitation") ? {x:e.clientX,y:e.clientY} : null;
    });
    root.addEventListener("pointerleave",()=>{this.last=null;});
    root.addEventListener("pointercancel",()=>{this.start=this.last=null;});
    root.addEventListener("pointerup",e=>{
      if (this.start && Math.abs(e.clientX-this.start.x)>16 &&
          Math.abs(e.clientX-this.start.x)>Math.abs(e.clientY-this.start.y)*1.2) {
        root.addEventListener("click",event=>{event.preventDefault();event.stopImmediatePropagation();},
          {capture:true,once:true,signal:AbortSignal.timeout(350)});
      }
      this.start=this.last=null;
    });
  }
  bind(stems, crowns, stands = []) {
    this.rest();
    this.plants=crowns.map((crown,i)=>{
      const stem=stems[i];
      return {stem,crown,x:parseFloat(crown.style.left),y:parseFloat(crown.style.top),
        rootX:Number(stem.dataset.rootX),rootY:Number(stem.dataset.rootY),
        frequency:4.7+(i%7)*.24,angle:0,velocity:0};
    }).concat(stands.map((stand,i)=>({...stand,frequency:5.2+(i%5)*.31,angle:0,velocity:0})));
    this.bounds=this.root.getBoundingClientRect();
    this.radius=clamp(this.bounds.width*.20,108,245);
  }
  move(e) {
    if (e.target.closest("#garden-invitation")) { this.last=null; return; }
    if (!e.isPrimary || !this.plants.length || this.quiet.matches || this.sheet.open ||
        document.hidden || this.root.inert || e.pointerType==="touch" && !this.start) return;
    const point={x:e.clientX-this.bounds.left,y:e.clientY-this.bounds.top,time:e.timeStamp};
    const last=this.last;
    this.last=point;
    if (!last || point.time-last.time>180) return;
    let stirred=false;
    for (const p of this.plants) {
      const impulse=windImpulse(p,last,point,this.radius,point.time-last.time);
      if (!impulse) continue;
      p.velocity=clamp(p.velocity+impulse,-47,47);
      stirred=true;
    }
    if (stirred && !this.frame) {
      this.previous=performance.now();
      this.frame=requestAnimationFrame(t=>this.tick(t));
    }
  }
  tick(time) {
    const dt=Math.max(0,(time-this.previous)/1000);
    this.previous=time;
    let moving=false;
    for (const p of this.plants) {
      if (!p.velocity && !p.angle) continue;
      settleStem(p,dt);
      p.stem.setAttribute("transform","rotate("+p.angle.toFixed(3)+" "+p.rootX+" "+p.rootY+")");
      if (p.crown) {
        const [dx,dy]=displacedCrown(p,p.angle);
        p.crown.style.translate=dx.toFixed(2)+"px "+dy.toFixed(2)+"px";
        p.crown.style.setProperty("--bend-angle",p.angle.toFixed(3)+"deg");
      }
      moving ||= Boolean(p.velocity || p.angle);
    }
    this.frame=moving ? requestAnimationFrame(t=>this.tick(t)) : 0;
  }
  rest() {
    cancelAnimationFrame(this.frame);
    this.frame=0;
    this.last=this.start=null;
    for (const p of this.plants) {
      p.angle=p.velocity=0;
      p.stem.removeAttribute("transform");
      p.crown?.style.removeProperty("translate");
      p.crown?.style.removeProperty("--bend-angle");
    }
  }
  clear() { this.rest(); this.plants=[]; }
}

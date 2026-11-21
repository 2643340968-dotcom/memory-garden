import {BIN_SIZE, INKS} from "./print.js";
import {displaceGrain, RIPPLE_LIMIT} from "./ripples.js";
import {clamp, framePlacement, smooth} from "./geometry.js";

const colours = INKS.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));
const FADE = 320;
const vertex = `
  precision highp float;
  attribute vec4 grain;
  uniform vec2 viewport, origin;
  uniform float scale, dpr, weight;
  uniform int count;
  uniform vec4 fronts[${RIPPLE_LIMIT}], drifts[${RIPPLE_LIMIT}];
  uniform vec3 inks[4];
  varying vec3 pigment;
  varying vec2 axis;
  varying float aspect, edge, opacity;
  void main(){
    vec2 p=origin+grain.xy*scale, offset=vec2(0.);
    for(int i=0;i<${RIPPLE_LIMIT};i++){
      if(i>=count)break;
      vec2 q=(p-fronts[i].xy)/fronts[i].z;
      float t=dot(q,q);
      if(t>=1.)continue;
      float d=sqrt(t), power=(1.-t)*(1.-t)*fronts[i].w;
      vec2 radial=q/max(d,.025);
      float phase=drifts[i].z, skew=dot(q,drifts[i].xy);
      float ring=sin(11.*d-phase*2.2+1.6*skew);
      float turn=cos(7.*d+phase*.78+drifts[i].w);
      offset+=power*min(fronts[i].z*.073,14.)*(radial*ring*(.42+.58*d)+
        vec2(-radial.y,radial.x)*turn*.72+drifts[i].xy*(.36+.30*turn));
    }
    p+=offset;
    float energy=min(1.,length(offset)*.10);
    axis=length(offset)>.01?normalize(offset):vec2(1.,0.);
    aspect=1.+energy*.42;
    float radius=clamp(grain.z*scale,.16,18.)*dpr;
    gl_PointSize=2.*(radius+.6)*aspect;
    edge=.72/max(radius,.6);
    vec3 c=inks[0];if(grain.w>.5)c=inks[1];if(grain.w>1.5)c=inks[2];if(grain.w>2.5)c=inks[3];
    pigment=mix(c,c*vec3(.91,.94,1.),energy);
    opacity=weight;
    gl_Position=vec4(p/viewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);
  }`;
const fragment = `
  precision mediump float;
  varying vec3 pigment;
  varying vec2 axis;
  varying float aspect, edge, opacity;
  void main(){
    vec2 p=gl_PointCoord*2.-1.;
    float d=length(vec2(dot(p,axis),dot(p,vec2(-axis.y,axis.x))*aspect));
    float cover=1.-smoothstep(max(0.,1.-2.*edge),1.,d);
    gl_FragColor=vec4(mix(vec3(1.),pigment,cover*opacity),1.);
  }`;

function program(gl) {
  const id = gl.createProgram();
  for (const [type, src] of [[ gl.VERTEX_SHADER, vertex ], [ gl.FRAGMENT_SHADER, fragment ]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(id, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(id);
  if (!gl.getProgramParameter(id, gl.LINK_STATUS))
    throw Error(gl.getProgramInfoLog(id));
  return id;
}
function waterBounds(waves, w, h, dpr) {
  let l = w, t = h, r = 0, b = 0;
  for (const f of waves) {
    const reach = f.r + 20;
    l = Math.min(l, f.x - reach);
    t = Math.min(t, f.y - reach);
    r = Math.max(r, f.x + reach);
    b = Math.max(b, f.y + reach);
  }
  l = Math.max(0, Math.floor(l * dpr) / dpr);
  t = Math.max(0, Math.floor(t * dpr) / dpr);
  r = Math.min(w, Math.ceil(r * dpr) / dpr);
  b = Math.min(h, Math.ceil(b * dpr) / dpr);
  return r > l && b > t ? {l, t, r, b} : null;
}
function union(a, b) {
  if (!a || !b)
    return a ?? b;
  return {l : Math.min(a.l, b.l), t : Math.min(a.t, b.t), r : Math.max(a.r, b.r), b : Math.max(a.b, b.b)};
}

// Points in adjacent bins occupy continuous ranges in the vertex buffer.
// A stationary camera only redraws rows touched by the water, including
// the previous footprint so receding waves restore every displaced grain.
function ranges(frame, pose, rect, visit) {
  if (!rect) {
    visit(0, frame.dots.length / 4);
    return;
  }
  const cols = Math.ceil(frame.width / BIN_SIZE), rows = Math.ceil(frame.height / BIN_SIZE);
  const bin = pose.s * BIN_SIZE;
  const lo = Math.max(0, Math.floor((rect.l - pose.x - 20) / bin)),
        hi = Math.min(cols - 1, Math.floor((rect.r - pose.x + 20) / bin));
  const top = Math.max(0, Math.floor((rect.t - pose.y - 20) / bin)),
        bottom = Math.min(rows - 1, Math.floor((rect.b - pose.y + 20) / bin));
  if (hi < lo)
    return;
  for (let j = top; j <= bottom; j++) {
    const start = frame.offsets[j * cols + lo], end = frame.offsets[j * cols + hi + 1];
    if (end > start)
      visit(start, end - start);
  }
}

const absorptions = colours.map(ink => ink.map(channel => 1 - channel));

function softwareSurface(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const pen = canvas.getContext("2d", {alpha : false});
  return {canvas, pen, image : pen.createImageData(width, height)};
}

// On devices without WebGL, write the same geographic grains into a local
// pixel buffer. A held wave updates just its footprint in one canvas upload.
function rasterGrains(target, frame, pose, waves, box, density, whole) {
  const {image, pen} = target, pixels = image.data, stride = image.width;
  const width = Math.ceil((box.r - box.l) * density), height = Math.ceil((box.b - box.t) * density);
  pixels.fill(255, 0, stride * height * 4);
  const dots = frame.dots, delta = [ 0, 0 ];
  ranges(frame, pose, whole ? null : box, (start, count) => {
    for (let i = start * 4, end = (start + count) * 4; i < end; i += 4) {
      let x = pose.x + dots[i] * pose.s, y = pose.y + dots[i + 1] * pose.s;
      if (waves.length) {
        if (x < box.l - 20 || x > box.r + 20 || y < box.t - 20 || y > box.b + 20)
          continue;
        displaceGrain(x, y, waves, delta);
        x += delta[0];
        y += delta[1];
      }
      x = (x - box.l) * density - .5;
      y = (y - box.t) * density - .5;
      const radius = Math.min(18, dots[i + 2] * pose.s) * density;
      const outer = radius + .5, limit = outer * outer, inner = Math.max(0, radius - .5) ** 2;
      const left = Math.max(0, Math.ceil(x - outer)), right = Math.min(width - 1, Math.floor(x + outer));
      const top = Math.max(0, Math.ceil(y - outer)), bottom = Math.min(height - 1, Math.floor(y + outer));
      const ink = absorptions[dots[i + 3]];
      for (let row = top; row <= bottom; row++) {
        const dy = (row - y) ** 2;
        let at = (row * stride + left) * 4;
        for (let col = left; col <= right; col++, at += 4) {
          const dist = (col - x) ** 2 + dy;
          if (dist >= limit)
            continue;
          const cover = dist <= inner ? 1 : outer - Math.sqrt(dist);
          pixels[at] *= 1 - ink[0] * cover;
          pixels[at + 1] *= 1 - ink[1] * cover;
          pixels[at + 2] *= 1 - ink[2] * cover;
        }
      }
    }
  });
  pen.putImageData(image, 0, 0, 0, 0, width, height);
}

// Geometry is uploaded only when a new geographic impression is ready.
// A pointer changes the velocity of these same grains on the next frame.
export class InkSurface {
  constructor(canvas) {
    this.canvas = canvas;
    this.fronts = new Float32Array(RIPPLE_LIMIT * 4);
    this.drifts = new Float32Array(RIPPLE_LIMIT * 4);
    try {
      const gl = canvas.getContext("webgl", {
        alpha : false,
        antialias : false,
        depth : false,
        stencil : false,
        preserveDrawingBuffer : true,
        powerPreference : "low-power"
      });
      if (!gl)
        throw Error("2D print");
      this.gl = gl;
      this.program = program(gl);
      gl.useProgram(this.program);
      this.loc = {};
      for (const name
               of ["viewport", "origin", "scale", "dpr", "weight", "count", "fronts[0]", "drifts[0]",
                   "inks[0]"]) {
        this.loc[name] = gl.getUniformLocation(this.program, name);
      }
      this.attribute = gl.getAttribLocation(this.program, "grain");
      gl.enableVertexAttribArray(this.attribute);
      gl.uniform3fv(this.loc["inks[0]"], new Float32Array(colours.flat()));
      gl.clearColor(1, 1, 1, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
      canvas.addEventListener("webglcontextlost", e => {
        e.preventDefault();
        this.useCanvas();
        this.onRestore?.();
      }, {once : true});
      canvas.dataset.renderer = "points";
    } catch {
      this.useCanvas();
    }
  }
  useCanvas() {
    this.full = true;
    if (this.gl) {
      const replacement = this.canvas.cloneNode(false);
      this.canvas.replaceWith(replacement);
      this.canvas = replacement;
      this.gl = null;
    }
    this.ctx = this.canvas.getContext("2d", {alpha : false});
    this.canvas.dataset.renderer = "canvas-points";
  }
  resize(w, h, dpr) {
    this.full = true;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  release(model) {
    if (this.gl && model?.buffer)
      this.gl.deleteBuffer(model.buffer);
  }
  update(frame, now, quiet, moving) {
    if (!frame?.dots || frame === this.current?.frame)
      return;
    this.full = true;
    this.fade = moving ? 140 : FADE;
    if (!this.previous || now - this.began >= this.fade * .56) {
      this.release(this.previous);
      this.previous = this.current;
      this.began = now;
    } else
      this.release(this.current);
    this.current = {frame};
    if (quiet) {
      this.release(this.previous);
      this.previous = null;
    }
    const gl = this.gl;
    if (gl) {
      this.current.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.current.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, frame.dots, gl.STATIC_DRAW);
    }
    this.canvas.dataset.grains = String(frame.dots.length / 4);
  }
  render(view, waves, now, quiet) {
    if (!this.w || !view)
      return false;
    const {gl, w, h, dpr} = this;
    const bounds = waterBounds(waves, w, h, dpr);
    const whole =
        this.full || this.lastView !== view || !!this.previous || (!bounds && !!this.lastBounds);
    const rect = whole ? null : union(bounds, this.lastBounds);
    this.lastBounds = bounds;
    this.lastView = view;
    this.full = false;
    if (!whole && !rect)
      return false;
    const phase = this.previous && !quiet ? smooth(clamp((now - this.began) / this.fade, 0, 1)) : 1;
    if (phase === 1) {
      this.release(this.previous);
      this.previous = null;
    }
    if (gl) {
      if (rect) {
        gl.enable(gl.SCISSOR_TEST);
        const l = Math.floor(rect.l * dpr), b = Math.ceil(rect.b * dpr);
        gl.scissor(l, this.canvas.height - b, Math.ceil(rect.r * dpr) - l, b - Math.floor(rect.t * dpr));
      } else
        gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(this.loc.viewport, w, h);
      gl.uniform1f(this.loc.dpr, dpr);
      gl.uniform1i(this.loc.count, waves.length);
      if (waves.length) {
        waves.forEach((f, i) => {
          this.fronts.set([ f.x, f.y, f.r, f.alpha ], i * 4);
          this.drifts.set([ f.ux, f.uy, f.phase, f.seed ], i * 4);
        });
        gl.uniform4fv(this.loc["fronts[0]"], this.fronts);
        gl.uniform4fv(this.loc["drifts[0]"], this.drifts);
      }
    } else {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.save();
      if (rect) {
        const l = Math.floor(rect.l * dpr) / dpr, t = Math.floor(rect.t * dpr) / dpr;
        this.ctx.beginPath();
        this.ctx.rect(l, t, Math.ceil(rect.r * dpr) / dpr - l, Math.ceil(rect.b * dpr) / dpr - t);
        this.ctx.clip();
      }
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.fillStyle = "white";
      this.ctx.fillRect(0, 0, w, h);
      if (this.previous)
        this.ctx.globalCompositeOperation = "multiply";
    }
    const draw = (model, weight) => {
      if (!model || weight < .001)
        return;
      const pose = framePlacement(model.frame, view, w, h);
      if (gl) {
        gl.bindBuffer(gl.ARRAY_BUFFER, model.buffer);
        gl.vertexAttribPointer(this.attribute, 4, gl.FLOAT, false, 0, 0);
        gl.uniform2f(this.loc.origin, pose.x, pose.y);
        gl.uniform1f(this.loc.scale, pose.s);
        gl.uniform1f(this.loc.weight, weight);
        const visible = rect ?? (pose.s > 1.5 ? {l : 0, t : 0, r : w, b : h} : null);
        ranges(model.frame, pose, visible, (start, count) => gl.drawArrays(gl.POINTS, start, count));
      } else
        this.drawSoftware(model, pose, waves, weight, bounds);
    };
    draw(this.previous, 1 - phase);
    draw(this.current, phase);
    if (!gl)
      this.ctx.restore();
    return !!this.previous;
  }
  drawSoftware(model, pose, waves, weight, bounds) {
    const {ctx, w, h} = this;
    const density = Math.min(this.dpr, 1.65);
    if (!model.sheet) {
      const view = {l : 0, t : 0, r : model.frame.width, b : model.frame.height};
      const bitmap = softwareSurface(Math.ceil(view.r * density), Math.ceil(view.b * density));
      rasterGrains(bitmap, model.frame, {x : 0, y : 0, s : 1}, [], view, density, true);
      model.sheet = bitmap.canvas;
    }
    ctx.save();
    ctx.globalAlpha = weight;
    if (bounds) {
      const margin = new Path2D();
      margin.rect(0, 0, w, h);
      margin.rect(bounds.l, bounds.t, bounds.r - bounds.l, bounds.b - bounds.t);
      ctx.clip(margin, "evenodd");
    }
    ctx.drawImage(model.sheet, pose.x, pose.y, model.frame.width * pose.s, model.frame.height * pose.s);
    ctx.restore();
    if (!bounds)
      return;
    const width = Math.ceil((bounds.r - bounds.l) * density),
          height = Math.ceil((bounds.b - bounds.t) * density);
    if (!this.patch || this.patch.canvas.width < width || this.patch.canvas.height < height) {
      this.patch = softwareSurface(Math.ceil(width / 64) * 64, Math.ceil(height / 64) * 64);
    }
    rasterGrains(this.patch, model.frame, pose, waves, bounds, density, false);
    ctx.save();
    ctx.globalAlpha = weight;
    ctx.drawImage(
        this.patch.canvas, 0, 0, width, height, bounds.l, bounds.t, bounds.r - bounds.l,
        bounds.b - bounds.t);
    ctx.restore();
  }
}

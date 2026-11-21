import {clamp, smooth} from "./geometry.js";

const ease = n => smooth(clamp(n, 0, 1));
const lifetime = 2.65;

function aim(state, dx, dy, weight) {
  const gain = weight / Math.max(1, Math.hypot(dx, dy));
  state.targetX = (dx * state.cos + dy * state.sin) * gain;
  state.targetY = (dy * state.cos - dx * state.sin) * gain;
}

export class PetalCurrent {
  constructor(blooms) {
    this.blooms = blooms;
    this.states = blooms.map(bloom => ({
      cos: Math.cos(bloom.angle), sin: Math.sin(bloom.angle),
      x: 0, y: 0, targetX: 0, targetY: 0, energy: 0, waves: [], nextWave: 0,
    }));
  }

  hover(point, time) {
    let overPetal = false;
    this.blooms.forEach((bloom, i) => {
      const x = (point.x - bloom.x) / bloom.radius, y = (point.y - bloom.y) / bloom.radius;
      const weight = time > bloom.delay ? 1 - ease((Math.hypot(x, y) - .56) / .50) : 0;
      aim(this.states[i], x * 1.40, y * 1.40, .72 * weight);
      if (weight > 0) overPetal = true;
    });
    return overPetal;
  }

  // Use distance to the stroke segment for water and to its tip for light.
  // A fast stroke can pass a small floret between two pointer events.
  pull(from, to, seconds, time) {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
    if (length < .5) return;
    const speed = length / Math.max(.008, seconds);
    const pressure = .34 + .66 * (1 - Math.exp(-speed / 460));
    this.blooms.forEach((bloom, i) => {
      const state = this.states[i], r = bloom.radius;
      const reach = r * 1.33 + Math.min(65, r * .63);
      const px = to.x - bloom.x, py = to.y - bloom.y;
      const along = clamp(-(px * dx + py * dy) / (length * length), -1, 0);
      const rx = px + dx * along, ry = py + dy * along;
      const near = 1 - ease(Math.hypot(rx, ry) / reach);
      const tip = 1 - ease(Math.hypot(px, py) / reach);
      const ux = px * 1.55 / r + .48 * dx / length, uy = py * 1.55 / r + .48 * dy / length;
      aim(state, ux, uy, tip);
      const force = near * pressure;
      state.energy = Math.max(state.energy, force);
      if (force < .075 || time < state.nextWave) return;
      const origins = .53 / Math.max(r, Math.hypot(rx, ry));
      state.waves.push({
        born: time + (1 - near) * .19, force,
        x: (rx * state.cos + ry * state.sin) * origins, y: (ry * state.cos - rx * state.sin) * origins,
      });
      state.nextWave = time + .48 + .24 * (1 - force);
    });
  }

  release() {
    for (const state of this.states) state.targetX = state.targetY = 0;
  }

  advance(dt, time) {
    for (const state of this.states) {
      const held = state.targetX !== 0 || state.targetY !== 0;
      const follow = 1 - Math.exp(-dt / (held ? .105 : .66));
      state.x += (state.targetX - state.x) * follow;
      state.y += (state.targetY - state.y) * follow;
      state.energy *= Math.exp(-dt / .83);
      while (state.waves.length && time - state.waves[0].born >= lifetime) state.waves.shift();
    }
  }

  fronts(i, time) {
    const result = [];
    for (const wave of this.states[i].waves) {
      const t = (time - wave.born) / lifetime;
      if (t <= 0 || t >= 1) continue;
      const amplitude = wave.force * ease(t / .095) * (1 - ease((t - .19) / .81));
      const travel = 1 - ease(t / .58);
      result.push({
        progress: t, radius: .12 + 1.79 * t * (1.26 - .26 * t),
        opacity: 1.30 * amplitude, wetness: 1.20 * amplitude,
        x: wave.x * travel, y: wave.y * travel,
      });
    }
    return result;
  }
}

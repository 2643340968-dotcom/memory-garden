import plates from "./field-studies.json";

const studies = new Map();
const inks = ["#947d87", "#cfadad", "#f5dfc7"];
function pointsFor(city) {
  if (!studies.has(city)) {
    const raw = atob(plates[city]);
    studies.set(city, Uint8Array.from(raw, (c) => c.charCodeAt(0)));
  }
  return studies.get(city);
}

// Each catalogue illustration uses the same number of grains. A change of place moves
// those grains into the new print; interrupted transitions continue from the visible pose.
export class FieldStudy {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.current = Float32Array.from(pointsFor("nanjing"));
    this.city = "nanjing";
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(canvas);
  }

  show(city, immediate = false) {
    if (city === this.city && !immediate) return;
    this.city = city;
    cancelAnimationFrame(this.frame);
    const target = pointsFor(city);
    if (immediate || this.motion.matches || document.hidden) {
      this.current.set(target);
      this.draw();
      return;
    }
    const from = this.current.slice();
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / 820);
      for (let i = 0; i < target.length; i += 3) {
        const delay = from[i] / 255 * 0.17;
        const phase = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
        const ease = phase * phase * (3 - 2 * phase);
        const travel = target[i] - from[i];
        this.current[i] = from[i] + travel * ease;
        this.current[i + 1] = from[i + 1] + (target[i + 1] - from[i + 1]) * ease
          - travel * 0.22 * Math.sin(Math.PI * ease);
        this.current[i + 2] = from[i + 2] + (target[i + 2] - from[i + 2]) * ease;
      }
      this.draw();
      if (progress < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  draw() {
    const { canvas, ctx } = this;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!ctx || !width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width / 380, height / 220);
    const offsetX = (width - 380 * scale) / 2;
    const offsetY = (height - 220 * scale) / 2;
    for (let tone = 0; tone < inks.length; tone++) {
      ctx.fillStyle = inks[tone];
      const size = Math.max(0.7, (tone === 2 ? 1.38 : 1.05) * scale);
      ctx.beginPath();
      for (let i = 0; i < this.current.length; i += 3) {
        const shade = this.current[i + 2];
        const ink = shade < 132 ? 0 : shade < 191 ? 1 : 2;
        if (ink !== tone) continue;
        const x = offsetX + this.current[i] * 380 / 255 * scale;
        const y = offsetY + this.current[i + 1] * 220 / 255 * scale;
        ctx.rect(x, y, size, size);
      }
      ctx.fill();
    }
  }
}

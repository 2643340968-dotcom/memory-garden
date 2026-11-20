// The two surfaces share one geographic cache. Input positions the most recent
// georeferenced frame immediately while the next vector view is being drawn.
function containsCenter(frame, center) {
  return Math.abs(center.x - frame.camera.x) * frame.k <= frame.width / 2 &&
    Math.abs(center.y - frame.camera.y) * frame.k <= frame.height / 2;
}

export class AtlasCharts {
  constructor(root, redraw, {
    surfaces = { base: "#atlas-geography", lens: "#atlas-lens canvas" },
    makeWorker = () => new Worker(new URL("./chart.worker.js", import.meta.url), { type: "module" }),
    loadPainter = () => import("./VectorBasemap.js"),
  } = {}) {
    this.redraw = redraw;
    this.loadPainter = loadPainter;
    this.assetRoot = new URL("./assets/atlas-vectors/", document.baseURI).href;
    this.revision = 0;
    this.layers = {};
    for (const [name, selector] of Object.entries(surfaces)) {
      const canvas = root.querySelector(selector);
      this.layers[name] = { canvas, frame: null, wanted: null };
    }
    this.invalidate = () => { this.revision++; this.redraw(); };
    if (typeof Worker === "function" && typeof OffscreenCanvas === "function") {
      try {
        this.worker = makeWorker();
        this.worker.onmessage = ({ data }) => data.updated ? this.invalidate() : this.receive(data);
        this.worker.onerror = event => { event.preventDefault(); this.useLocalPainter(); };
      } catch { this.useLocalPainter(); }
    } else this.useLocalPainter();
  }

  useLocalPainter() {
    this.worker?.terminate();
    this.worker = null;
    this.busy = null;
    this.local ??= this.loadPainter().then(({ VectorBasemap, paintChart }) => {
      const map = new VectorBasemap(this.invalidate, this.assetRoot);
      const surface = document.createElement("canvas");
      return job => ({ ...paintChart(map, surface, job), bitmap: surface });
    });
    this.redraw();
  }

  update(name, camera, w, h, dpr, language, moving = false, destination = camera) {
    const layer = this.layers[name], base = name === "base";
    layer.view = destination;
    const k = w / camera.span;
    const mx = base ? Math.ceil(Math.min(140, w * .12)) : 0;
    const my = base ? Math.ceil(Math.min(100, h * .12)) : 0;
    const width = w + 2 * mx, height = h + 2 * my;
    const frame = layer.frame;
    let needsFrame = true, scale = 1, x = 0, y = 0;
    if (frame) {
      scale = k / frame.k;
      x = w / 2 + (frame.camera.x - camera.x) * k - frame.width * scale / 2;
      y = h / 2 + (camera.y - frame.camera.y) * k - frame.height * scale / 2;
      if (base) {
        layer.canvas.style.transform = `matrix(${scale},0,0,${scale},${x},${y})`;
      } else {
        // A lens must never show a previous place under the new place's pin.
        layer.canvas.hidden = frame.camera.x !== camera.x || frame.camera.y !== camera.y;
      }
      const tolerance = moving ? .28 : .001;
      needsFrame = frame.revision !== this.revision || frame.language !== language || frame.dpr !== dpr ||
        frame.width !== width || frame.height !== height || Math.abs(Math.log(scale)) > tolerance ||
        x > 1 || y > 1 || x + frame.width * scale < w - 1 || y + frame.height * scale < h - 1;
    }
    // A flight across several zoom levels can prepare its landing chart while
    // the visible frame follows the camera. Free pan and zoom use the current view.
    const wantedK = w / destination.span;
    if (destination !== camera && frame) {
      needsFrame = frame.revision !== this.revision || frame.language !== language || frame.dpr !== dpr ||
        frame.width !== width || frame.height !== height || Math.abs(Math.log(wantedK / frame.k)) > .001 ||
        Math.abs(frame.camera.x - destination.x) * wantedK > mx || Math.abs(frame.camera.y - destination.y) * wantedK > my;
    }
    layer.wanted = needsFrame ? { layer: name, width, height, dpr, k: wantedK, camera: { ...destination, span: width / wantedK },
      language, revision: this.revision, assetRoot: this.assetRoot } : null;
    return frame ? { frame, scale, x, y } : null;
  }

  flush() {
    if (this.busy) return;
    // After a base frame, give a newly opened lens a turn even during a long drag.
    const base = this.layers.base.wanted, lens = this.layers.lens?.wanted;
    const job = (this.lastLayer === "base" ? lens : base) ?? base ?? lens;
    if (!job) return;
    this.busy = job;
    this.lastLayer = job.layer;
    this.layers[job.layer].wanted = null;
    if (this.worker) this.worker.postMessage(job);
    else this.local.then(paint => setTimeout(async () => {
      const result = paint(job);
      if (this.layers[job.layer].context?.transferFromImageBitmap) result.bitmap = await createImageBitmap(result.bitmap);
      this.receive(result);
    }, 0));
  }

  receive({ level, labels, bitmap }) {
    const job = this.busy;
    const layer = this.layers[job.layer], canvas = layer.canvas;
    this.busy = null;
    // A fast reversal may have already brought a cached chart back on screen.
    if (layer.frame && containsCenter(layer.frame, layer.view) && !containsCenter(job, layer.view)) {
      bitmap.close?.();
      this.redraw();
      return;
    }
    if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
    if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
    canvas.style.width = job.width + "px";
    canvas.style.height = job.height + "px";
    if (!layer.context) {
      layer.context = this.worker && canvas.getContext("bitmaprenderer");
      layer.context ||= canvas.getContext("2d", { alpha: false });
    }
    if (layer.context.transferFromImageBitmap) layer.context.transferFromImageBitmap(bitmap);
    else layer.context.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    layer.frame = { ...job, level, labels };
    this.redraw();
  }
}

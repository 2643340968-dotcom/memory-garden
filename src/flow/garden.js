import {PLACES} from "../atlas/places.js";
import {getLanguage, getLocalizedMemoryText, placeText, t} from "../i18n/LanguageController.js";
import {createMemoryPool} from "../data/memoryPool.js";
import {VisitorMemoryCard} from "../memory/VisitorMemoryCard.js";
import {clamp, hash, noise, TAU} from "./geometry.js";
import {waterprint} from "./ripples.js";

const el = id => document.getElementById(id);
const say = (cn, en) => getLanguage() === "zh-CN" ? cn : en;
const GOLDEN = .618033988749895;

function gardenPositions(count, area) {
  const {x, y, w, h} = area;
  const pts = [ [ x + w * .35, y + h * .31 ], [ x + w * .71, y + h * .68 ] ];
  for (let i = 2; i < count; i++) {
    let best = null, score = -1;
    for (let c = 0; c < 56; c++) {
      const n = i * 37 + c, px = x + w * (.055 + .89 * ((n * GOLDEN) % 1)),
            py = y + h * (.08 + .84 * ((n * .41421356237) % 1));
      const distance =
          Math.min(...pts.map(([ ax, ay ], j) => Math.hypot(px - ax, py - ay) - (j < 2 ? 32 : 0)));
      if (distance > score) {
        score = distance;
        best = [ px, py ];
      }
    }
    pts.push(best);
  }
  return pts.slice(0, count);
}

function drawBed(ctx, w, h, area, pts, seed) {
  ctx.fillStyle = "#faf8f2";
  ctx.fillRect(0, 0, w, h);
  const {x, y, w : aw, h : ah} = area;
  // A plan view of three interleaving beds. Fine printed islands are terrain;
  // only button-backed marks carry a particular memory.
  const current = (u, n) => .52 + .16 * Math.sin(u * 6.4 + seed + n * .48) +
      .14 * Math.cos(u * 9.1 - .8 + n * .88) + .09 * (u - .5);
  const spacing = w < 650 ? 4.3 : 5.1;
  const palette = [ "#8bbfc4", "#75b6d3", "#a298c9", "#a7c789", "#df9b82" ];
  const prints = palette.map(() => new Path2D());
  for (let py = 0; py < h; py += spacing)
    for (let px = 0; px < w; px += spacing) {
      const u = (px - x) / aw, v = (py - y) / ah;
      const n = noise(u * 11 + seed, v * 11 + seed);
      const d = Math.min(Math.abs(v - current(u, -.65)), Math.abs(v - current(u, 1.1)) + .06);
      const extent = clamp(1.26 - Math.abs(u - .5) * 2, 0, 1);
      const islands = noise(u * 5.2 - seed, v * 6.7 + 5.5);
      const density = clamp((.23 - d) * 3.7 + (n - .49) * 1.15 + (islands - .52) * .95, 0, 1) * extent;
      if (density < .07)
        continue;
      const radius = (.18 + density * 2.18) * (w < 600 ? .84 : 1);
      const index = Math.min(4, Math.floor(noise(u * 5 + 2.3, v * 6 + .2) * 5));
      const p = prints[index];
      p.moveTo(px + radius, py);
      p.arc(px, py, radius, 0, TAU);
    }
  prints.forEach((path, i) => {
    ctx.fillStyle = palette[i];
    ctx.fill(path);
  });
  // Broken clusters of tiny ink grains describe the bed between readable marks.
  const grains = palette.map(() => new Path2D());
  const stations = Math.round(clamp(aw / 12, 32, 110)), salt = Math.round(seed * 51);
  for (let n = 0; n < stations; n++) {
    const u = hash(n, salt), v = current(u, hash(n, 14) * 2 - 1) + (hash(n, 31) - .5) * .32;
    const px = x + u * aw, py = y + v * ah, spread = 4 + hash(n, 8) * 8;
    const plate = grains[Math.floor(hash(n, 33) * grains.length)];
    for (let j = 0; j < 9; j++) {
      const angle = TAU * hash(n, j + 1), d = hash(n, j + 15) * spread;
      const gx = px + Math.cos(angle) * d, gy = py + Math.sin(angle) * d * .64,
            r = .55 + hash(n, 53 + j) * 1.3;
      plate.moveTo(gx + r, gy);
      plate.arc(gx, gy, r, 0, TAU);
    }
  }
  grains.forEach((path, i) => {
    ctx.fillStyle = palette[i];
    ctx.fill(path);
  });
  for (let i = 0; i < 61; i++) {
    const k = i / 60, channel = (k - .5) * .22;
    ctx.beginPath();
    for (let j = 0; j <= 115; j++) {
      const u = -.29 + j / 115 * 1.61, px = x + aw * u,
            py = y + ah * (current(u, k * 2 - .8) + channel + .026 * Math.sin(13 * u + seed + k * 3));
      if (!j)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
    }
    ctx.strokeStyle = i % 7 === 0 ? "#777ba854" : i % 2 ? "#7fb9c047" : "#b995ba3f";
    ctx.lineWidth = i % 6 === 0 ? 1 : .58;
    ctx.stroke();
  }
  for (let i = 0; i < 2; i++) {
    if (!pts[i])
      continue;
    const [px, py] = pts[i], r = clamp(Math.min(aw, ah) * (.34 + i * .045), 58, w < 600 ? 137 : 218);
    waterprint(ctx, px, py, r, .7 + i, seed + i * 2.9, .97);
  }
}

export class FlowGarden {
  constructor({saved, readout}) {
    this.saved = saved;
    this.readout = readout;
    this.root = el("garden");
    this.canvas = el("waterbed");
    this.seedLayer = el("seeds");
    this.ctx = this.canvas.getContext("2d");
    this.visits = new Map();
    this.page = 0;
    this.sheet = el("sheet");
    this.form = el("memory-form");
    this.text = el("memory-text");
    this.card = new VisitorMemoryCard(this.form, {
      audioManager : {connectVisitorPlayer : player => () => player.pause()},
      onChange : () => this.updateSave(),
      onRead : memory => this.openEditor(memory),
      onWrite : () => this.openEditor(),
    });
    this.text.addEventListener("input", () => this.updateSave());
    this.form.addEventListener("submit", e => {
      e.preventDefault();
      this.submit();
    });
    el("write").onclick = () => this.openEditor();
    el("close-sheet").onclick = () => this.sheet.close();
    this.sheet.addEventListener("close", () => {
      this.card.hide();
      this.clearRecord();
      this.mode = null;
    });
    this.sheet.addEventListener("click", event => {
      if (event.target !== this.sheet)
        return;
      const r = this.sheet.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top ||
          event.clientY > r.bottom)
        this.sheet.close();
    });
    this.seedLayer.addEventListener("click", e => {
      const mark = e.target.closest("button");
      if (!mark)
        return;
      const memory = this.visit.pool.getById(mark.dataset.id);
      if (memory)
        this.openRecord(memory);
    });
    this.seedLayer.addEventListener("pointerover", e => this.seedHint(e.target.closest("button")));
    this.seedLayer.addEventListener("pointerout", e => {
      if (!e.relatedTarget?.closest?.(".seed"))
        this.readout(null);
    });
    this.seedLayer.addEventListener("focusin", e => this.seedHint(e.target.closest("button")));
    this.seedLayer.addEventListener("focusout", () => this.readout(null));
    el("earlier").onclick = () => this.turn(-1);
    el("later").onclick = () => this.turn(1);
    this.resize = new ResizeObserver(() => this.paint());
    this.resize.observe(this.root);
  }
  enter(id, collection) {
    this.id = id;
    this.site = PLACES[id];
    this.collection = collection;
    if (!this.visits.has(id))
      this.visits.set(id, {
        pool : createMemoryPool({prototypeMemories : collection.memories}),
        draft : "",
        attachment : null
      });
    this.visit = this.visits.get(id);
    this.text.value = this.visit.draft;
    this.card.attachment = this.visit.attachment;
    this.page = 0;
    this.root.hidden = false;
    this.paint();
  }
  leave() {
    if (this.sheet.open)
      this.sheet.close();
    this.card.hide();
    this.clearRecord();
    if (this.visit) {
      this.visit.draft = this.text.value;
      this.visit.attachment = this.card.attachment;
    }
    this.id = null;
    this.visit = null;
    this.card.attachment = null;
    this.root.hidden = true;
    el("pages").hidden = true;
    this.seedLayer.replaceChildren();
    this.layoutKey = null;
  }
  label(memory) {
    const key = this.collection.featuredLabels[memory.id];
    if (key)
      return t(key);
    if (memory.label === "YOUR MEMORY")
      return t("memory.your");
    if (memory.image)
      return t("memory.archiveImage", {number : memory.label.split(" · ").at(-1)});
    if (memory.audio)
      return t("memory.archiveVoice") + " " + (memory.audioId ?? "");
    return t("memory.example");
  }
  seedHint(mark) {
    if (mark)
      this.readout(this.label(this.visit.pool.getById(mark.dataset.id)));
  }
  turn(n) {
    this.page += n;
    this.layoutKey = null;
    this.paint();
    const target = n > 0 ? el("later") : el("earlier");
    if (target.disabled)
      this.seedLayer.querySelector("button")?.focus();
  }
  paint() {
    if (!this.id || this.root.hidden)
      return;
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h)
      return;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8000000 / (w * h)));
    const compact = w < 740;
    const top = h * (compact ? .09 : .10);
    const area = {
      x : w * (compact ? .05 : .08),
      y : top,
      w : w * (compact ? .9 : .84),
      h : Math.max(95, h - top - Math.max(65, h * .12))
    };
    const featured = this.collection.memories.filter(m => this.collection.featuredLabels[m.id]);
    const regular =
        [...this.visit.pool.sessionMemories ].reverse().concat(this.collection.memories.filter(
            m => !this.collection.featuredLabels[m.id] && m.label !== "writing-prompt"));
    const cap = Math.max(4, Math.min(46, Math.floor(area.w * area.h / (compact ? 5200 : 6400))));
    const pages = Math.max(1, Math.ceil(regular.length / cap));
    this.page = clamp(this.page, 0, pages - 1);
    const records = featured.concat(regular.slice(this.page * cap, (this.page + 1) * cap));
    const key = [
      this.id, this.page, w, h, top, dpr, getLanguage(), this.visit.pool.sessionMemories.length
    ].join("|");
    if (key === this.layoutKey)
      return;
    this.layoutKey = key;
    const pts = gardenPositions(records.length, area);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const seed = Array.from(this.id).reduce((n, c) => n + c.charCodeAt(0), 0) % 97 / 17;
    drawBed(this.ctx, w, h, area, pts, seed);
    const nodes = records.map((memory, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seed";
      b.dataset.id = memory.id;
      b.dataset.kind = i < featured.length ? "featured" :
          (memory.image || memory.audio)   ? "archive" :
                                             "personal";
      b.style.left = pts[i][0] + "px";
      b.style.top = pts[i][1] + "px";
      b.style.setProperty("--turn", Math.round(hash(i, 7) * 150) + "deg");
      b.style.setProperty(
          "--seed-size", i < featured.length ? (i ? 37 : 44) + "px" : (11 + hash(i, 4) * 8) + "px");
      b.style.setProperty(
          "--seed-ink", [ "#546f99", "#736b9e", "#658888", "#a27279" ][Math.floor(hash(i, 8) * 4)]);
      const label = this.label(memory);
      b.setAttribute("aria-label", label);
      const m = document.createElement("i");
      m.setAttribute("aria-hidden", "true");
      const caption = document.createElement("span");
      caption.textContent = label;
      b.append(m, caption);
      return b;
    });
    const focusId =
        this.seedLayer.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    this.seedLayer.replaceChildren(...nodes);
    if (focusId)
      nodes.find(b => b.dataset.id === focusId)?.focus({preventScroll : true});
    el("pages").hidden = pages === 1;
    el("pages").querySelector("span").textContent = (this.page + 1) + " / " + pages;
    el("earlier").disabled = this.page === 0;
    el("later").disabled = this.page === pages - 1;
    el("earlier").setAttribute("aria-label", say("上一组记忆", "Previous memories"));
    el("later").setAttribute("aria-label", say("下一组记忆", "Next memories"));
  }
  updateSave() {
    el("save").disabled = !this.visit || !this.card?.editable || !!this.card.pending ||
        !(this.text.value.trim() || this.card.attachment);
  }
  showSheet(titleId) {
    this.sheet.setAttribute("aria-labelledby", titleId);
    el("sheet-place").textContent = placeText(this.site.name);
    if (!this.sheet.open)
      this.sheet.showModal();
  }
  openEditor(memory = null) {
    if (!this.visit)
      return;
    this.mode = "editor";
    this.clearRecord();
    el("record").hidden = true;
    this.form.hidden = false;
    this.showSheet(memory ? "memory-reader-title" : "sheet-title");
    this.card.show(memory, this.visit.pool.sessionMemories);
    this.updateLanguage();
    (memory ? el("close-sheet") : this.text).focus({preventScroll : true});
  }
  submit() {
    this.updateSave();
    if (el("save").disabled)
      return;
    const m = this.visit.pool.addSessionMemory(this.text.value, this.card.attachment);
    if (!m)
      return;
    this.card.attachment = null;
    this.visit.attachment = null;
    this.text.value = this.visit.draft = "";
    this.sheet.close();
    this.page = 0;
    this.paint();
    this.saved();
    this.seedLayer.querySelector("[data-id=\"" + m.id + "\"]")?.focus({preventScroll : true});
  }
  clearRecord() {
    const stage = el("record-media");
    for (const player of stage.querySelectorAll("audio,video")) {
      player.pause();
      player.removeAttribute("src");
      player.load();
    }
    stage.replaceChildren();
    this.currentRecord = null;
  }
  openRecord(memory) {
    if (memory.label === "YOUR MEMORY") {
      this.openEditor(memory);
      return;
    }
    this.card.hide();
    this.clearRecord();
    this.currentRecord = memory;
    this.mode = "record";
    this.form.hidden = true;
    el("record").hidden = false;
    this.showSheet("record-title");
    if (memory.image) {
      const img = new Image();
      img.alt = t("memory.archiveImageAlt");
      img.src = memory.image;
      el("record-media").append(img);
    }
    if (memory.audio) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = memory.audio;
      el("record-media").append(audio);
    }
    this.updateLanguage();
    el("close-sheet").focus();
  }
  updateLanguage() {
    this.paint();
    if (!this.id)
      return;
    el("sheet-place").textContent = placeText(this.site.name);
    el("sheet-title").textContent = say("留下你的记忆", "Leave a memory");
    el("writing-prompt").textContent = placeText(this.site.prompt);
    el("save").textContent = say("在这里发布记忆", "Place this memory here");
    el("close-sheet").setAttribute("aria-label", say("关闭", "Close"));
    this.card.refreshLanguage();
    const m = this.currentRecord;
    if (m) {
      el("record-title").textContent = this.label(m);
      el("record-text").textContent = m.text ? getLocalizedMemoryText(m) : "";
      const link = el("record-source");
      link.hidden = !m.sourceUrl;
      if (m.sourceUrl) {
        link.href = m.sourceUrl;
        link.textContent = m.source + " ↗";
      }
      const image = el("record-media").querySelector("img");
      if (image)
        image.alt = t("memory.archiveImageAlt");
    }
  }
}

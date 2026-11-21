import {PLACES} from "../atlas/places.js";
import {getLanguage, getLocalizedMemoryText, placeText, t} from "../i18n/LanguageController.js";
import {createMemoryPool} from "../data/memoryPool.js";
import {VisitorMemoryCard} from "../memory/VisitorMemoryCard.js";
import {clamp, hash} from "./geometry.js";
import {allForms, flowerKey, plateURL} from "./flowerForms.js";

const el = id => document.getElementById(id);
const say = (cn, en) => getLanguage() === "zh-CN" ? cn : en;
const sources = {
  "Visit Nanjing": ["南京旅游", "Visit Nanjing"],
  "UNESCO": ["联合国教科文组织", "UNESCO"],
  "UNESCO World Heritage Centre": ["联合国教科文组织世界遗产中心", "UNESCO World Heritage Centre"],
  "北京市人民政府 / Beijing Government": ["北京市人民政府", "Beijing Government"],
  "Wikipedia · 维基百科": ["维基百科", "Wikipedia"],
};
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

// Fine contour lines and translucent leaves are printed once beneath the live flowers.
function drawBed(ctx, w, h, area, seed, form) {
  ctx.fillStyle = "#faf8f1";
  ctx.fillRect(0, 0, w, h);
  const bank = (u, v) => area.y + area.h * (.54 + .17 * Math.sin(u * 4.2 + seed + .62 * v) +
      .069 * Math.cos(u * 8.5 - v * .82) + v * .25);
  for (const [u, v, colour] of [[.23,.14,form.tip],[.73,-.38,"#bacfba"],[.61,.63,form.mid]]) {
    const x = area.x + u * area.w, y = bank(u, v), r = Math.min(w, h) * .52;
    const wash = ctx.createRadialGradient(x, y, 0, x, y, r);
    wash.addColorStop(0, colour + "4a");
    wash.addColorStop(.48, colour + "20");
    wash.addColorStop(1, colour + "00");
    ctx.fillStyle = wash;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 26; i++) {
    const v = (i - 12) / 13;
    ctx.beginPath();
    for (let j = 0; j <= 100; j++) {
      const u = -.22 + j * .0144, x = area.x + u * area.w, y = bank(u, v);
      if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.lineWidth = i % 6 ? .65 : 1.15;
    ctx.strokeStyle = i % 5 ? "#a7b79e40" : form.hem + "3d";
    ctx.stroke();
  }
  for (let i = 0; i < 52; i++) {
    const u = hash(i, 12 + seed) * 1.35 - .17, v = (hash(i, 31) - .5) * 2;
    const x = area.x + u * area.w, y = bank(u, v);
    const angle = Math.atan2(bank(u + .01, v) - y, area.w * .01) + (i % 2 ? -.55 : .55);
    const length = 4 + hash(i, 6) * Math.min(20, area.w * .026);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(length, length * .25);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(.5, -1, 1, 0);
    ctx.quadraticCurveTo(.55, .7, 0, 0);
    ctx.fillStyle = i % 4 ? "#9cb89757" : form.hem + "45";
    ctx.fill();
    ctx.restore();
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
        this.seedHint(null);
    });
    this.seedLayer.addEventListener("focusin", e => this.seedHint(e.target.closest("button")));
    this.seedLayer.addEventListener("focusout", () => this.seedHint(null));
    el("earlier").onclick = () => this.turn(-1);
    el("later").onclick = () => this.turn(1);
    this.resize = new ResizeObserver(() => this.paint());
    this.resize.observe(this.root);
  }
  enter(id, collection, revealDelay = 0) {
    this.born = new Map();
    this.slots = [];
    this.entryTime = performance.now() + revealDelay;
    this.id = id;
    this.site = PLACES[id];
    this.flower = flowerKey(this.site.study);
    this.root.style.setProperty("--flower-ink", allForms[this.flower].hem);
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
      return [t("memory.archiveVoice"), memory.audioId?.match(/\d+$/)?.[0]].filter(Boolean).join(" ");
    return t("memory.example");
  }
  seedHint(mark) {
    this.readout(mark ? this.label(this.visit.pool.getById(mark.dataset.id)) : null);
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
    // Publishing puts the newest memory first in reading order. Give it a vacant
    // physical spot so the flowers that are already growing keep their roots.
    const ids = new Set(records.map(memory => memory.id));
    const nextSlots = Array.from({length:records.length}, (_, i) => {
      const id = this.slots[i];
      return ids.delete(id) ? id : null;
    });
    const arriving = ids.values();
    this.slots = nextSlots.map(id => id ?? arriving.next().value);
    const pts = gardenPositions(records.length, area);
    const positions = new Map(this.slots.map((id, i) => [id, pts[i]]));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const seed = Array.from(this.id).reduce((n, c) => n + c.charCodeAt(0), 0) % 97 / 17;
    drawBed(this.ctx, w, h, area, seed, allForms[this.flower]);
    const now = performance.now();
    const nodes = records.map((memory, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seed";
      b.dataset.id = memory.id;
      b.dataset.kind = i < featured.length ? "featured" :
          (memory.image || memory.audio)   ? "archive" :
                                             "personal";
      const [x, y] = positions.get(memory.id);
      b.style.left = x + "px";
      b.style.top = y + "px";
      const phase = hash(Array.from(memory.id).reduce((n, ch) => n + ch.charCodeAt(0), 0), 7);
      b.style.setProperty("--turn", (phase - .5) * 55 + "deg");
      const featuredSize = clamp(Math.min(area.w, area.h) * .27, compact ? 81 : 113, compact ? 106 : 162);
      const size = i < featured.length ? featuredSize * (i ? .88 : 1) :
          (compact ? 32 : 44) * (.86 + phase * .45);
      b.style.setProperty("--seed-size", size + "px");
      const label = this.label(memory);
      b.setAttribute("aria-label", label);
      const m = new Image();
      m.alt = "";
      m.draggable = false;
      m.src = plateURL(this.flower);
      m.className = "garden-blossom";
      if (!this.born.has(memory.id)) {
        const personal = memory.label === "YOUR MEMORY";
        this.born.set(memory.id, personal ? now : Math.max(now, this.entryTime) + Math.min(i, 18) * 55);
      }
      const delay = this.born.get(memory.id) - now;
      if (delay > -1850) {
        m.classList.add("unfolding");
        m.style.animationDelay = delay + "ms";
      }
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
        link.textContent = say(...(sources[m.source] ?? ["查看来源", "View source"])) + " ↗";
      }
      const image = el("record-media").querySelector("img");
      if (image)
        image.alt = t("memory.archiveImageAlt");
    }
  }
}

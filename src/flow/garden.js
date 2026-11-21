import {PLACES} from "../atlas/places.js";
import {getLanguage, getLocalizedMemoryText, placeText, t} from "../i18n/LanguageController.js";
import {createMemoryPool} from "../data/memoryPool.js";
import {VisitorMemoryCard} from "../memory/VisitorMemoryCard.js";
import {clamp, hash} from "./geometry.js";
import {forms, profileURL} from "./flowerForms.js";
import {drawUnderstory, gardenDefs, gardenPositions, plantArtwork} from "./standingGarden.js";

const el = id => document.getElementById(id);
const say = (cn, en) => getLanguage() === "zh-CN" ? cn : en;
const sources = {
  "Visit Nanjing": ["南京旅游", "Visit Nanjing"],
  "UNESCO": ["联合国教科文组织", "UNESCO"],
  "UNESCO World Heritage Centre": ["联合国教科文组织世界遗产中心", "UNESCO World Heritage Centre"],
  "北京市人民政府 / Beijing Government": ["北京市人民政府", "Beijing Government"],
  "Wikipedia · 维基百科": ["维基百科", "Wikipedia"],
};
export class FlowGarden {
  constructor({saved, readout}) {
    this.saved = saved;
    this.readout = readout;
    this.root = el("garden");
    this.canvas = el("waterbed");
    this.seedLayer = el("seeds");
    this.stalks = el("stalks");
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
    this.departure?.cancel();
    this.departure = null;
    this.root.inert = false;
    this.root.classList.remove("departing");
    this.born = new Map();
    this.slots = [];
    this.entryTime = performance.now() + revealDelay;
    this.id = id;
    this.site = PLACES[id];
    this.flower = this.site.city;
    this.root.style.setProperty("--flower-ink", forms[this.flower].hem);
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
  leave(linger = false) {
    this.departure?.cancel();
    this.departure = null;
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
    this.root.inert = true;
    const finish = () => {
      this.root.hidden = true;
      this.root.classList.remove("departing");
      this.seedLayer.replaceChildren();
      this.stalks.replaceChildren();
      this.departure = null;
    };
    if (linger && !this.root.hidden) {
      this.root.classList.add("departing");
      this.departure = this.root.animate([{transform:"none",opacity:1},{transform:"translateY(17%)",opacity:0}],
        {duration:490,easing:"cubic-bezier(.3,.08,.3,1)"});
      this.departure.onfinish = finish;
    } else finish();
    el("pages").hidden = true;
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
    const top = Math.max(h * .10, el("toolbar-panel").getBoundingClientRect().bottom + (compact ? 9 : 17));
    const area = {
      x : w * (compact ? .085 : .073),
      y : top,
      w : w * (compact ? .83 : .854),
      h : Math.max(95, h - top - Math.max(24, h * .04))
    };
    const featured = this.collection.memories.filter(m => this.collection.featuredLabels[m.id]);
    const regular =
        [...this.visit.pool.sessionMemories ].reverse().concat(this.collection.memories.filter(
            m => !this.collection.featuredLabels[m.id] && m.label !== "writing-prompt"));
    const cap = Math.max(4, Math.min(32, Math.floor(area.w * area.h / (compact ? 17800 : 24500))));
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
    drawUnderstory(this.ctx,w,h,Math.round(seed*17),forms[this.flower]);
    this.stalks.setAttribute("viewBox","0 0 "+w+" "+h);
    const stems = [gardenDefs(forms[this.flower])];
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
      b.style.setProperty("--turn", (phase - .5) * 25 + "deg");
      const featuredSize = clamp(Math.min(area.w, area.h) * .31, compact ? 87 : 148, compact ? 123 : 208);
      const size = i < featured.length ? featuredSize * (i ? .88 : 1) :
          (compact ? 47 : 65) * (.82 + phase * .55);
      b.style.setProperty("--seed-size", size + "px");
      const label = this.label(memory);
      b.setAttribute("aria-label", label);
      const m = new Image();
      m.alt = "";
      m.draggable = false;
      const slot = this.slots.indexOf(memory.id);
      const view = slot % 3 === 0 ? "front" : "side";
      m.src = profileURL(this.flower,view);
      b.dataset.view = view;
      m.className = "garden-blossom";
      if (!this.born.has(memory.id)) {
        const personal = memory.label === "YOUR MEMORY";
        this.born.set(memory.id, personal ? now : Math.max(now, this.entryTime) + Math.min(i, 18) * 55);
      }
      const delay = this.born.get(memory.id) - now;
      stems.push(plantArtwork({x,y,size,phase,featured:i<featured.length,city:this.flower,view,bottom:h,width:w,birth:delay}));
      if (delay > -2850) {
        m.classList.add("unfolding");
        m.style.setProperty("--birth",delay + "ms");
        b.style.setProperty("--birth",delay + "ms");
      }
      const caption = document.createElement("span");
      caption.textContent = label;
      b.append(m, caption);
      return b;
    });
    const focusId =
        this.seedLayer.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    this.stalks.replaceChildren(...stems);
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

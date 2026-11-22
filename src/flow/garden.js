import {PLACES} from "./places.js";
import {getLanguage, getLocalizedMemoryText, placeText, t} from "../i18n/LanguageController.js";
import {createMemoryPool} from "../data/memoryPool.js";
import {VisitorMemoryCard} from "../memory/VisitorMemoryCard.js";
import {clamp, hash} from "./geometry.js";
import {forms, profileURL} from "./flowerForms.js";
import {drawUnderstory, gardenDefs, gardenPositions, gardenStands, plantArtwork, plantStand} from "./standingGarden.js";

import {GardenBreeze} from "./gardenBreeze.js";
import {GardenSelection} from "./gardenSelection.js";
import {setPetalRhythm} from "./petalLight.js";

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
    this.refreshButton = el("refresh-memories");
    this.refreshButton.onclick = () => this.refresh();
    this.invitation = el("garden-invitation");
    el("invitation-write").onclick = () => this.openEditor();
    el("invitation-browse").onclick = () => {
      this.visit.exploring = true;
      this.updateActions();
      this.seedLayer.querySelector("button")?.focus({preventScroll:true});
    };
    this.stalks.addEventListener("click", e => {
      const id = e.target.closest(".stand-flower")?.closest(".memory-stand")?.dataset.memory;
      if (id && this.visit) this.openRecord(this.recordById(id));
    });
    this.sheet = el("sheet");
    this.breeze = new GardenBreeze(this.root, this.sheet);
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
      // A close event can arrive after another flower has already opened the sheet.
      if (this.sheet.open) return;
      this.card.hide();
      this.clearRecord();
      this.mode = null;
      this.updateActions();
      if (this.visit && !this.root.inert && this.focusAfterSheet && !this.seedLayer.contains(document.activeElement)) {
        const target=document.querySelector(this.focusAfterSheet);
        (target?.getClientRects().length ? target : el("invitation-browse")).focus({preventScroll:true});
      }
      this.focusAfterSheet = null;
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
      const memory = this.recordById(mark.dataset.id);
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
    this.resize = new ResizeObserver(() => this.paint());
    this.resize.observe(this.root);
    this.resize.observe(el("toolbar-panel").parentElement);
  }
  enter(id, collection, events, revealDelay = 0) {
    this.departure?.cancel();
    this.departure = null;
    this.root.inert = false;
    this.root.classList.remove("departing");
    this.born = new Map();
    this.entryTime = performance.now() + revealDelay;
    this.id = id;
    this.site = PLACES[id];
    this.flower = this.site.city;
    this.root.style.setProperty("--flower-ink", forms[this.flower].hem);
    this.collection = collection;
    this.events = new Map(events.map(m => [m.id,m]));
    this.root.style.setProperty("--flower-light", forms[this.flower].mid);
    if (!this.visits.has(id))
      this.visits.set(id, {
        pool : createMemoryPool({prototypeMemories : collection.memories}),
        selection : new GardenSelection(events, collection),
        draft : "",
        attachment : null
      });
    this.visit = this.visits.get(id);
    this.slots = this.visit.slots ?? [];
    this.featuredCount = this.visit.featuredCount ?? 0;
    this.text.value = this.visit.draft;
    this.card.attachment = this.visit.attachment;
    const ns = "http://www.w3.org/2000/svg";
    this.standLayer = document.createElementNS(ns, "g");
    this.stemLayer = document.createElementNS(ns, "g");
    this.stalks.replaceChildren(gardenDefs(forms[this.flower],this.flower), this.standLayer, this.stemLayer);
    this.root.hidden = false;
    this.updateActions();
    this.paint();
  }
  updateActions() {
    const present = Boolean(this.visit && !this.root.closest("[inert]") && !this.sheet.open);
    this.invitation.hidden = !present || this.visit.exploring === true;
    el("garden-actions").hidden = !present || this.visit.exploring !== true;
    this.refreshButton.hidden = !this.visit?.selection.hasMore;
  }
  leave(linger = false) {
    this.invitation.hidden = true;
    this.stopRefresh();
    this.breeze.clear();
    this.departure?.cancel();
    this.departure = null;
    if (this.sheet.open)
      this.sheet.close();
    this.card.hide();
    this.clearRecord();
    if (this.visit) {
      this.visit.draft = this.text.value;
      this.visit.attachment = this.card.attachment;
      this.visit.slots = this.slots;
      this.visit.featuredCount = this.featuredCount;
    }
    this.id = null;
    this.visit = null;
    this.updateActions();
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
    this.layoutKey = this.paperKey = this.standKey = null;
    this.labelsLanguage = null;
    el("batch-status").textContent = "";
  }
  recordById(id) {
    return this.events.get(id) ?? this.visit.pool.getById(id);
  }
  label(memory) {
    if (memory.title) return placeText(memory.title);
    if (memory.id.endsWith("-record")) return say("地点札记", "Place note");
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
    this.readout(mark ? say("点花阅读", "Select to read") : null);
  }
  stopRefresh() {
    for (const motion of this.refreshMotion ?? []) motion.cancel();
    this.refreshMotion = null;
    this.refreshButton.removeAttribute("aria-disabled");
  }
  async refresh() {
    const selection = this.visit?.selection;
    if (!selection?.hasMore || this.refreshMotion || !this.visit.exploring || this.sheet.open) return;
    const motion = this.refreshMotion = [];
    this.refreshButton.setAttribute("aria-disabled", "true");
    const layers = [this.stemLayer, this.seedLayer];
    const fade = async (from, to, duration) => {
      if (this.breeze.quiet.matches) return;
      for (const old of motion.splice(0)) old.cancel();
      for (const layer of layers) motion.push(layer.animate([{opacity:from}, {opacity:to}],
        {duration, easing:"cubic-bezier(.25,.62,.35,1)", fill:"forwards"}));
      await Promise.all(motion.map(animation => animation.finished));
    };
    try {
      await fade(1, .22, 165);
      if (this.refreshMotion !== motion) return;
      selection.advance();
      this.paint();
      const first = this.recordById(selection.featured[0] ?? selection.regular[0]);
      el("batch-status").replaceChildren(say("已换一批记忆。", "Another selection is in bloom. ") + this.label(first));
      await fade(.22, 1, 315);
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    } finally {
      if (this.refreshMotion === motion) this.stopRefresh();
    }
  }
  paint() {
    if (!this.id || this.root.hidden)
      return;
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h)
      return;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8000000 / (w * h)));
    const compact = w < 740;
    const top = Math.max(h * .10, el("toolbar-panel").parentElement.getBoundingClientRect().bottom + (compact ? 9 : 17));
    const area = {
      x : w * (compact ? .085 : .073),
      y : top,
      w : w * (compact ? .83 : .854),
      h : Math.max(95, h - top - Math.max(24, h * .04))
    };
    const featured = this.visit.selection.featured;
    const regular = this.visit.selection.regular;
    const records = [...featured, ...regular].map(id => this.recordById(id));
    const paperKey = [this.id, w, h, dpr].join("|");
    const standKey = [paperKey, top, featured.length, regular.length].join("|");
    const key = [standKey, ...featured, ...regular].join("|");
    if (key === this.layoutKey) return;
    this.layoutKey = key;

    // A new memory takes an empty root. Flowers shared with the previous
    // selection keep their position, including the larger historical flowers.
    const retain = (previous, ids) => {
      const waiting = new Set(ids);
      const slots = ids.map((_, i) => waiting.delete(previous[i]) ? previous[i] : null);
      const arrivals = waiting.values();
      return slots.map(id => id ?? arrivals.next().value);
    };
    this.slots = retain(this.slots.slice(0,this.featuredCount),featured)
      .concat(retain(this.slots.slice(this.featuredCount),regular));
    this.featuredCount = featured.length;
    const now = performance.now();
    const seed = Array.from(this.id).reduce((n, c) => n + c.charCodeAt(0), 0) % 97;
    if (paperKey !== this.paperKey) {
      this.paperKey = paperKey;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawUnderstory(this.ctx,w,h,seed,forms[this.flower]);
    }
    if (standKey !== this.standKey) {
      this.standKey = standKey;
      this.points = gardenPositions(records.length,area,featured.length);
      this.stalks.setAttribute("viewBox","0 0 "+w+" "+h);
      const anchors = this.points.map(([x,y], slot) => ({id:slot,x,y}));
      this.stands = gardenStands(w,h,top,seed,anchors).map(stand =>
        ({...plantStand(stand,h,now-this.entryTime), slot:stand.id}));
      this.standLayer.replaceChildren(...this.stands.map(stand => stand.stem));
    }
    for (const stand of this.stands) stand.stem.dataset.memory = this.slots[stand.slot];
    const positions = new Map(this.slots.map((id, i) => [id, this.points[i]]));
    const stems = [];
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
      const grouped = featured.length>2;
      const featuredSize = clamp(Math.min(area.w,area.h)*(grouped?.235:.31), compact?(grouped?63:85):(grouped?91:133),
        compact?(grouped?107:125):(grouped?170:203));
      const size = i < featured.length ? featuredSize * (.90 + phase*.15) :
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
      const body = document.createElement("span");
      body.className = "petal-body";
      body.style.setProperty("--crown", 'url("' + m.src + '")');
      setPetalRhythm(b,memory.id,i<featured.length);
      body.append(m);
      if (!this.born.has(memory.id)) {
        const personal = memory.label === "YOUR MEMORY";
        const birth = personal ? now : Math.max(now, this.entryTime) + i * 55;
        this.born.set(memory.id, this.refreshMotion ? now - 3000 : birth);
      }
      const delay = this.born.get(memory.id) - now;
      stems.push(plantArtwork({x,y,size,phase,featured:i<featured.length,city:this.flower,view,bottom:h,width:w,birth:delay}));
      if (delay > -2850) {
        body.classList.add("new-crown");
        m.classList.add("unfolding");
        m.style.setProperty("--birth",delay + "ms");
        b.style.setProperty("--birth",delay + "ms");
      }
      const caption = document.createElement("span");
      caption.className = "seed-caption";
      caption.textContent = say("点花阅读", "Select to read");
      b.append(body, caption);
      return b;
    });
    const focusId =
        this.seedLayer.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    this.stemLayer.replaceChildren(...stems);
    this.seedLayer.replaceChildren(...nodes);
    this.breeze.bind(stems,nodes,this.stands);
    this.labelsLanguage = getLanguage();
    if (focusId)
      nodes.find(b => b.dataset.id === focusId)?.focus({preventScroll : true});
  }
  updateSave() {
    el("save").disabled = !this.visit || !this.card?.editable || !!this.card.pending ||
        !(this.text.value.trim() || this.card.attachment);
  }
  showSheet(titleId) {
    this.stopRefresh();
    if (!this.sheet.open) {
      const seedId = this.currentRecord?.id ?? document.activeElement.closest?.(".seed")?.dataset.id;
      this.focusAfterSheet = seedId ? '#seeds [data-id="'+CSS.escape(seedId)+'"]' :
        this.visit.exploring ? "#write" : "#invitation-write";
    }
    this.breeze.rest();
    this.sheet.setAttribute("aria-labelledby", titleId);
    el("sheet-place").textContent = placeText(this.site.name);
    if (!this.sheet.open)
      this.sheet.showModal();
    this.updateActions();
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
    this.visit.contributed = true;
    this.sheet.close();
    this.visit.selection.includeVisitor(m.id);
    this.updateActions();
    this.updateLanguage();
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
    if (this.labelsLanguage !== getLanguage()) {
      this.labelsLanguage = getLanguage();
      el("batch-status").textContent = "";
      for (const button of this.seedLayer.children) {
        button.setAttribute("aria-label", this.label(this.recordById(button.dataset.id)));
        button.querySelector(".seed-caption").textContent = say("点花阅读", "Select to read");
      }
    }
    el("garden-actions").setAttribute("aria-label", say("花园操作", "Garden actions"));
    this.refreshButton.querySelector("span").textContent = say("换一批记忆", "Refresh memories");
    el("sheet-place").textContent = placeText(this.site.name);
    el("sheet-title").textContent = say("留下你的记忆", "Leave a memory");
    el("invitation-title").textContent = this.visit.contributed ? say("你的记忆已在这里生长", "Your memory is growing here") : say("关于这里，你记得什么？", "What do you remember here?");
    el("invitation-write").hidden = Boolean(this.visit.contributed);
    el("invitation-note").textContent = this.visit.contributed ? say("点花可回看自己的留言，也能读到这个地点的往事。","Pick a flower to revisit your memory or read another story from this place.") : say("点一朵花，读一段往事。你也可以留下文字、照片、一段声音或影像。",
      "Pick a flower to read its story. You can also leave a few words, a photo, audio or video.");
    el("invitation-write").textContent = say("留下记忆", "Leave a memory");
    el("invitation-browse").textContent = this.visit.contributed ? say("探索花园","Explore the garden") : say("先逛花园", "Explore the garden");
    el("writing-prompt").textContent = placeText(this.site.prompt);
    el("save").textContent = say("在这里发布记忆", "Place this memory here");
    el("close-sheet").setAttribute("aria-label", say("关闭", "Close"));
    this.card.refreshLanguage();
    const m = this.currentRecord;
    if (m) {
      el("record-title").textContent = this.label(m);
      const when = el("record-date");
      when.hidden = !m.dateLabel;
      when.textContent = m.dateLabel ? placeText(m.dateLabel) : "";
      el("record-text").textContent = m.body ? placeText(m.body) : m.text ? getLocalizedMemoryText(m) : "";
      const link = el("record-source");
      link.hidden = !m.sourceUrl;
      if (m.sourceUrl) {
        link.href = m.sourceUrl;
        link.textContent = placeText(m.sourceNames ?? sources[m.source] ?? ["查看来源", "View source"]) + " ↗";
      }
      const image = el("record-media").querySelector("img");
      if (image)
        image.alt = t("memory.archiveImageAlt");
    }
  }
}

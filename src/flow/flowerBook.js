import {nationalMarks} from "./overview.js";
import {cityFlowers} from "./cityFlowers.js";
import {plateURL, profileURL} from "./flowerForms.js";
import {placeText} from "../i18n/LanguageController.js";

export class FlowerBook {
  constructor(dialog, onVisibility) {
    this.dialog = dialog;
    this.view = "overhead";
    this.views = dialog.querySelector("#book-views");
    this.views.onclick = e => {
      const view = e.target.closest("[data-view]")?.dataset.view;
      if (view) { this.view = view; this.updateLanguage(this.zh); }
    };
    this.grid = dialog.querySelector(".book-grid");
    this.openControl = document.getElementById("open-flower-book");
    this.closeControl = dialog.querySelector("#close-book");
    this.onVisibility = onVisibility;
    this.leaf = document.getElementById("city-leaf");
    this.previewOpen = document.getElementById("leaf-open");
    this.previewOpen.onclick = () => this.open();
    this.previewClose = document.getElementById("leaf-close");
    this.previewClose.onclick = () => {
      this.leaf.hidden = true;
      document.getElementById("map").focus({preventScroll:true});
    };
    this.openControl.onclick = () => this.open();
    this.coverControl = document.getElementById("cover-book");
    this.coverControl.onclick = () => this.open();
    const close = () => {
      dialog.close();
      this.restoreFocus();
    };
    this.closeControl.onclick = close;
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") event.stopPropagation();
    });
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top ||
          event.clientY > bounds.bottom)
        close();
    });
    dialog.addEventListener("close", () => {
      const url = new URL(location.href);
      if (url.searchParams.has("flowers")) {
        url.searchParams.delete("flowers");
        history.replaceState(history.state, "", url);
      }
      this.onVisibility(false);
      if (document.activeElement === document.body || dialog.contains(document.activeElement)) this.restoreFocus();
    });
  }
  restoreFocus() {
    const trigger = this.trigger?.getClientRects().length ? this.trigger : this.coverControl;
    trigger.focus({preventScroll:true});
  }
  destination(city, introduce) {
    this.city = city;
    this.pendingCity = introduce && !this.leafSeen ? city : null;
    this.leaf.hidden = true;
  }
  cityLanded(city) {
    if (this.pendingCity !== city || this.dialog.open || document.hidden) return;
    this.leafSeen = true;
    this.pendingCity = null;
    this.fillLeaf();
    this.leaf.hidden = false;
  }
  fillLeaf() {
    const mark = nationalMarks.find(m=>m.id === this.city);
    if (!mark) return;
    const specimen = cityFlowers[this.city];
    document.getElementById("leaf-plate").src = plateURL(this.city);
    document.getElementById("leaf-city").textContent = (this.zh ? "城市花谱" : "City Flower Atlas") + " · " + placeText(mark.name);
    document.getElementById("leaf-title").textContent = placeText(specimen.name);
    document.getElementById("leaf-note").textContent = placeText(specimen.reason);
    this.previewOpen.textContent = this.zh ? "翻开完整花谱" : "Open the flower atlas";
    this.previewClose.setAttribute("aria-label", this.zh ? "收起这一页" : "Close this page");
  }
  open() {
    if (this.dialog.open) return;
    const fromLeaf = this.leaf.contains(document.activeElement);
    this.trigger = document.activeElement === this.openControl ? this.openControl : this.coverControl;
    if (this.pendingCity) { this.pendingCity = null; this.leafSeen = true; }
    this.leaf.hidden = true;
    this.onVisibility(true);
    this.dialog.showModal();
    if (!this.entries) this.build();
    const entry = this.entries.find(e=>e.mark.id === this.city);
    if (entry) entry.item.scrollIntoView({block:"start"});
    else this.dialog.scrollTop = 0;
    if (fromLeaf) this.closeControl.focus({preventScroll:true});
  }
  build() {
    this.entries = nationalMarks.map(mark => {
      const item = document.createElement("article"), art = new Image();
      const plate = document.createElement("a");
      plate.className = "book-plate";
      plate.href = plateURL(mark.id);
      plate.target = "_blank";
      plate.rel = "noopener";
      art.width = art.height = 256;
      art.alt = "";
      art.src = plate.href;
      plate.append(art);
      const caption = document.createElement("div"), city = document.createElement("p");
      const name = document.createElement("h3"), reason = document.createElement("p"),
            source = document.createElement("a");
      city.className = "book-city";
      reason.className = "book-note";
      item.dataset.city = mark.id;
      source.href = cityFlowers[mark.id].url;
      source.target = "_blank";
      source.rel = "noreferrer";
      caption.append(city, name, reason, source);
      item.append(plate, caption);
      this.grid.append(item);
      return {mark, item, art, plate, city, name, reason, source};
    });
    this.updateLanguage(this.zh);
  }
  updateLanguage(zh) {
    this.zh = zh;
    const heading = zh ? "城市花谱" : "City Flower Atlas";
    this.openControl.textContent = heading;
    this.coverControl.firstElementChild.textContent = heading;
    this.coverControl.setAttribute("aria-label", heading);
    if (!this.leaf.hidden) this.fillLeaf();
    this.dialog.querySelector("h2").textContent = heading;
    this.closeControl.setAttribute("aria-label", zh ? "合上花谱" : "Close flower book");
    const language = this.dialog.querySelector("#book-language");
    language.textContent = zh ? "英文" : "Chinese";
    language.setAttribute("aria-label", zh ? "切换为英文" : "Switch to Chinese");
    const i = zh ? 0 : 1;
    const views = {overhead:["俯视","Above"], front:["正面","Front"], side:["侧面","Side"]};
    this.views.setAttribute("aria-label", zh ? "花朵视角" : "Flower view");
    for (const b of this.views.children) {
      b.textContent = views[b.dataset.view][i];
      b.setAttribute("aria-pressed", String(this.view === b.dataset.view));
    }
    for (const {mark, art, plate, city, name, reason, source} of this.entries ?? []) {
      const flower = cityFlowers[mark.id];
      const url = this.view === "overhead" ? plateURL(mark.id) : profileURL(mark.id, this.view);
      plate.href = url;
      art.src = url;
      city.textContent = placeText(mark.name);
      name.textContent = flower.name[i];
      plate.setAttribute("aria-label", (zh ? "打开正式花图 · " : "Open flower plate · ") + flower.name[i]);
      plate.title = plate.getAttribute("aria-label");
      reason.textContent = flower.reason[i];
      source.textContent = flower.source[i] + " ↗";
      source.setAttribute("aria-label", (zh ? "选花依据，" : "Selection source, ") + flower.source[i]);
    }
  }
}

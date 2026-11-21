import {nationalMarks} from "./overview.js";
import {cityFlowers} from "./cityFlowers.js";
import {loadPlates} from "./coverPlates.js";
import {placeText} from "../i18n/LanguageController.js";

export class FlowerBook {
  constructor(dialog, onVisibility) {
    this.dialog = dialog;
    this.grid = dialog.querySelector(".book-grid");
    this.openControl = document.getElementById("open-flower-book");
    this.closeControl = dialog.querySelector("#close-book");
    this.onVisibility = onVisibility;
    this.openControl.onclick = () => this.open();
    this.coverControl = document.getElementById("cover-book");
    this.coverControl.onclick = () => this.open();
    this.closeControl.onclick = () => dialog.close();
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") event.stopPropagation();
    });
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top ||
          event.clientY > bounds.bottom)
        dialog.close();
    });
    dialog.addEventListener("close", () => {
      const url = new URL(location.href);
      if (url.searchParams.has("flowers")) {
        url.searchParams.delete("flowers");
        history.replaceState(history.state, "", url);
      }
      this.onVisibility(false);
      if (document.activeElement === document.body || this.openControl.closest("[inert]")) {
        const grip = document.getElementById("tools-grip");
        (grip.hidden ? document.getElementById("guide-toggle") : grip).focus({preventScroll: true});
      }
    });
  }
  async open() {
    if (this.dialog.open) return;
    this.onVisibility(true);
    this.dialog.showModal();
    if (this.entries) return;
    this.entries = nationalMarks.map(mark => {
      const item = document.createElement("article"), art = document.createElement("canvas");
      art.width = art.height = 272;
      art.setAttribute("aria-hidden", "true");
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
      item.append(art, caption);
      this.grid.append(item);
      return {mark, art, city, name, reason, source};
    });
    this.updateLanguage(this.zh);
    const plates = await loadPlates();
    for (const {mark, art} of this.entries)
      art.getContext("2d").drawImage(plates[mark.id].body, 0, 0, art.width, art.height);
  }
  updateLanguage(zh) {
    this.zh = zh;
    const heading = zh ? "城市花谱" : "City Flower Atlas";
    this.openControl.textContent = heading;
    this.coverControl.textContent = heading;
    this.dialog.querySelector("h2").textContent = heading;
    this.closeControl.setAttribute("aria-label", zh ? "合上花谱" : "Close flower book");
    const language = this.dialog.querySelector("#book-language");
    language.textContent = zh ? "英文" : "Chinese";
    language.setAttribute("aria-label", zh ? "切换为英文" : "Switch to Chinese");
    const i = zh ? 0 : 1;
    for (const {mark, city, name, reason, source} of this.entries ?? []) {
      const flower = cityFlowers[mark.id];
      city.textContent = placeText(mark.name);
      name.textContent = flower.name[i];
      reason.textContent = flower.reason[i];
      source.textContent = flower.source[i] + " ↗";
      source.setAttribute("aria-label", (zh ? "选花依据，" : "Selection source, ") + flower.source[i]);
    }
  }
}

import {visibility} from "./model.js";
import {area, btn, field, form, h, input, options, para, relabelForm, row, say, select, submit, tx} from "./ui.js";

// Only a visitor's own flower needs publishing controls. Archival flowers are read-only.
export class GardenJournal {
  constructor(store) {
    this.store = store;
    this.root = document.getElementById("garden-note-tools");
    this.composer = document.getElementById("garden-sharing");
  }
  settings(site, initial=null) {
    const choices = options(visibility).filter(([id]) => id !== "partners" || initial?.exchange);
    const audience = select(choices,initial?.visibility || this.store.state.defaults[this.store.actor] || "public");
    return {element:field(say("谁可以看到","Who can see this?"),audience),
      read:() => ({exchange:initial?.exchange || "",visibility:audience.value,sites:initial?.sites || [site]})};
  }
  write(site, initial=null) {
    this.fields = this.settings(site,initial);
    this.composer.replaceChildren(this.fields.element);
    this.composer.hidden = false;
  }
  reset() {
    this.record = this.fields = null;
    this.editing = "";
    this.message = "";
    this.root.replaceChildren();
    this.root.hidden = this.composer.hidden = true;
  }
  updateLanguage() {
    this.message = "";
    relabelForm(this.root,() => this.render());
  }
  read(site,record,close) {
    this.site = site;
    this.record = record;
    this.onRemove = close;
    this.render();
  }
  async act(action,p,feedback,after) {
    if (this.pending) return;
    const record = this.record;
    this.pending = true;
    try {
      await this.store.change(action,p);
      if (this.record !== record) return;
      this.editing = "";
      this.message = feedback;
      if (after) after();
      else this.render();
    } catch {
      const status = this.root.querySelector("[role=status]");
      if (status) status.textContent = say("未能保存，请检查后再试。","Could not save. Check the entry and try again.");
    } finally { this.pending = false; }
  }
  edit(kind) {
    this.editing = kind;
    this.render(true);
    (this.root.querySelector("textarea, button") ?? this.root.querySelector("summary"))?.focus();
  }
  render(expand=false) {
    if (!this.record) return;
    const state = this.store.state, who = this.store.actor;
    const note = state.notes.find(n => n.id === this.record.id);
    if (!note) { this.reset(); return; }
    const mine = note.owner === who;
    const details = h("details",{class:"ex-details",open:expand || Boolean(this.editing) || this.root.querySelector("details")?.open},
      h("summary",{},mine ? say("管理我的留言","Manage my memory") : say("举报这条留言","Report this memory")));
    let content;
    if (!mine) {
      const reported = state.reports.some(r => r.record === note.id && r.by === who && r.site === this.site);
      const reason = area("",220,true);
      content = reported ? para(say("举报已在本机记录。","Report recorded on this device.")) :
        form(() => this.act("report",{site:this.site,record:note.id,reason:reason.value},say("已记录举报。","Report recorded.")),
          field(say("举报原因","Reason for reporting"),reason),submit(say("记录举报","Record report")));
    } else if (this.editing === "note") {
      const text = area(note.text,2000,!note.media), fields = this.settings(this.site,note), remove = input("checkbox");
      content = form(() => this.act("note",{id:note.id,text:text.value,...fields.read(),...(remove.checked ? {media:null} : {})},
        say("留言已更新。","Memory updated."),() => this.onUpdate?.(note.id)),
        field(say("编辑记忆","Edit memory"),text),fields.element,note.media && h("label",{},remove,say("移除附件","Remove attachment")),
        row(submit(say("保存修改","Save changes")),btn(say("取消","Cancel"),() => this.edit(""),"ex-link")));
    } else if (this.editing === "delete") {
      content = row(btn(say("确认删除这朵花","Delete this flower"),() => this.act("removeNote",{id:note.id},"",this.onRemove),"ex-secondary"),
        btn(say("取消","Cancel"),() => this.edit(""),"ex-link"));
    } else {
      content = row(para(tx(visibility[note.visibility])),btn(say("编辑记忆","Edit memory"),() => this.edit("note"),"ex-link"),
        btn(say("删除记忆","Delete memory"),() => this.edit("delete"),"ex-link"));
    }
    details.append(content);
    this.root.hidden = false;
    this.root.replaceChildren(details,h("p",{role:"status",class:"ex-feedback"},this.message));
  }
}

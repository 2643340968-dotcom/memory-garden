import {visibility} from "./model.js";
import {area, btn, field, form, group, h, input, options, para, person, relabelForm, row, say, select, siteName, submit, tx} from "./ui.js";

// Keep discussion anchored to a particular flower, even when a field note belongs to several gardens.
export class GardenJournal {
  constructor(store) {
    this.store = store;
    this.root = document.getElementById("garden-thread");
    this.composer = document.getElementById("garden-sharing");
  }
  settings(site, initial=null) {
    const choices = options(visibility).filter(([id]) => id !== "partners" || initial?.exchange);
    const audience = select(choices,initial?.visibility || this.store.state.defaults[this.store.actor] || "public");
    return {element:field(say("谁可以看到","Who can see this?"),audience),
      read:() => ({exchange:initial?.exchange || "",visibility:audience.value,sites:initial?.sites || [site]})};
  }
  write(site, initial=null) {
    this.root.hidden = true;
    this.fields = this.settings(site,initial);
    this.composer.replaceChildren(this.fields.element);
    this.composer.hidden = false;
  }
  reset() {
    this.record = this.formState = this.fields = null;
    this.message = "";
    this.root.replaceChildren();
    this.root.hidden = true;
    this.composer.hidden = true;
  }
  updateLanguage() {
    this.message = "";
    relabelForm(this.root,() => this.render());
  }
  read(site,record,close) {
    this.site = site;
    this.record = record;
    this.onRemove = close;
    this.formState = null;
    this.message = "";
    this.render();
  }
  async act(action,p,feedback,after) {
    if (this.pending) return;
    const record = this.record;
    this.pending = true;
    try {
      await this.store.change(action,p);
      if (!this.record || this.record.id !== record.id) return;
      this.formState = null;
      this.message = feedback;
      if (after) after();
      else this.render();
    } catch {
      const status = this.root.querySelector("[role=status]");
      if (status) status.textContent = say("未能保存，请检查后再试。","Could not save. Check the entry and try again.");
    } finally { this.pending = false; }
  }
  edit(kind,id="") {
    this.formState = {kind,id};
    this.render();
    this.root.querySelector(".ex-inline-edit textarea")?.focus();
  }
  editor(content) {
    return h("div",{class:"ex-inline-edit"},content,btn(say("取消","Cancel"),() => {this.formState=null; this.render();},"ex-link"));
  }
  render() {
    if (!this.record) return;
    const record = this.record.id, site = this.site, s = this.store.state, who = this.store.actor;
    const note = s.notes.find(n => n.id === record), editing = this.formState;
    const shared = {site,record}, entries = s.comments.filter(c => c.site === site && c.record === record);
    const actions = [];
    this.composer.hidden = true;
    this.root.hidden = false;
    if (note) {
      actions.push(para(person(note.owner) + " · " + tx(visibility[note.visibility]) + (note.exchange ? " · " + note.sites.map(siteName).join(" / ") : "")));
      if (note.owner === who) {
        if (editing?.kind === "note") {
          const text = area(note.text,2000,!note.media), fields = this.settings(site,note);
          const remove = input("checkbox");
          actions.push(this.editor(form(() => this.act("note",{id:note.id,text:text.value,...fields.read(),...(remove.checked ? {media:null} : {})},
            say("记忆已更新。","Memory updated."),() => this.onUpdate?.(note.id)),
            field(say("编辑记忆","Edit memory"),text),fields.element,note.media && h("label",{},remove,say("移除附件","Remove attachment")),
            submit(say("保存修改","Save changes")))));
        } else if (editing?.kind === "delete") {
          actions.push(this.editor(row(btn(say("确认删除记忆和评论","Delete memory and its comments"),() =>
            this.act("removeNote",{id:record},"",this.onRemove),"ex-secondary"))));
        } else actions.push(row(btn(say("编辑记忆","Edit memory"),() => this.edit("note"),"ex-link"),
          btn(say("删除记忆","Delete memory"),() => this.edit("delete"),"ex-link")));
      }
    }
    const reported = id => s.reports.some(r => r.by === who && r.site === site && r.record === record && r.comment === id);
    const report = id => reported(id) ? para(say("已在本机记录举报","Report recorded locally")) :
      btn(say("举报","Report"),() => this.edit("report",id),"ex-link");
    if (note?.owner !== who) actions.push(report(""));
    const reportForm = () => {
      const reason = area("",220,true);
      return this.editor(form(() => this.act("report",{...shared,comment:editing.id,reason:reason.value},
        say("举报已在本机记录。","Report recorded on this device.")),
        field(say("举报原因","Reason for reporting"),reason),submit(say("记录举报","Record report"))));
    };
    if (editing?.kind === "report" && !editing.id) actions.push(reportForm());
    const commentForm = (title,id="",parent="",old="") => {
      const body = area(old,600,true);
      return form(() => this.act("comment",{...shared,id,parent,text:body.value},say("评论已保存。","Comment saved.")),field(title,body),
        submit(id ? say("保存修改","Save changes") : parent ? say("发表回复","Post reply") : say("发表评论","Post comment")));
    };
    // Materialise a flat, ordered tree so deeply nested replies do not overflow narrow screens.
    const byParent = new Map();
    for (const c of entries) {
      if (!byParent.has(c.parent)) byParent.set(c.parent,[]);
      byParent.get(c.parent).push(c);
    }
    const thread = [], stack = [...(byParent.get("") ?? [])].reverse().map(c => [c,0]);
    while (stack.length) {
      const [c,depth] = stack.pop();
      const parent = depth ? entries.find(item => item.id === c.parent) : null;
      thread.push(h("article",{class:"ex-comment" + (depth ? " ex-reply" : "")},
        h("strong",{},person(c.owner)),parent && h("small",{},say(" 回复 "," to ") + person(parent.owner)),
        h("p",{dir:"auto"},c.removed ? say("这条评论已由作者删除。","The author removed this comment.") : c.text),
        !c.removed && row(btn(say("回复","Reply"),() => this.edit("reply",c.id),"ex-link"),
          c.owner === who ? btn(say("编辑","Edit"),() => this.edit("comment",c.id),"ex-link") : report(c.id),
          c.owner === who && btn(say("删除","Delete"),() => this.edit("removeComment",c.id),"ex-link")),
        editing?.id === c.id && (editing.kind === "reply" ? this.editor(commentForm(say("回复","Reply"),"",c.id)) :
          editing.kind === "comment" ? this.editor(commentForm(say("编辑评论","Edit comment"),c.id,"",c.text)) :
          editing.kind === "removeComment" ? this.editor(row(btn(say("确认删除","Confirm removal"),() =>
            this.act("removeComment",{id:c.id},say("评论已删除。","Comment removed.")),"ex-secondary"))) :
          editing.kind === "report" ? reportForm() : null)));
      for (const child of [...(byParent.get(c.id) ?? [])].reverse()) stack.push([child,depth+1]);
    }
    this.root.replaceChildren(...actions,group(say("这朵花的评论","Conversation at this flower"),
      thread.length ? thread : para(say("还没有人留言。","No comments yet.")),
      commentForm(say("以" + person(who) + "的身份留言","Comment as " + person(who)))),
      h("p",{role:"status",class:"ex-feedback"},this.message));
  }
}

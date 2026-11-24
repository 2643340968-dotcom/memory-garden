import {plateURL} from "../flowerForms.js";
import {canReadRecord, canReflect, editableRoute, findApp, methods, profiles, roles, states, visibility} from "./model.js";
import {area, btn, cityName, cityOptions, field, form, group, h, hint, input, offerMeta, offerTitle,
  options, para, person, relabelForm, row, safeDate, say, select, siteName, siteOptions, submit, tx} from "./ui.js";

export class ExchangePanel {
  constructor(dialog, store, {visit, toggle, language}) {
    this.dialog = dialog;
    this.store = store;
    this.visit = visit;
    this.toggle = toggle;
    this.language = language;
    this.history = [];
    this.message = "";
    this.body = dialog.querySelector(".ex-body");
    this.status = dialog.querySelector("[role=status]");
    dialog.querySelector(".ex-close").onclick = () => dialog.close();
    dialog.addEventListener("close",() => {
      this.toggle(false);
      this.history = [];
      this.state = null;
    });
    this.store.addEventListener("change",() => {
      this.labels();
      if (this.dialog.open && !this.busy && !this.dialog.querySelector("form:focus-within")) this.render();
    });
  }
  labels() {
    const unread = this.store.state.notices.filter(n => n.to === this.store.actor && !n.read).length;
    const label = say("我的互访","My exchanges");
    for (const id of ["exchange-my","exchange-guide"]) {
      const button = document.getElementById(id);
      button.textContent = label + (unread ? " · " + unread : "");
      button.setAttribute("aria-label",label + (unread ? say("，未读通知 ",". Unread notices: ") + unread : ""));
    }
  }
  open(view) {
    this.state = view;
    this.history = [];
    this.message = "";
    if (!this.dialog.open) {
      this.toggle(true);
      this.dialog.showModal();
    }
    this.render(true);
  }
  go(view) {
    this.history.push({...this.state});
    this.state = view;
    this.message = "";
    this.render(true);
  }
  back() {
    if (!this.history.length) {this.dialog.close(); return;}
    this.state = this.history.pop();
    this.message = "";
    this.render(true);
  }
  updateLanguage() {
    if (!this.dialog.open) return;
    this.message = "";
    relabelForm(this.body,() => this.render());
    this.dialog.querySelector(".ex-tools > :last-child").focus({preventScroll:true});
  }
  jump(site, record = "", write = false) {
    this.dialog.close();
    this.visit(site,record,write);
  }
  async act(action,p,target,feedback) {
    if (this.busy) return;
    this.busy = true;
    const origin = this.state;
    this.dialog.setAttribute("aria-busy","true");
    try {
      const id = await this.store.change(action,p);
      if (!this.dialog.open || origin !== this.state) return;
      if (target) {
        const view = typeof target === "function" ? target(id) : target;
        if (view.view !== origin.view || view.app !== origin.app) this.history.push(origin);
        this.state = view;
      }
      this.message = feedback || say("已保存","Saved");
      this.render(true);
    } catch {
      this.status.textContent = say("这一步未保存。请检查内容和当前状态后再试。","This change was not saved. Check the fields and current status, then try again.");
    } finally { this.busy = false; this.dialog.removeAttribute("aria-busy"); }
  }
  render(focus = false) {
    if (!this.dialog.open || !this.state) return;
    const v = this.state, who = this.store.actor;
    const app = findApp(this.store.state,v.app,who);
    const city = v.city || app?.city;
    const title = v.view === "hub" ? say("双城记忆互访","City memory exchange") :
      v.view === "publish" ? say("发布互访意向","Publish an intention") :
      v.view === "app" && app ? (["draft","pending","declined","cancelled"].includes(app.status) ?
        say("互访申请","Exchange application") : say("共同行程","Shared itinerary")) :
      v.view === "add" ? say("加入共同行程","Add to an itinerary") : say("我的互访","My exchanges");
    const header = this.dialog.querySelector(".ex-heading");
    const heading = h("h2",{id:"exchange-title",tabindex:"-1"},title);
    header.replaceChildren(h("div",{class:"ex-heading-copy"},hint("p",city ? cityName(city) : say("记忆之场","Site of Memory")),heading),
      h("img",{src:plateURL(city || "nanjing"),alt:"",width:70,height:70}));
    this.dialog.querySelector(".ex-close").setAttribute("aria-label",say("关闭","Close"));
    const actorSelect = select(options(profiles),who,{"aria-label":say("切换体验身份","Switch demo identity"),onchange:e => {
      const account = e.target.value;
      this.history = [];
      this.state = v.view === "hub" ? {view:"hub",city,role:v.role} : {view:"mine",tab:"visits"};
      this.message = say("已切换体验身份","Demo identity switched");
      this.store.choose(account);
      this.render(true);
    }});
    this.dialog.querySelector(".ex-tools").replaceChildren(
      ...(this.history.length ? [btn(say("上一步","Back"),() => this.back(),"ex-link")] : []),
      h("label",{class:"ex-actor"},say("体验身份","Demo identity"),actorSelect),
      btn(say("英文","Chinese"),() => this.language(),"ex-link"));
    this.dialog.querySelector(".ex-storage").textContent = this.store.db ?
      say("本机原型 · 身份与记录保存在此浏览器","Local prototype · Identities and records stay in this browser") :
      say("临时体验 · 此浏览器当前仅在本次访问保留记录","Temporary session · Records last for this visit");
    this.status.textContent = this.message;
    const contents = v.view === "hub" ? this.hub(v) : v.view === "publish" ? this.publish(v) :
      v.view === "app" && app ? this.application(app) : v.view === "add" ? this.addFromMap(v) : this.mine(v);
    this.body.replaceChildren(...contents);
    if (focus) { this.dialog.scrollTop = 0; heading.focus({preventScroll:true}); }
  }
  hub(v) {
    const city = v.city, who = this.store.actor, role = v.role ?? "visitor";
    const choose = select(cityOptions(),city,{"aria-label":say("目标城市","Destination"),onchange:e => {
      this.state = {...v,city:e.target.value}; this.render();
    }});
    const roleButtons = row(...Object.keys(roles).map(key => btn(tx(roles[key]),() => {
      this.state = {...v,role:key}; this.render();
    },"ex-tab",{"aria-pressed":key === role})));
    const offers = this.store.state.offers.filter(o => o.open && o.city === city && o.owner !== who && o.role !== role);
    return [row(choose,btn(say("我的互访","My exchanges"),() => this.go({view:"mine"}),"ex-link")),
      para(say("选一个身份，与另一座城市的同学，从一处地点开始交换观察。",
        "Choose a role and explore a place with a student from another city.")),
      group(say("我想以什么身份参与","How would you like to join?"),roleButtons),
      group(say("可回应的意向","Open intentions"),
        offers.length ? offers.map(o => this.offerCard(o)) : para(say("这里暂时没有互补的意向，可以先发布自己的。","There is no complementary intention here yet. You can publish your own.")),
        row(btn(say("发布我的意向","Publish my intention"),() => this.go({view:"publish",city,role}),"ex-secondary")))];
  }
  offerCard(o) {
    return h("article",{class:"ex-item"},hint("p",offerMeta(o)),h("h4",{dir:"auto"},offerTitle(o)),
      para(cityName(o.origin) + " ↔ " + cityName(o.city) + " · " + tx(methods[o.method]) + (o.date ? " · " + o.date : "")),
      btn(say("申请互访","Apply for exchange"),() => this.act("draft",{offer:o.id},id => ({view:"app",app:id})),"ex-primary"));
  }
  publish(v) {
    const {city,role} = v;
    const origin = select(cityOptions().filter(([id]) => id !== city));
    const title = area("",160,true), mode = select(options(methods),"offline"), when = input("date");
    return [hint("p",tx(roles[role]) + " · " + cityName(city)),form(() => this.act("publish",
      {city,role,origin:origin.value,theme:title.value,method:mode.value,date:when.value},{view:"mine",tab:"visits"},
      say("意向已发布，切换另一位体验身份即可回应。","Intention published. Switch identities to respond.")),
      field(role === "visitor" ? say("我的出发城市","My departure city") : say("想交流的另一座城市","Partner city"),origin),
      field(say("想一起探索什么？","What would you like to explore?"),title),
      h("div",{class:"ex-pair"},field(say("方式","Format"),mode),field(say("期望日期（选填）","Preferred date (optional)"),when)),
      row(submit(say("发布意向","Publish intention"))))];
  }
  openApp(id) {
    this.go({view:"app",app:id});
    if (this.store.state.notices.some(n => n.app === id && n.to === this.store.actor && !n.read))
      void this.store.change("read",{app:id}).catch(() => {});
  }
  application(a) {
    const who = this.store.actor, mine = a.sender === who;
    const offer = this.store.state.offers.find(o => o.id === a.offer);
    const status = h("div",{class:"ex-app-summary"},hint("p",tx(states[a.status])),
      h("h3",{dir:"auto"},offerTitle(offer)),para(person(a.sender) + " ↔ " + person(a.recipient) + " · " + tx(methods[a.method]) + " · " + safeDate(a.date)));
    if (a.status === "draft") {
      const msg = area(a.message,500), when = input("date",a.date), mode = select(options(methods),a.method);
      const values = () => ({app:a.id,message:msg.value,date:when.value,method:mode.value});
      return [status,form(() => {
        if (!msg.value.trim()) {msg.required = true; msg.reportValidity(); return;}
        void this.act("send",values(),null,say("申请已发出。切换到" + person(a.recipient) + "可查看并回应。",
          "Application sent. Switch to " + person(a.recipient) + " to respond."));
      },field(say("写给对方的话","Message to your partner"),msg),
        h("div",{class:"ex-pair"},field(say("期望日期","Preferred date"),when),field(say("交流方式","Format"),mode)),
        row(submit(say("发送申请","Send application")),btn(say("保存草稿","Save draft"),() => this.act("saveDraft",values()),"ex-secondary"),
          btn(say("放弃草稿","Discard draft"),() => this.act("discard",{app:a.id},{view:"mine"}),"ex-link")))];
    }
    const content = [status,group(say("申请留言 · 仅双方可见","Application message · Participants only"),h("p",{dir:"auto",class:"ex-prose"},a.message))];
    const change = (label,action,data={},style="ex-secondary") => btn(label,() => this.act(action,{app:a.id,...data}),style);
    if (a.status === "pending") content.push(mine ?
      row(change(say("撤回申请","Withdraw application"),"cancel")) :
      row(change(say("同意互访","Accept exchange"),"respond",{status:"confirmed"},"ex-primary"),change(say("拒绝","Decline"),"respond",{status:"declined"})));
    if (["declined","cancelled"].includes(a.status)) {
      if (mine && offer.open) content.push(row(btn(say("重新申请","Apply again"),() =>
        this.act("draft",{offer:offer.id},id => ({view:"app",app:id})),"ex-primary")));
      return content;
    }
    if (a.status === "pending") return content;
    content.push(this.itinerary(a));
    if (a.status === "rescheduling") {
      const theirs = a.proposal.by !== who;
      content.push(group(say("日期提议","Proposed date"),para(person(a.proposal.by) + " · " + a.proposal.date),
        row(theirs && change(say("同意新日期","Agree to new date"),"settleDate",{accept:true},"ex-primary"),
          change(theirs ? say("保留原日期","Keep original date") : say("撤回改期","Withdraw proposal"),"settleDate",{accept:false}))));
    }
    if (editableRoute(a)) {
      const when = input("date","",{required:true});
      content.push(h("details",{class:"ex-details"},h("summary",{},say("商量新日期","Propose a new date")),
        form(() => this.act("reschedule",{app:a.id,date:when.value}),field(say("新日期","New date"),when),submit(say("提出改期","Propose date")))));
      content.push(row(a.status === "confirmed" ? btn(say("开始行程","Start itinerary"),() => this.act("start",{app:a.id}),"ex-primary",{disabled:!a.stops.length}) :
        change(say("完成行程","Finish itinerary"),"complete",{},"ex-primary")));
    }
    if (["confirmed","active","rescheduling"].includes(a.status))
      content.push(h("details",{class:"ex-details"},h("summary",{},say("取消这次互访","Cancel this exchange")),row(change(say("确认取消互访","Confirm cancellation"),"cancel"))));
    return content;
  }
  itinerary(a) {
    const edit = editableRoute(a), stops = a.stops.map((s,i) => {
      return h("article",{class:"ex-stop"},h("span",{class:"ex-number","aria-hidden":"true"},String(i+1).padStart(2,"0")),
        h("div",{},h("h4",{},siteName(s.site)),s.time && para(s.time),
          ...Object.entries(s.questions ?? {[a.sender]:s.question}).filter(([,q]) => q).map(([author,q]) =>
            h("p",{dir:"auto"},h("strong",{},person(author) + " · "),q)),
          this.sources(s.site,s.event),
          row(btn(say("到花园","Visit garden"),() => this.jump(s.site),"ex-link"),
            canReflect(a) && btn(say("写互访札记","Write field note"),() => this.jump(s.site,"",a.id),"ex-link")),
          edit && h("details",{class:"ex-details"},h("summary",{},say("调整这一站","Edit this stop")),this.stopForm(a,s.site,s),
            row(i > 0 && btn(say("往前移","Move earlier"),() => this.act("moveStop",{app:a.id,site:s.site,delta:-1}),"ex-link"),
              i < a.stops.length - 1 && btn(say("往后移","Move later"),() => this.act("moveStop",{app:a.id,site:s.site,delta:1}),"ex-link"),
              btn(say("移除这一站","Remove stop"),() => this.act("removeStop",{app:a.id,site:s.site}),"ex-link")))));
    });
    const available = siteOptions(a.city).filter(([id]) => !a.stops.some(s => s.site === id));
    return group(say("共同路线","Our route"),stops.length ? stops : para(say("从当地地图选一处地点，或在这里添加第一站。","Choose a place on the city map or add your first stop here.")),
      edit && available.length > 0 && this.stopForm(a,"",null,available));
  }
  sources(site,linked) {
    const list = h("div",{}), details = h("details",{class:"ex-details"},h("summary",{},say("阅读地点资料","Read place sources")),list);
    details.ontoggle = async () => {
      if (!details.open || list.childElementCount) return;
      try {
        const {eventsForPlace} = await import("../gardenEvents.js");
        const records = eventsForPlace(site);
        records.sort((a,b) => Number(b.id === linked) - Number(a.id === linked));
        list.replaceChildren(...records.map(r => btn((r.id === linked ? say("行程选读 · ","Selected reading · ") : "") + tx(r.title),
          () => this.jump(site,r.id),"ex-source")));
      } catch { list.textContent = say("载入失败，可收起后重试。","Could not load. Close and reopen to retry."); }
    };
    return details;
  }
  stopForm(a,id,stop,choices) {
    const place = id ? null : select(choices), time = input("text",stop?.time ?? "",{maxlength:80});
    const question = area(stop?.questions?.[this.store.actor] ?? (a.sender === this.store.actor ? stop?.question : "") ?? "",260);
    const empty = ["",say("暂不选读","No selected reading")], source = select([empty],"",{"data-readings":true});
    const populate = async () => {
      const chosen = id || place.value;
      source.replaceChildren(new Option(empty[1],""));
      try {
        const {eventsForPlace} = await import("../gardenEvents.js");
        if (chosen !== (id || place.value)) return;
        const readings = eventsForPlace(chosen);
        source.append(...readings.map(r => new Option(tx(r.title),r.id)));
        const preferred = source.dataset.restoreReading ?? stop?.event;
        source.value = readings.some(r => r.id === preferred) ? preferred : "";
        delete source.dataset.restoreReading;
      } catch { /* The route can still be planned while the reading list is unavailable. */ }
    };
    if (place) place.addEventListener("change",populate);
    void populate();
    return form(() => this.act("stop",{app:a.id,site:id || place.value,time:time.value,question:question.value,
      event:source.options.length > 1 ? source.value : stop?.event}),
      place && field(say("添加地点","Add a place"),place),
      field(say("停留安排（选填）","Time or duration (optional)"),time),
      field(say("想在这里弄清什么？","What would you like to find out here?"),question),
      field(say("关联的重点记忆（选填）","Featured reading (optional)"),source),
      row(submit(stop ? say("保存这一站","Save stop") : say("添加这一站","Add stop"))));
  }
  addFromMap(v) {
    const apps = this.store.state.applications.filter(a => findApp(this.store.state,a.id,this.store.actor) && editableRoute(a) && a.city === v.city);
    return [h("h3",{},siteName(v.site)),apps.length ? para(say("选择要加入的路线。","Choose a shared itinerary.")) :
      para(say("双方确认互访后，就能把这个地点加入共同路线。","Once both participants confirm an exchange, you can add this place to your route.")),
      ...apps.map(a => {
        const exists = a.stops.some(s => s.site === v.site);
        return btn(person(a.sender) + " ↔ " + person(a.recipient) + " · " + (exists ? say("已在行程中","View stop") : say("加入路线","Add to route")),
          () => exists ? this.openApp(a.id) : this.act("stop",{app:a.id,site:v.site},{view:"app",app:a.id}),"ex-secondary");
      }),row(btn(say("浏览本城互访","Explore city exchanges"),() => this.go({view:"hub",city:v.city}),"ex-link"))];
  }
  mine(v) {
    const s = this.store.state, who = this.store.actor, tab = v.tab ?? "visits";
    const tabs = {visits:["互访与行程","Exchanges"],notes:["我的记忆","Memories"],comments:["我的评论","Comments"],settings:["设置","Settings"]};
    const content = [row(...Object.entries(tabs).map(([id,title]) => btn(tx(title),() => {
      this.state = {view:"mine",tab:id}; this.message=""; this.render();
    },"ex-tab",{"aria-pressed":id === tab})))];
    const empty = () => para(say("这里还没有记录。","No entries yet."));
    if (tab === "visits") {
      const myApps = s.applications.filter(a => findApp(s,a.id,who));
      const inbox = s.notices.filter(n => n.to === who && !n.read);
      if (inbox.length) content.push(group(say("新通知","New notices"),...inbox.map(n => {
        const a = findApp(s,n.app,who);
        const changes = {route:["路线已调整","Route updated"],dateAccepted:["新日期已确认","New date agreed"],dateKept:["沿用原日期","Original date kept"]};
        return btn(cityName(a.city) + " · " + tx(states[n.kind] ?? changes[n.kind]),() => this.openApp(a.id),"ex-source");
      })));
      content.push(group(say("我的申请与行程","Applications and itineraries"),myApps.length ? myApps.map(a =>
        btn(cityName(a.city) + " · " + person(a.sender === who ? a.recipient : a.sender) + " · " + tx(states[a.status]),() => this.openApp(a.id),"ex-entry")) : empty()));
      const own = s.offers.filter(o => !o.sample && o.owner === who);
      if (own.length) content.push(group(say("我的互访意向","My intentions"),...own.map(o => h("article",{class:"ex-item"},
        h("h4",{dir:"auto"},o.theme),para(cityName(o.city)),o.open ?
          btn(say("收起意向","Close intention"),() => this.act("closeOffer",{id:o.id}),"ex-link") : para(say("已收起","Closed"))))));
      const cities = select(cityOptions(),v.city || "nanjing");
      content.push(group(say("寻找一次互访","Find an exchange"),field(say("目标城市","Destination"),cities),
        row(btn(say("浏览双城互访","Browse city exchanges"),() => this.go({view:"hub",city:cities.value}),"ex-primary"))));
    } else if (tab === "notes") {
      const notes = s.notes.filter(n => n.owner === who);
      content.push(group(say("我留下的花束","Flowers I have left"),notes.length ? notes.map(n =>
        btn((n.text || n.media?.name || "") + " · " + n.sites.map(siteName).join(" / ") + " · " + tx(visibility[n.visibility]),
          () => this.jump(n.sites[0],n.id),"ex-entry")) : empty()));
    } else if (tab === "comments") {
      const comments = s.comments.filter(c => c.owner === who && !c.removed && canReadRecord(s,c.site,c.record,who)).reverse();
      content.push(group(say("我的评论与回复","My comments and replies"),comments.length ? comments.map(c =>
        btn(c.text + " · " + siteName(c.site),() => this.jump(c.site,c.record),"ex-entry")) : empty()));
    } else {
      const setting = select(options(visibility).filter(([id]) => id !== "partners"),s.defaults[who] ?? "public");
      content.push(group(say("发布偏好","Publishing preference"),form(() => this.act("defaultVisibility",{visibility:setting.value}),
        field(say("新记忆默认可见范围","Default audience for new memories"),setting),submit(say("保存偏好","Save preference")))));
      const reports = s.reports.filter(r => r.by === who);
      if (reports.length) content.push(group(say("我的举报记录","My reports"),...reports.map(r =>
        para(siteName(r.site) + " · " + r.reason + say(" · 已在本机记录"," · Recorded locally")))));
    }
    return content;
  }
}

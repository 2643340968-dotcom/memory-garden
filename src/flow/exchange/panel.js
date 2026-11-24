import {plateURL} from "../flowerForms.js";
import {canApply, counterpart, findApp, homeCity, methods, ongoing, profiles, states, visibility} from "./model.js";
import {area, btn, cityName, cityOptions, field, form, group, h, hint, input, offerMeta, offerTitle,
  options, para, person, relabelForm, row, safeDate, say, select, siteName, submit, tx} from "./ui.js";

const defaultPartner = home => home === "nanjing" ? "qingdao" : "nanjing";
const pairName = (a,b) => cityName(a) + " ⇄ " + cityName(b);

function cityPair(home,away) {
  const specimen = (city,caption) => h("div",{class:"ex-city-specimen"},
    h("img",{src:plateURL(city),alt:"",width:52,height:52}),h("div",{},hint("small",caption),h("strong",{},cityName(city))));
  return h("div",{class:"ex-city-pair"},specimen(home,say("我所在的城市","My city")),
    h("div",{class:"ex-crossing","aria-hidden":"true"},h("i"),h("i")),specimen(away,say("对方所在的城市","Partner city")));
}

export class ExchangePanel {
  constructor(dialog, store, {visit, explore, toggle, language}) {
    this.dialog = dialog;
    this.store = store;
    this.visit = visit;
    this.explore = explore;
    this.toggle = toggle;
    this.language = language;
    this.history = [];
    this.message = "";
    this.body = dialog.querySelector(".ex-body");
    this.status = dialog.querySelector("[role=status]");
    dialog.querySelector(".ex-close").onclick = () => dialog.close();
    dialog.addEventListener("close",() => {
      if (dialog.open) return;
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
  jump(site, record) {
    this.dialog.close();
    this.visit(site,record);
  }
  openCity(city,place) {
    this.dialog.close();
    this.explore(city,place);
  }
  switchIdentity(account) {
    if (account === this.store.actor) return;
    const v = this.state;
    this.history = [];
    if (v.view === "app" && findApp(this.store.state,v.app,account)) this.state = {view:"app",app:v.app};
    else if (v.view === "hub") this.state = {view:"hub",city:v.city};
    else this.state = {view:"mine",tab:"visits"};
    this.message = say("已切换体验身份","Demo identity switched");
    this.store.choose(account);
    this.render(true);
  }
  async act(action,p,target,feedback,focusSelector) {
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
      const field = focusSelector && this.body.querySelector(focusSelector);
      if (field) {
        field.focus({preventScroll:true});
        field.scrollIntoView({block:"start"});
      }
    } catch {
      this.status.textContent = say("这一步未保存。请检查内容和当前状态后再试。","This change was not saved. Check the fields and current status, then try again.");
    } finally { this.busy = false; this.dialog.removeAttribute("aria-busy"); }
  }
  render(focus = false) {
    if (!this.dialog.open || !this.state) return;
    const v = this.state, who = this.store.actor;
    const app = findApp(this.store.state,v.app,who);
    const home = homeCity(who);
    const city = app?.visits[who].to ?? (v.city && v.city !== home ? v.city : defaultPartner(home));
    const title = v.view === "hub" ? say("双城互访计划","City exchange plans") :
      v.view === "publish" ? say("发起互访邀请","Publish an invitation") :
      v.view === "app" && app ? say("互访申请","Exchange application") : say("我的互访","My exchanges");
    const header = this.dialog.querySelector(".ex-heading");
    const heading = h("h2",{id:"exchange-title",tabindex:"-1"},title);
    header.replaceChildren(h("div",{class:"ex-heading-copy"},heading));
    this.dialog.querySelector(".ex-close").setAttribute("aria-label",say("关闭","Close"));
    const actorSelect = select(options(profiles),who,{"aria-label":say("切换体验身份","Switch demo identity"),onchange:e => this.switchIdentity(e.target.value)});
    this.dialog.querySelector(".ex-tools").replaceChildren(
      ...(this.history.length ? [btn(say("上一步","Back"),() => this.back(),"ex-link")] : []),
      h("label",{class:"ex-actor"},say("体验身份","Demo identity"),actorSelect),
      btn(say("英文","Chinese"),() => this.language(),"ex-link"));
    this.dialog.querySelector(".ex-storage").textContent = this.store.db ?
      say("本机原型 · 身份与记录保存在此浏览器","Local prototype · Identities and records stay in this browser") :
      say("临时体验 · 此浏览器当前仅在本次访问保留记录","Temporary session · Records last for this visit");
    this.status.textContent = this.message;
    const contents = v.view === "hub" ? this.hub(city) : v.view === "publish" ? this.publish(city) :
      v.view === "app" && app ? this.application(app) : this.mine(v);
    this.body.replaceChildren(...contents);
    if (focus) { this.dialog.scrollTop = 0; heading.focus({preventScroll:true}); }
  }
  hub(city) {
    const who = this.store.actor, home = homeCity(who);
    const choose = select(cityOptions().filter(([id]) => id !== home),city,{onchange:e => {
      this.state = {view:"hub",city:e.target.value}; this.render();
      this.body.querySelector(".ex-destination select")?.focus({preventScroll:true});
    }});
    const offers = this.store.state.offers.filter(o => !o.legacySample && o.home === city && canApply(o,who));
    return [cityPair(home,city),h("p",{class:"ex-reciprocal-copy"},say("你去" + cityName(city) + "，当地同学来" + cityName(home) + "。",
      "You visit " + cityName(city) + ". A student from there visits " + cityName(home) + ".")),
      h("div",{class:"ex-destination"},field(say("我想去的城市","City I would like to visit"),choose),
        btn(say("我的申请","My applications"),() => this.go({view:"mine"}),"ex-link")),
      group(say("来自" + cityName(city) + "的邀请","Invitations from " + cityName(city)),
        offers.length ? offers.map(o => this.offerCard(o)) : para(say("可以发出第一份邀请。","You can send the first invitation.")),
        row(btn(say("发起我的邀请","Publish my invitation"),() => this.go({view:"publish",city}),"ex-secondary")))];
  }
  offerCard(o) {
    return h("article",{class:"ex-item ex-offer"},h("div",{},hint("p",offerMeta(o)),h("h4",{dir:"auto"},offerTitle(o)),
      para(tx(methods[o.method]) + (o.date ? " · " + o.date : ""))),
      btn(say("申请互访","Apply for exchange"),() => this.act("draft",{offer:o.id},id => ({view:"app",app:id})),"ex-primary"));
  }
  publish(city) {
    const who = this.store.actor, home = homeCity(who);
    const title = area("",160,true), mode = select(options(methods),"offline"), when = input("date");
    return [cityPair(home,city),form(() => this.act("publish",
      {away:city,theme:title.value,method:mode.value,date:when.value},{view:"mine",tab:"visits"},
      say("邀请已发布，" + cityName(city) + "的同学可以申请。","Invitation published for students in " + cityName(city) + ".")),
      field(say("你想交换怎样的城市记忆？","Which city memories would you like to exchange?"),title),
      h("div",{class:"ex-pair"},field(say("互访方式","Format"),mode),field(say("我的到访日期（选填）","My visit date (optional)"),when)),
      row(submit(say("发布邀请","Publish invitation"))))];
  }
  openApp(id) {
    this.go({view:"app",app:id});
    if (this.store.state.notices.some(n => n.app === id && n.to === this.store.actor && !n.read))
      void this.store.change("read",{app:id}).catch(() => {});
  }
  application(a) {
    const who = this.store.actor, peer = counterpart(a,who), mine = a.visits[who], other = a.visits[peer];
    const offer = this.store.state.offers.find(o => o.id === a.offer);
    const content = [cityPair(mine.from,mine.to),h("div",{class:"ex-application-heading"},
      h("h3",{dir:"auto"},offerTitle(offer)),hint("span",tx(states[a.status])))];
    const change = (text,action,data={},style="ex-secondary") =>
      btn(text,() => this.act(action,{app:a.id,...data}),style);
    if (a.status === "draft") {
      const msg = area(a.message,500), when = input("date",mine.date), mode = select(options(methods),a.method);
      const values = () => ({app:a.id,message:msg.value,date:when.value,method:mode.value});
      content.push(para(say("你去" + cityName(mine.to) + "，" + person(peer) + "来" + cityName(mine.from) + "。",
        "You visit " + cityName(mine.to) + ". " + person(peer) + " visits " + cityName(mine.from) + ".")),
        form(() => this.act("send",values(),null,say("已发给" + person(peer) + "。","Sent to " + person(peer) + ".")),
          field(say("给对方的简短介绍（选填）","Introduce yourself (optional)"),msg),
          h("div",{class:"ex-pair"},field(say("我的到访日期（选填）","My visit date (optional)"),when),field(say("互访方式","Format"),mode)),
          row(submit(say("发送申请","Send application")),btn(say("保存草稿","Save draft"),() => this.act("saveDraft",values()),"ex-secondary"),
            btn(say("放弃草稿","Discard draft"),() => this.act("discard",{app:a.id},{view:"mine"}),"ex-link"))));
      return content;
    }
    if (a.message) content.push(h("details",{class:"ex-details"},h("summary",{},say("申请时的介绍","Application message")),h("p",{class:"ex-prose",dir:"auto"},a.message)));
    if (a.previouslyClosed && ongoing(a)) content.push(para(say("旧版记录了整体完成状态。两位参与者可在此分别确认自己的到访。",
      "The earlier plan recorded one overall completion. Each participant can now confirm their own visit.")));
    const legs = h("section",{class:"ex-legs","aria-label":say("双方各自的访问","The two individual visits")},
      this.visitRow(a,who,true),this.visitRow(a,peer,false));
    content.push(legs);
    if (a.status === "pending") {
      if (who === a.recipient) {
        const when = input("date",mine.date);
        content.push(form(() => this.act("respond",{app:a.id,status:"confirmed",date:when.value}),
          field(say("我的到访日期（选填）","My visit date (optional)"),when),
          row(submit(say("同意互访","Accept exchange")),change(say("拒绝","Decline"),"respond",{status:"declined"}))));
      } else content.push(row(change(say("撤回申请","Withdraw application"),"cancel"),
        btn(say("切换到" + person(peer) + "回应","Respond as " + person(peer)),() => this.switchIdentity(peer),"ex-link")));
      return content;
    }
    if (mine.visited) content.push(this.review(a,who,true));
    if (other.review) content.push(this.review(a,peer,false));
    if (ongoing(a) && !mine.visited) content.push(row(this.gardenLink(mine.to)));
    if (ongoing(a)) content.push(h("details",{class:"ex-details"},h("summary",{},say("取消这次互访","Cancel this exchange")),
      row(change(say("确认取消互访","Confirm cancellation"),"cancel"))));
    if (["declined","cancelled"].includes(a.status) && who === a.sender && canApply(offer,who))
      content.push(row(btn(say("重新申请","Apply again"),() => this.act("draft",{offer:offer.id},id => ({view:"app",app:id})),"ex-secondary")));
    return content;
  }
  visitRow(app,visitor,isMine) {
    const visit = app.visits[visitor], available = ongoing(app) && !visit.visited;
    const controls = [];
    if (isMine && available) controls.push(btn(say("我已完成到访","I have completed my visit"),
      () => this.act("visited",{app:app.id},null,say("已记录你的到访。","Your visit is recorded."),".ex-my-review h3"),"ex-primary"));
    if (available && visit.proposedDate) {
      const proposedByMe = (visit.proposedBy ?? visitor) === this.store.actor;
      const settle = (label,accept) => btn(label,() => this.act("settleDate",{app:app.id,visitor,accept}),"ex-link");
      controls.push(h("div",{},para(say("提议日期","Proposed date") + " · " + visit.proposedDate),
        row(!proposedByMe && settle(say("同意这个日期","Agree to date"),true),
          settle(proposedByMe ? say("撤回改期","Withdraw new date") : say("保留原日期","Keep original date"),false))));
    } else if (available && isMine) {
      const newDate = input("date","",{required:true});
      controls.push(h("details",{class:"ex-details"},h("summary",{},say("商量我的到访日期","Discuss my visit date")),
        form(() => this.act("reschedule",{app:app.id,date:newDate.value}),field(say("新日期","New date"),newDate),submit(say("发给对方确认","Send date for approval")))));
    }
    if (visit.savedPlaces?.length) controls.push(h("details",{class:"ex-details"},h("summary",{},say("先前保存的地点","Previously saved places")),
      ...visit.savedPlaces.map(stop => h("div",{},btn(siteName(stop.site),() => this.openCity(visit.to,stop.site),"ex-source"),
        stop.time && para(stop.time),...Object.values(stop.questions ?? {old:stop.question}).filter(Boolean).map(para)))));
    const state = visit.visited ? say("已到访","Visited") : app.status === "cancelled" || app.status === "declined" ? "" :
      ongoing(app) ? say("待到访","Upcoming") : "";
    return h("article",{class:"ex-leg","data-visitor":visitor,"data-from":visit.from,"data-to":visit.to},
      h("div",{class:"ex-leg-line"},hint("span",isMine ? say("我的访问","My visit") : say("对方的访问","Partner’s visit")),state && h("small",{},state)),
      h("h4",{},say(person(visitor) + "去" + cityName(visit.to),person(visitor) + " visits " + cityName(visit.to))),
      para(cityName(visit.from) + " → " + cityName(visit.to) + " · " + safeDate(visit.date)),...controls);
  }
  gardenLink(to) {
    return btn(say("去" + cityName(to) + "地图逛花园","Explore gardens on the " + cityName(to) + " map"),
      () => this.openCity(to),"ex-link");
  }
  review(app,author,isMine) {
    const previous = app.visits[author].review;
    const title = isMine ? say("我的互访评价","My exchange review") :
      say(person(author) + "的评价","Review by " + person(author));
    let editor;
    if (isMine) {
      const score = select([["0",say("不评分","No rating")],...[1,2,3,4,5].map(n => [String(n),say(n + " 星",n + (n === 1 ? " star" : " stars"))])],String(previous?.rating ?? 0));
      const words = area(previous?.text ?? "",400);
      const send = () => {
        if (!Number(score.value) && !words.value.trim()) {
          words.setCustomValidity(say("可以写一句评价，或选一个评分。","Write a review or choose a rating."));
          words.reportValidity();
          return;
        }
        void this.act("review",{app:app.id,rating:Number(score.value),text:words.value},null,
          say("评价已保存在这份申请里。","Your review was saved on this application."),".ex-my-review h3");
      };
      words.oninput = score.onchange = () => words.setCustomValidity("");
      editor = form(send,field(say("这次互访怎么样？","How was your visit?"),words),
        row(field(say("评分（选填）","Rating (optional)"),score),submit(previous ? say("保存修改","Save changes") : say("提交评价","Submit review"))));
    }
    const groupEl = previous ? group(title,previous.rating > 0 && h("span",{class:"ex-rating","aria-label":say(previous.rating+" 星",previous.rating+" out of 5 stars")},"★".repeat(previous.rating) + "☆".repeat(5-previous.rating)),
      previous.text && h("p",{class:"ex-prose",dir:"auto"},previous.text),
      isMine && h("details",{class:"ex-details"},h("summary",{},say("修改评价","Edit review")),editor)) : group(title,editor);
    if (isMine) {
      groupEl.classList.add("ex-my-review");
      const heading = groupEl.querySelector("h3");
      heading.tabIndex = -1;
      heading.after(row(this.gardenLink(app.visits[author].to)));
    }
    return groupEl;
  }
  mine(v) {
    const s = this.store.state, who = this.store.actor, tab = v.tab ?? "visits";
    const tabs = {visits:["我的申请","Applications"],notes:["我的记忆","Memories"],settings:["设置","Settings"]};
    const content = [row(...Object.entries(tabs).map(([id,title]) => btn(tx(title),() => {
      this.state = {view:"mine",tab:id}; this.message=""; this.render();
    },"ex-tab",{"aria-pressed":id === tab})))];
    const empty = () => para(say("这里还没有记录。","No entries yet."));
    if (tab === "visits") {
      const myApps = s.applications.filter(a => findApp(s,a.id,who));
      const inbox = s.notices.filter(n => n.to === who && !n.read);
      if (inbox.length) content.push(group(say("新通知","New notices"),...inbox.map(n => {
        const a = findApp(s,n.app,who);
        if (!a) return null;
        const changes = {visited:["对方已到访","Partner visit complete"],review:["收到互访评价","New exchange review"],
          planUpdated:["申请已更新","Application updated"],dateAccepted:["新日期已确认","New date agreed"],dateKept:["沿用原日期","Original date kept"]};
        return btn(pairName(a.visits[who].from,a.visits[who].to) + " · " + tx(states[n.kind] ?? changes[n.kind]),() => this.openApp(a.id),"ex-source");
      })));
      content.push(group(say("互访申请","Exchange applications"),myApps.length ? myApps.map(a =>
        btn(pairName(a.visits[who].from,a.visits[who].to) + " · " + person(counterpart(a,who)) + " · " + tx(states[a.status]),() => this.openApp(a.id),"ex-entry")) : empty()));
      const own = s.offers.filter(o => !o.sample && o.owner === who);
      if (own.length) content.push(group(say("我发出的邀请","Invitations I published"),...own.map(o => h("article",{class:"ex-item"},
        h("h4",{dir:"auto"},o.theme),para(pairName(o.home,o.away)),o.open ?
          btn(say("收起邀请","Close invitation"),() => this.act("closeOffer",{id:o.id}),"ex-link") : para(say("已收起","Closed"))))));
      content.push(row(btn(say("发现双城互访","Discover city exchanges"),() => this.go({view:"hub",city:v.city}),"ex-primary")));
    } else if (tab === "notes") {
      const notes = s.notes.filter(n => n.owner === who);
      content.push(group(say("我留下的花","Flowers I have left"),notes.length ? notes.map(n =>
        btn((n.text || n.media?.name || "") + " · " + n.sites.map(siteName).join(" / ") + " · " + tx(visibility[n.visibility]),
          () => this.jump(n.sites[0],n.id),"ex-entry")) : empty()));
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

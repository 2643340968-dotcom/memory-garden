import {CITIES, PLACES} from "../places.js";

const residents = {nanjing:"an", qingdao:"zhou", chengdu:"lin"};
const names = {an:["小安","An"], lin:["林禾","Lin He"], zhou:["周宁","Zhou Ning"]};
const residentsByCity = Object.fromEntries(Object.keys(CITIES).map(city => [city,residents[city] ?? "student-" + city]));
const homeCities = Object.fromEntries(Object.entries(residentsByCity).map(([city,id]) => [id,city]));
export const homeCity = who => homeCities[who];
export const profiles = {visitor:["访客","Visitor"]};
for (const [id,city] of Object.entries(homeCities)) {
  profiles[id] = names[id] ?? [CITIES[city].name[0] + "同学", "Student in " + CITIES[city].name[1]];
}
export const states = {
  draft:["草稿","Draft"], pending:["待回应","Awaiting reply"], confirmed:["已确认","Confirmed"],
  rescheduling:["商量日期中","Changing dates"], declined:["已拒绝","Declined"],
  active:["互访中","Underway"], completed:["双方已到访","Both visits complete"], cancelled:["已取消","Cancelled"]
};
export const visibility = {public:["公开","Public"], partners:["仅互访双方","Exchange partners"], private:["仅自己","Only me"]};
export const methods = {offline:["实地互访","In person"], online:["线上互访","Online"]};
export const participant = (a, who) => a && (a.sender === who || a.recipient === who);
export const counterpart = (a, who) => a.sender === who ? a.recipient : a.sender;
export const ongoing = a => a && ["confirmed","rescheduling","active"].includes(a.status);
export function canApply(offer, who, home) {
  return Boolean(offer?.open && Object.hasOwn(profiles,who) && Object.hasOwn(CITIES,home) && offer.owner !== who &&
    offer.home !== home && (!offer.away || offer.away === home));
}
export function makeVisits(sender,recipient,from,to) {
  const leg = (from,to) => ({from,to,date:"",proposedDate:"",visited:false,review:null});
  return {[sender]:leg(from,to), [recipient]:leg(to,from)};
}
function updateProgress(app) {
  const visits = Object.values(app.visits);
  if (visits.every(visit => visit.visited)) app.status = "completed";
  else if (visits.some(visit => visit.proposedDate)) app.status = "rescheduling";
  else app.status = visits.some(visit => visit.visited) ? "active" : "confirmed";
}
const own = (object, key) => Object.hasOwn(object, key);
function requireValue(condition) { if (!condition) throw new Error("invalid-action"); }
function string(value, limit, required = false) {
  requireValue(typeof value === "string" && value.length <= limit && (!required || value.trim()));
  return value;
}
function date(value) {
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0,10) === value);
  return value;
}
function nextId(state, kind) { return kind + "-" + (++state.serial); }
export function newBook() {
  const offers = Object.entries(residentsByCity).map(([home,owner]) => ({
    id:"exchange-with-" + home, owner, home, away:"", sample:true, method:"offline", theme:"", date:"", open:true
  }));
  return {version:3, defaultReader:"visitor", serial:0, offers, applications:[], notes:[], comments:[], reports:[], notices:[], defaults:{}};
}
export function findApp(state, id, who) {
  return state.applications.find(a => a.id === id && participant(a,who) && (a.status !== "draft" || a.sender === who));
}
export function visibleNote(state, n, who) {
  if (!n) return false;
  return n.owner === who || n.visibility === "public" ||
    (n.visibility === "partners" && participant(state.applications.find(a => a.id === n.exchange),who));
}
export const notesAt = (s, site, who) => s.notes.filter(n => n.sites.includes(site) && visibleNote(s,n,who));
export function canReadRecord(s, site, record, who) {
  if (!own(PLACES,site) || typeof record !== "string" || !record || record.length > 180) return false;
  return !record.startsWith("field-note-") || notesAt(s,site,who).some(n => n.id === record);
}
function notify(s, app, actor, kind) {
  s.notices.unshift({id:nextId(s,"notice"), app:app.id, to:app.sender === actor ? app.recipient : app.sender,
    kind, read:false});
}
export function applyChange(s, who, action, p = {}) {
  requireValue(own(profiles,who));
  const app = findApp(s,p.app,who);
  const note = s.notes.find(n => n.id === p.id);
  switch (action) {
    case "publish": {
      const home = p.home;
      requireValue(own(CITIES,home) && own(CITIES,p.away) && p.away !== home && own(methods,p.method));
      const theme = string(p.theme,160,true), when = p.date ? date(p.date) : "";
      const id = nextId(s,"offer");
      s.offers.unshift({id,owner:who,home,away:p.away,method:p.method,theme,date:when,open:true});
      return id;
    }
    case "closeOffer": {
      const offer = s.offers.find(o => o.id === p.id && o.owner === who);
      requireValue(offer?.open);
      offer.open = false;
      return;
    }
    case "draft": {
      const offer = s.offers.find(o => o.id === p.offer);
      requireValue(canApply(offer,who,p.home));
      const current = s.applications.find(a => a.offer === offer.id && a.sender === who &&
        a.visits[who].from === p.home && !["cancelled","declined","completed"].includes(a.status));
      if (current) return current.id;
      const id = nextId(s,"visit");
      const visits = makeVisits(who,offer.owner,p.home,offer.home);
      visits[offer.owner].date = offer.date;
      s.applications.unshift({id,offer:offer.id,sender:who,recipient:offer.owner,
        status:"draft",message:"",method:offer.method,visits});
      return id;
    }
    case "saveDraft":
    case "send": {
      requireValue(app?.status === "draft" && app.sender === who && own(methods,p.method));
      if (action === "send") requireValue(s.offers.find(o => o.id === app.offer)?.open);
      const message = string(p.message,500), when = p.date ? date(p.date) : "";
      app.message = message;
      app.visits[who].date = when;
      app.method = p.method;
      if (action === "send") {
        app.status = "pending";
        notify(s,app,who,"pending");
      }
      return app.id;
    }
    case "discard":
      requireValue(app?.status === "draft" && app.sender === who);
      s.applications = s.applications.filter(a => a !== app);
      return;
    case "respond":
      requireValue(app?.status === "pending" && app.recipient === who && ["confirmed","declined"].includes(p.status));
      if (p.status === "confirmed" && p.date !== undefined) app.visits[who].date = p.date ? date(p.date) : "";
      app.status = p.status;
      break;
    case "cancel":
      requireValue(app && ((app.status === "pending" && who === app.sender) || ongoing(app)));
      app.status = "cancelled";
      for (const visit of Object.values(app.visits)) visit.proposedDate = "";
      break;
    case "reschedule": {
      requireValue(ongoing(app));
      const visit = app.visits[who], when = date(p.date);
      requireValue(!visit.visited && when !== visit.date);
      requireValue(!visit.proposedDate || (visit.proposedBy ?? who) === who);
      visit.proposedDate = when;
      visit.proposedBy = who;
      updateProgress(app);
      notify(s,app,who,"rescheduling");
      return app.id;
    }
    case "settleDate": {
      requireValue(ongoing(app) && participant(app,p.visitor) && typeof p.accept === "boolean");
      const visit = app.visits[p.visitor];
      requireValue(visit.proposedDate && (!p.accept || (visit.proposedBy ?? p.visitor) !== who));
      if (p.accept) visit.date = visit.proposedDate;
      visit.proposedDate = "";
      updateProgress(app);
      notify(s,app,who,p.accept ? "dateAccepted" : "dateKept");
      return app.id;
    }
    case "visited":
      requireValue(ongoing(app) && !app.visits[who].visited);
      app.visits[who].visited = true;
      app.visits[who].proposedDate = "";
      updateProgress(app);
      notify(s,app,who,app.status === "completed" ? "completed" : "visited");
      return app.id;
    case "review": {
      requireValue(app?.visits[who].visited && Number.isInteger(p.rating) && p.rating >= 0 && p.rating <= 5);
      const text = string(p.text,400,!p.rating);
      const first = !app.visits[who].review;
      app.visits[who].review = {rating:p.rating,text};
      if (first) notify(s,app,who,"review");
      return app.id;
    }
    case "note": {
      requireValue(!p.parent && !p.record && (!p.id || note?.owner === who));
      const sites = [...new Set(p.sites ?? [])];
      requireValue(sites.length && sites.every(site => own(PLACES,site)) && own(visibility,p.visibility));
      // Earlier notes may belong to more than one garden. Editing preserves their original audience and places.
      const previousExchange = note?.exchange || "";
      requireValue((p.exchange || "") === previousExchange);
      if (previousExchange) requireValue(sites.length === note.sites.length && sites.every(site => note.sites.includes(site)));
      else requireValue(sites.length === 1 && p.visibility !== "partners");
      const media = p.media === undefined ? note?.media ?? null : p.media;
      if (media) requireValue(["image","audio","video"].includes(media.kind) && typeof media.name === "string");
      const value = {text:string(p.text,2000,!media),sites,exchange:p.exchange || "",visibility:p.visibility,media};
      if (note) Object.assign(note,value);
      else s.notes.unshift({...value,id:nextId(s,"field-note"),owner:who});
      return note?.id ?? s.notes[0].id;
    }
    case "removeNote":
      requireValue(note?.owner === who);
      s.notes = s.notes.filter(n => n !== note);
      s.reports = s.reports.filter(r => r.record !== note.id);
      return;
    case "report": {
      const target = s.notes.find(n => n.id === p.record);
      requireValue(!p.comment && target && target.owner !== who && canReadRecord(s,p.site,p.record,who));
      requireValue(!s.reports.some(r => r.by === who && r.site === p.site && r.record === p.record && !r.comment));
      s.reports.push({by:who,site:p.site,record:p.record,comment:"",reason:string(p.reason,220,true)});
      return;
    }
    case "read":
      for (const n of s.notices) if (n.to === who && n.app === app?.id) n.read = true;
      return;
    case "defaultVisibility":
      requireValue(["public","private"].includes(p.visibility));
      s.defaults[who] = p.visibility;
      return;
    default: throw new Error("unknown-action");
  }
  notify(s,app,who,app.status);
  return app.id;
}

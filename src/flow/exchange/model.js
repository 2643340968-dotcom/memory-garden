import {CITIES, PLACES} from "../places.js";

export const profiles = {
  an: ["小安", "An"], lin: ["林禾", "Lin He"], zhou: ["周宁", "Zhou Ning"]
};
export const states = {
  draft:["草稿","Draft"], pending:["待回应","Awaiting reply"], confirmed:["已确认","Confirmed"],
  rescheduling:["改期中","Rescheduling"], declined:["已拒绝","Declined"],
  active:["进行中","In progress"], completed:["已完成","Completed"], cancelled:["已取消","Cancelled"]
};
export const visibility = {public:["公开","Public"], partners:["仅互访双方","Exchange partners"], private:["仅自己","Only me"]};
export const methods = {online:["线上交流","Online"], offline:["实地走访","In person"]};
export const roles = {visitor:["来访学生","Visiting student"], local:["在地学生","Local student"]};
export const editableRoute = a => a && ["confirmed","active"].includes(a.status);
export const canReflect = a => a && ["confirmed","active","completed"].includes(a.status);
export const participant = (a, who) => a && (a.sender === who || a.recipient === who);
export const belongs = (site, city) => Object.hasOwn(PLACES,site) && PLACES[site].city === city;
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
  const offers = [];
  for (const [index, city] of Object.keys(CITIES).entries()) {
    const other = city === "nanjing" ? "qingdao" : "nanjing";
    for (const role of ["local","visitor"]) {
      const localAuthor = index % 2 ? "lin" : "zhou";
      offers.push({id:"sample-" + city + "-" + role, city, origin:other, role,
        owner:role === "local" ? localAuthor : localAuthor === "lin" ? "zhou" : "lin", sample:true,
        method:role === "local" ? "offline" : "online", theme:"", date:"", open:true});
    }
  }
  return {version:1, serial:0, offers, applications:[], notes:[], comments:[], reports:[], notices:[], defaults:{}};
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
  const comment = s.comments.find(c => c.id === p.id);
  switch (action) {
    case "publish": {
      requireValue(own(CITIES,p.city) && own(CITIES,p.origin) && p.city !== p.origin && own(roles,p.role) && own(methods,p.method));
      const id = nextId(s,"offer");
      s.offers.unshift({id,owner:who,city:p.city,origin:p.origin,role:p.role,method:p.method,theme:string(p.theme,160,true),
        date:p.date ? date(p.date) : "",open:true});
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
      requireValue(offer?.open && offer.owner !== who);
      const current = s.applications.find(a => a.offer === offer.id && a.sender === who &&
        !["cancelled","declined","completed"].includes(a.status));
      if (current) return current.id;
      const id = nextId(s,"visit");
      s.applications.unshift({id,offer:offer.id,city:offer.city,sender:who,recipient:offer.owner,
        status:"draft",message:"",date:offer.date,method:offer.method,stops:[],proposal:null});
      return id;
    }
    case "saveDraft":
    case "send": {
      requireValue(app?.status === "draft" && app.sender === who);
      if (action === "send") requireValue(s.offers.find(o => o.id === app.offer)?.open);
      app.message = string(p.message,500,action === "send");
      app.date = p.date ? date(p.date) : "";
      requireValue(own(methods,p.method));
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
      app.status = p.status;
      break;
    case "cancel":
      requireValue(app && ((app.status === "pending" && who === app.sender) ||
        ["confirmed","rescheduling","active"].includes(app.status)));
      app.status = "cancelled";
      app.proposal = null;
      break;
    case "reschedule":
      requireValue(editableRoute(app));
      requireValue(date(p.date) !== app.date);
      app.proposal = {by:who,date:p.date,from:app.status};
      app.status = "rescheduling";
      break;
    case "settleDate":
      requireValue(app?.status === "rescheduling" && (!p.accept || app.proposal.by !== who));
      if (p.accept) app.date = app.proposal.date;
      app.status = app.proposal.from;
      app.proposal = null;
      break;
    case "start":
      requireValue(app?.status === "confirmed" && app.stops.length);
      app.status = "active";
      break;
    case "complete":
      requireValue(app?.status === "active");
      app.status = "completed";
      break;
    case "stop": {
      requireValue(editableRoute(app) && belongs(p.site,app.city));
      const at = app.stops.findIndex(x => x.site === p.site);
      const previous = app.stops[at];
      const event = string(p.event ?? previous?.event ?? "",200);
      requireValue(!event || event.startsWith(p.site + "-event-"));
      const questions = {...previous?.questions};
      if (previous?.question && !previous.questions) questions[app.sender] = previous.question;
      if (p.question !== undefined) questions[who] = string(p.question,260);
      const fields = {site:p.site,time:string(p.time ?? previous?.time ?? "",80),questions,event};
      if (at === -1) app.stops.push(fields);
      else app.stops[at] = fields;
      notify(s,app,who,"route");
      return app.id;
    }
    case "moveStop":
    case "removeStop": {
      requireValue(editableRoute(app));
      const at = app.stops.findIndex(x => x.site === p.site);
      requireValue(at >= 0);
      if (action === "removeStop") app.stops.splice(at,1);
      else {
        const dest = at + p.delta;
        requireValue([1,-1].includes(p.delta) && dest >= 0 && dest < app.stops.length);
        [app.stops[at],app.stops[dest]] = [app.stops[dest],app.stops[at]];
      }
      notify(s,app,who,"route");
      return app.id;
    }
    case "note": {
      requireValue(!p.id || note?.owner === who);
      const sites = [...new Set(p.sites ?? [])];
      requireValue(sites.length && sites.every(site => own(PLACES,site)) && own(visibility,p.visibility));
      const linked = p.exchange && findApp(s,p.exchange,who);
      if (p.exchange) requireValue((canReflect(linked) || (linked && note?.exchange === linked.id)) &&
        sites.every(site => linked.stops.some(stop => stop.site === site) || (note?.exchange === linked.id && note.sites.includes(site))));
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
      s.comments = s.comments.filter(c => c.record !== note.id);
      s.reports = s.reports.filter(r => r.record !== note.id);
      return;
    case "comment": {
      requireValue(canReadRecord(s,p.site,p.record,who));
      const body = string(p.text,600,true);
      if (p.id) {
        requireValue(comment?.owner === who && !comment.removed && comment.site === p.site && comment.record === p.record);
        comment.text = body;
        return comment.id;
      }
      const parent = p.parent && s.comments.find(c => c.id === p.parent);
      requireValue(!p.parent || (parent && !parent.removed && parent.site === p.site && parent.record === p.record));
      const id = nextId(s,"comment");
      s.comments.push({id,owner:who,site:p.site,record:p.record,parent:p.parent || "",text:body});
      return id;
    }
    case "removeComment":
      requireValue(comment?.owner === who && !comment.removed);
      comment.removed = true;
      comment.text = "";
      return;
    case "report": {
      requireValue(canReadRecord(s,p.site,p.record,who));
      if (p.comment) requireValue(s.comments.some(c => c.id === p.comment && c.record === p.record && c.site === p.site && !c.removed && c.owner !== who));
      requireValue(!s.reports.some(r => r.by === who && r.site === p.site && r.record === p.record && r.comment === (p.comment || "")));
      s.reports.push({by:who,site:p.site,record:p.record,comment:p.comment || "",reason:string(p.reason,220,true)});
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
  notify(s,app,who,action === "settleDate" ? (p.accept ? "dateAccepted" : "dateKept") : app.status);
  return app.id;
}

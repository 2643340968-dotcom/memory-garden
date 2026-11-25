import test from "node:test";
import assert from "node:assert/strict";
import {CITIES} from "../src/flow/places.js";
import {applyChange, canApply, canReadRecord, findApp, homeCity, newBook, notesAt} from "../src/flow/exchange/model.js";
import {upgradeBook} from "../src/flow/exchange/migration.js";

const create = () => {
  const state = newBook();
  const run = (actor,action,fields) => applyChange(state,actor,action,fields);
  const offer = state.offers.find(o => o.home === "qingdao");
  const host = offer.owner, third = host === "lin" ? "zhou" : "lin";
  const id = run("an","draft",{offer:offer.id,home:"nanjing"});
  const act = (actor,action,data={}) => run(actor,action,{app:id,...data});
  const send = () => act("an","send",{message:"  河岸的城市记忆  ",method:"online",date:"2027-01-04"});
  const confirm = () => {send(); act(host,"respond",{status:"confirmed"});};
  return {state,run,offer,host,third,id,act,send,confirm};
};
test("every resident can exchange visits with each of the other seventeen cities",() => {
  const {state,run} = create();
  assert.equal(state.offers.length,Object.keys(CITIES).length);
  for (const o of state.offers) {
    assert.equal(homeCity(o.owner),o.home);
    for (const visitor of state.offers) {
      assert.equal(canApply(o,visitor.owner,visitor.home),visitor.home !== o.home);
      if (visitor.home === o.home) continue;
      const id = run(visitor.owner,"draft",{offer:o.id,home:visitor.home}), a = findApp(state,id,visitor.owner);
      assert.deepEqual([a.visits[visitor.owner].from,a.visits[visitor.owner].to],[visitor.home,o.home]);
      assert.deepEqual([a.visits[o.owner].from,a.visits[o.owner].to],[o.home,visitor.home]);
    }
  }
  const fields = {home:"nanjing",away:"qingdao",theme:" 海岸与城市 ",method:"offline",date:"2027-01-02"};
  assert.throws(() => run("an","publish",{...fields,away:"nanjing"}));
  const id = run("an","publish",fields);
  assert.throws(() => run("an","draft",{offer:id,home:"qingdao"}));
  assert.throws(() => run("lin","draft",{offer:id,home:"chengdu"}));
  const application = findApp(state,run("zhou","draft",{offer:id,home:"qingdao"}),"zhou");
  assert.equal(application.visits.an.date,fields.date);
  assert.equal(application.visits.zhou.date,"");
  assert.throws(() => run("lin","closeOffer",{id}));
  run("an","closeOffer",{id});
  assert.throws(() => run("zhou","draft",{offer:id,home:"qingdao"}));
});
test("one visitor can explicitly choose any ordered city pair without changing identity or reusing another route's draft",() => {
  const book = newBook(), actor = book.defaultReader;
  assert.equal(homeCity(actor),undefined);
  const cities = Object.keys(CITIES), ids = new Set();
  for (const offer of book.offers) {
    for (const home of [...cities,"","missing",undefined]) {
      const draft = () => applyChange(book,actor,"draft",{offer:offer.id,home});
      if (!cities.includes(home) || home === offer.home) {
        assert.throws(draft);
        continue;
      }
      const id = draft(), app = findApp(book,id,actor);
      assert.equal(draft(),id);
      assert.ok(!ids.has(id));
      ids.add(id);
      assert.deepEqual([app.visits[actor].from,app.visits[actor].to],[home,offer.home]);
      assert.deepEqual([app.visits[offer.owner].from,app.visits[offer.owner].to],[offer.home,home]);
    }
  }
  assert.equal(ids.size,18*17);
  const fields = {home:"kunming",away:"wuhan",method:"offline",theme:" 两地的春天 "};
  for (const invalid of [{home:undefined},{home:"missing"},{away:""},{away:"kunming"}])
    assert.throws(() => applyChange(book,actor,"publish",{...fields,...invalid}));
  const id = applyChange(book,actor,"publish",fields);
  assert.throws(() => applyChange(book,"an","draft",{offer:id,home:"nanjing"}));
  const app = findApp(book,applyChange(book,"an","draft",{offer:id,home:"wuhan"}),"an");
  assert.deepEqual([app.visits.an.from,app.visits.an.to],["wuhan","kunming"]);
  assert.deepEqual([app.visits[actor].from,app.visits[actor].to],["kunming","wuhan"]);
});
test("drafts, invitations, rejection and reapplication respect the two participants",() => {
  const {state,run,act,offer,host,third,id,send} = create();
  assert.equal(findApp(state,id,host),undefined);
  assert.equal(run("an","draft",{offer:offer.id,home:"nanjing"}),id);
  act("an","saveDraft",{message:" draft ",method:"online",date:""});
  send();
  assert.equal(findApp(state,id,third),undefined);
  assert.equal(findApp(state,id,host).message,"  河岸的城市记忆  ");
  assert.throws(() => act("an","respond",{status:"confirmed"}));
  assert.throws(() => act(third,"respond",{status:"confirmed"}));
  act(host,"respond",{status:"declined"});
  assert.ok(state.notices.some(n => n.kind === "declined" && n.to === "an"));
  const next = run("an","draft",{offer:offer.id,home:"nanjing"});
  assert.notEqual(next,id);
  run("an","discard",{app:next});
  assert.equal(findApp(state,next,"an"),undefined);
});
test("each participant owns their arrival, date changes and review on the application",() => {
  const {act,state,host,third,id,confirm} = create();
  confirm();
  const app = findApp(state,id,host);
  assert.throws(() => act(third,"visited"));
  assert.throws(() => act("an","review",{rating:4,text:"Too soon"}));
  assert.throws(() => act(host,"reschedule",{date:"2027-02-30"}));
  act("an","reschedule",{date:"2027-02-28"});
  act(host,"reschedule",{date:"2027-03-10"});
  assert.throws(() => act("an","settleDate",{visitor:"an",accept:true}));
  act(host,"settleDate",{visitor:"an",accept:true});
  assert.equal(app.visits.an.date,"2027-02-28");
  assert.equal(app.visits[host].date,"");
  act("an","visited");
  assert.equal(app.visits[host].visited,false);
  act("an","review",{rating:0,text:"  河岸  "});
  assert.equal(app.visits.an.review.text,"  河岸  ");
  assert.equal(state.notes.length,0);
  assert.equal(state.comments.length,0);
  assert.throws(() => act(host,"review",{rating:5,text:""}));
  act("an","settleDate",{visitor:host,accept:true});
  assert.equal(app.visits[host].date,"2027-03-10");
  assert.equal(app.status,"active");
  act(host,"visited"); assert.equal(app.status,"completed");
  assert.throws(() => act("an","visited"));
  assert.throws(() => act(third,"review",{rating:5,text:""}));
  assert.throws(() => act("an","review",{rating:0,text:" "}));
  act(host,"review",{rating:4,text:""});
  act("an","review",{rating:3,text:"Revised"});
  assert.equal(app.visits[host].review.rating,4);
  assert.equal(app.visits.an.review.text,"Revised");
  assert.equal(state.notices.filter(n => n.to === host && n.kind === "review").length,1);
  assert.equal(findApp(state,id,third),undefined);
  act("an","read"); assert.ok(state.notices.filter(n => n.to === "an").every(n => n.read));
});
test("existing linked notes retain their audience and media; new garden notes belong to their place",() => {
  const {run,state,host,third,id,confirm} = create();
  confirm();
  const [s1,s2,s3] = CITIES.qingdao.places;
  const media = {kind:"audio",name:"harbour.mp3",size:20};
  const props = {text:"  Tide  ",sites:[s1,s2],exchange:id,visibility:"partners",media};
  assert.throws(() => run("an","note",props));
  assert.throws(() => run("an","note",{...props,sites:[s1],exchange:""}));
  const note = "field-note-old";
  state.notes.push({...props,id:note,owner:"an"});
  assert.equal(notesAt(state,s2,host)[0].text,"  Tide  ");
  assert.deepEqual(notesAt(state,s1,third),[]);
  assert.equal(canReadRecord(state,s3,note,host),false);
  const target = {site:s1,record:note};
  assert.throws(() => run(third,"comment",{...target,text:"outside"}));
  assert.throws(() => run(host,"comment",{...target,text:"Nested entry"}));
  assert.throws(() => run(host,"note",{parent:note,sites:[s1],text:"Nested",visibility:"public"}));
  const otherFlower = run(host,"note",{sites:[s1],text:"My own words",visibility:"public"});
  run(host,"report",{...target,reason:"Review this text"});
  assert.throws(() => run(host,"report",{...target,reason:"Again"}));
  assert.throws(() => run(third,"report",{...target,reason:"Hidden flower"}));
  run("an","note",{...props,id:note,media:undefined,text:"Revised",visibility:"private"});
  assert.equal(notesAt(state,s1,"an").find(n => n.id === note).media.name,media.name);
  assert.equal(canReadRecord(state,s1,note,host),false);
  assert.throws(() => run(host,"removeNote",{id:note}));
  run("an","removeNote",{id:note});
  assert.deepEqual(notesAt(state,s1,third).map(n => n.id),[otherFlower]);
  assert.equal(state.reports.length,0);
});
test("old comments and replies become independent flowers at the same site with the original audience",() => {
  const {state,host,third,id,confirm} = create();
  confirm();
  state.version = 2;
  const [site,other] = CITIES.qingdao.places;
  const restricted = {id:"field-note-10",owner:"an",text:"old note",visibility:"partners",exchange:id,sites:[site,other]};
  state.notes.push(restricted);
  const comment = (id,owner,text,record,parent="") => ({id,owner,text,record,parent,site});
  state.comments.push(
    comment("comment-15",host,"  海风  ","historic-event"),
    comment("comment-16","an","独立的花",restricted.id),
    comment("comment-17",host,"另一段回忆",restricted.id,"comment-16"),
    {...comment("comment-18",host,"","historic-event"),removed:true},
    comment("comment-19",host,"自己的文字","field-note-unavailable"));
  state.reports.push({by:"an",site,record:restricted.id,comment:"comment-17",reason:"local report"});
  const upgraded = upgradeBook(state);
  assert.equal(upgraded.version,3);
  assert.equal(upgraded.comments.length,0);
  assert.equal(upgraded.notes.length,5);
  assert.equal(notesAt(upgraded,site,third)[0].text,"  海风  ");
  assert.equal(notesAt(upgraded,site,third).length,1);
  assert.equal(notesAt(upgraded,other,host).length,1);
  const reply = upgraded.notes.find(n => n.id === "field-note-comment-17");
  assert.deepEqual([reply.owner,reply.sites,reply.visibility,reply.exchange],[host,[site],"partners",id]);
  assert.equal(upgraded.reports[0].record,reply.id);
  assert.equal(upgraded.notes.find(n => n.id === "field-note-comment-19").visibility,"private");
  assert.ok(upgraded.notes.every(n => !n.parent && !n.record));
  applyChange(upgraded,"an","removeNote",{id:restricted.id});
  assert.ok(notesAt(upgraded,site,host).includes(reply));
  assert.equal(upgradeBook(upgraded),upgraded);
});
test("pending withdrawals and accepted cancellations are terminal for both partners",() => {
  const {state,host,act,send,id} = create();
  send();
  assert.throws(() => act(host,"cancel"));
  act("an","cancel");
  assert.equal(findApp(state,id,host).status,"cancelled");
  assert.throws(() => act(host,"respond",{status:"confirmed"}));
  const other = create();
  other.confirm();
  other.act(other.host,"cancel");
  assert.throws(() => other.act("an","visited"));
});
test("existing single-city plans migrate once without inventing a return visit or losing old records",() => {
  const note = {id:"field-note-2",sites:["zhanqiao"],media:{kind:"audio",name:"tide.wav"}};
  const original = {...newBook(),version:1,serial:44,notes:[note],
    offers:["local","visitor"].map(role => ({id:role,city:"qingdao",origin:"nanjing",role,owner:"zhou",sample:true,open:true})),
    applications:["local","visitor"].map(offer => ({id:"old-"+offer,city:"qingdao",sender:"an",recipient:"zhou",offer,
      status:"completed",date:"2026-09-01",stops:[{site:"zhanqiao",time:"12:30",question:"Tides?"}]}))};
  delete original.defaultReader;
  const next = upgradeBook(original);
  assert.equal(next.defaultReader,"an");
  assert.equal(next.notes[0],note);
  assert.equal(next.serial,44);
  assert.equal(upgradeBook(next),next);
  for (const [i,actor] of ["an","zhou"].entries()) {
    const a = next.applications[i];
    assert.equal(a.previouslyClosed,true);
    assert.equal(a.visits[actor].to,"qingdao");
    assert.equal(a.visits[actor].date,"2026-09-01");
    assert.equal(a.visits[actor].savedPlaces[0].question,"Tides?");
    assert.ok(Object.values(a.visits).every(v => !v.visited && !v.review));
    applyChange(next,actor,"visited",{app:a.id});
    applyChange(next,actor,"review",{app:a.id,rating:5,text:""});
  }
  assert.equal(original.applications[0].status,"completed");
});
test("an older tab can add a pending change without duplicating invitations or altering modern reviews",() => {
  const {state,id,act,host,confirm} = create();
  confirm();
  act("an","visited");
  act("an","review",{rating:5,text:"海边很安静"});
  act(host,"visited");
  state.offers.push({id:"older-offer",city:"qingdao",origin:"nanjing",role:"local",owner:"zhou",open:true});
  state.applications.push({id:"older-app",offer:"older-offer",sender:"an",recipient:"zhou",city:"qingdao",status:"rescheduling",
    date:"2026-12-01",proposal:{by:"zhou",date:"2026-12-03"}});
  const upgraded = upgradeBook(state);
  assert.equal(upgraded.offers.length,Object.keys(CITIES).length + 1);
  assert.equal(findApp(upgraded,id,"an").visits.an.review.text,"海边很安静");
  assert.ok(upgraded.notices.some(n => n.app === id && n.kind === "completed"));
  const legacy = findApp(upgraded,"older-app","an");
  assert.equal(legacy.visits.an.proposedDate,"2026-12-03");
  const change = {app:legacy.id,visitor:"an",accept:true};
  assert.throws(() => applyChange(upgraded,"zhou","settleDate",change));
  applyChange(upgraded,"an","settleDate",change);
  assert.equal(legacy.visits.an.date,"2026-12-03");
  assert.equal(legacy.visits.zhou.date,"");
  assert.equal(upgradeBook(upgraded),upgraded);
});

import {homeCity, makeVisits, newBook} from "./model.js";

// Version 1 stored a single destination and one set of stops. Keep its records and media IDs intact.
function upgradeVisits(book) {
  // A tab still running the earlier edition can add a legacy invitation after another tab upgraded.
  if (book.version !== 1 && book.offers.every(o => o.home) && book.applications.every(a => a.visits)) return book;
  const offers = book.offers.map(o => {
    if (o.home) return o;
    const {city,origin,role,...rest} = o;
    return {...rest,home:role === "local" ? city : origin,away:role === "local" ? origin : city,legacySample:Boolean(o.sample)};
  });
  const byId = new Map(offers.map(o => [o.id,o]));
  const migrated = new Set();
  const applications = book.applications.map(original => {
    if (original.visits) return original;
    const {city,date,stops,proposal,...app} = original;
    const offer = byId.get(app.offer);
    migrated.add(app.id);
    const visits = makeVisits(app.sender,app.recipient,offer.away || homeCity(app.sender),offer.home);
    const oldDestination = Object.values(visits).find(visit => visit.to === city) ?? visits[app.sender];
    oldDestination.date = date || "";
    if (stops?.length) oldDestination.savedPlaces = stops;
    if (proposal) {
      oldDestination.proposedDate = proposal.date;
      oldDestination.proposedBy = proposal.by;
    }
    // A single completion in v1 does not establish either person's individual visit.
    if (app.status === "completed") { app.status = "active"; app.previouslyClosed = true; }
    return {...app,visits};
  });
  const notices = book.notices.map(n => migrated.has(n.app) && ["route","completed"].includes(n.kind) ?
    {...n,kind:"planUpdated"} : n);
  const newOffers = newBook().offers.filter(o => !byId.has(o.id));
  return {...book,offers:[...offers,...newOffers],applications,notices};
}

export function upgradeBook(previous) {
  if (!previous) return newBook();
  if (![1,2,3].includes(previous.version)) throw new Error("unsupported-exchange-version");
  const book = upgradeVisits(previous);
  if (book.version === 3 && !book.comments.length) return book;

  // Each surviving entry keeps its author, exact words and original garden.
  // A thread on a restricted flower must not become public when its entries separate.
  const originalNotes = new Map(book.notes.map(n => [n.id,n]));
  const newFlowers = [], migrated = new Map();
  for (const comment of book.comments) {
    if (comment.removed) continue;
    const original = originalNotes.get(comment.record);
    const audience = original?.visibility ?? (comment.record.startsWith("field-note-") ? "private" : "public");
    const id = "field-note-" + comment.id;
    migrated.set(comment.id,id);
    if (originalNotes.has(id)) continue;
    newFlowers.push({id,owner:comment.owner,text:comment.text,sites:[comment.site],media:null,
      visibility:audience,exchange:audience === "partners" ? original.exchange : ""});
  }
  const reports = book.reports.map(r => migrated.has(r.comment) ?
    {...r,record:migrated.get(r.comment),comment:""} : r);
  return {...book,version:3,notes:[...newFlowers.reverse(),...book.notes],comments:[],reports};
}

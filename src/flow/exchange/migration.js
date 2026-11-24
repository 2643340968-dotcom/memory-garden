import {homeCity, makeVisits, newBook} from "./model.js";

// Version 1 stored a single destination and one set of stops. Keep its records and media IDs intact.
export function upgradeBook(book) {
  if (!book) return newBook();
  if (book.version !== 1 && book.version !== 2) throw new Error("unsupported-exchange-version");
  // A tab still running the earlier edition can add a legacy invitation after another tab upgraded.
  if (book.version === 2 && book.offers.every(o => o.home) && book.applications.every(a => a.visits)) return book;
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
  return {...book,version:2,offers:[...offers,...newOffers],applications,notices};
}

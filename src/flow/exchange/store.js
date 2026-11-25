import {applyChange, newBook, profiles} from "./model.js";
import {upgradeBook} from "./migration.js";

const database = "memory-garden-flow-exchange-v1";
const sessionKey = database + "-reader";
const done = tx => new Promise((resolve,reject) => {
  tx.oncomplete = resolve;
  tx.onabort = () => reject(tx.error ?? new Error("cancelled"));
});
function openDatabase() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(database,1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("book");
      request.result.createObjectStore("media");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("blocked"));
  });
}
function get(store,key) {
  return new Promise((resolve,reject) => {
    const q = store.get(key);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
export class ExchangeStore extends EventTarget {
  constructor() {
    super();
    this.state = newBook();
    this.reader = null;
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (Object.hasOwn(profiles,saved)) this.reader = saved;
    } catch { /* Restricted storage still allows a visit. */ }
    this.temporaryBlobs = new Map();
    this.queue = Promise.resolve();
    this.ready = this.open();
  }
  async open() {
    try {
      this.db = await openDatabase();
      await this.refresh();
    } catch { this.db?.close(); this.db = null; }
    if (this.db && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(database);
      this.channel.onmessage = () => { this.schedule(() => this.refresh()).catch(() => {}); };
    }
    this.changed();
  }
  async refresh() {
    const tx = this.db.transaction("book","readwrite");
    const book = tx.objectStore("book");
    const [current] = await Promise.all([get(book,"current").then(previous => {
      const upgraded = upgradeBook(previous);
      if (previous && previous !== upgraded) book.put(upgraded,"current");
      return upgraded;
    }),done(tx)]);
    this.state = current;
    this.changed();
  }
  changed() { this.dispatchEvent(new Event("change")); }
  get actor() { return this.reader ?? this.state.defaultReader; }
  choose(actor) {
    if (!Object.hasOwn(profiles,actor) || this.actor === actor) return;
    this.reader = actor;
    try { sessionStorage.setItem(sessionKey,actor); } catch { /* Private browsing. */ }
    this.changed();
  }
  schedule(task) {
    const result = this.queue.then(task);
    this.queue = result.catch(() => {});
    return result;
  }
  change(action, payload, blob, reader = this.reader) {
    return this.schedule(async () => {
      await this.ready;
      let next, id;
      if (this.db) {
        const tx = this.db.transaction(["book","media"],"readwrite");
        const finished = done(tx);
        try {
          const book = tx.objectStore("book");
          next = upgradeBook(await get(book,"current"));
          id = applyChange(next,reader ?? next.defaultReader,action,payload);
          book.put(next,"current");
          if (blob) tx.objectStore("media").put(blob,id);
          if (action === "removeNote" || (action === "note" && payload.media === null)) tx.objectStore("media").delete(payload.id ?? id);
        } catch (e) {
          try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
          await finished.catch(() => {});
          throw e;
        }
        await finished;
      } else {
        next = structuredClone(this.state);
        id = applyChange(next,reader ?? next.defaultReader,action,payload);
        if (blob) this.temporaryBlobs.set(id,blob);
        if (action === "removeNote" || (action === "note" && payload.media === null)) this.temporaryBlobs.delete(payload.id ?? id);
      }
      this.state = next;
      this.changed();
      this.channel?.postMessage("changed");
      return id;
    });
  }
  async attachment(id) {
    await this.ready;
    return this.db ? get(this.db.transaction("media").objectStore("media"),id) : this.temporaryBlobs.get(id);
  }
}

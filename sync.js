/* Chalk storage and backup sync.
   Loaded by the page and by the service worker, so a backup can finish even after the app is closed.

   On-device database (IndexedDB "chalk"):
     records  current version of every record      { k: "session:<id>", ts, data }
     outbox   changes not yet confirmed by backup   { id, seq, k, op, ts, data }
     kv       small values: backup config, device id, active workout, sync status

   Rules that keep data safe:
     - A record change and its outbox entry are written in ONE transaction: both or neither.
     - An outbox entry is only removed after the backup confirms it received that exact entry id.
     - The backup is append-only and ignores ids it has already seen, so resending is always safe.
*/
const CHALK_DB = 'chalk';
const CHALK_DB_VERSION = 1;

function chalkOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(CHALK_DB, CHALK_DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('records')) d.createObjectStore('records', { keyPath: 'k' });
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' }).createIndex('k', 'k');
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = () => { const d = r.result; d.onversionchange = () => d.close(); resolve(d); };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Database is blocked by another open copy of the app'));
  });
}
let _chalkDb = null;
function chalkDb() { return _chalkDb || (_chalkDb = chalkOpen().catch(e => { _chalkDb = null; throw e; })); }
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const txDone = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transaction aborted')); });

async function kvGet(k) { const d = await chalkDb(); return reqP(d.transaction('kv').objectStore('kv').get(k)); }
async function kvSet(k, v) { const d = await chalkDb(); const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); return txDone(t); }
async function storeAll(name) { const d = await chalkDb(); return reqP(d.transaction(name).objectStore(name).getAll()); }
async function outboxCount() { const d = await chalkDb(); return reqP(d.transaction('outbox').objectStore('outbox').count()); }

let _seqCounter = 0;
function nextSeq() { _seqCounter = (_seqCounter + 1) % 1000; return Date.now() * 1000 + _seqCounter; }
function newId() {
  if (self.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

/* Write record changes plus their outbox entries atomically.
   changes: [{ k, op: 'put'|'delete', data, ts }]. Pending (unsent) entries for the same key are
   replaced by the newer one; anything already in the backup is never touched. */
async function writeChanges(changes, device) {
  if (!changes.length) return;
  const d = await chalkDb();
  const t = d.transaction(['records', 'outbox'], 'readwrite');
  const R = t.objectStore('records'), O = t.objectStore('outbox'), idx = O.index('k');
  for (const c of changes) {
    if (c.op === 'delete') R.delete(c.k); else R.put({ k: c.k, ts: c.ts, data: c.data });
    if (c.local) continue; // local-only change (came from the backup itself)
    const ev = { id: newId(), seq: nextSeq(), k: c.k, op: c.op, ts: c.ts, device, data: c.op === 'delete' ? null : c.data };
    idx.getAllKeys(c.k).onsuccess = (e) => { e.target.result.forEach(id => O.delete(id)); O.put(ev); };
  }
  return txDone(t);
}

/* ---------- talking to the Google Sheet backup ---------- */
async function backupCall(cfg, body, timeoutMs = 60000) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(cfg.url, {
      method: 'POST', redirect: 'follow', signal: ctl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // keeps the request "simple" for Apps Script
      body: JSON.stringify({ ...body, key: cfg.key, device: cfg.device, client: 'chalk/1' })
    });
    if (!res.ok) throw new Error('Backup answered with HTTP ' + res.status);
    let j; try { j = await res.json(); } catch (e) { throw new Error('Backup did not answer with data. Check the web app link and that access is set to “Anyone”.'); }
    if (!j || j.ok !== true) throw new Error((j && j.error) || 'Backup refused the request');
    return j;
  } finally { clearTimeout(timer); }
}

async function pushOutbox() {
  const cfg = await kvGet('backup');
  if (!cfg || !cfg.url || !cfg.key) return { state: 'off', sent: 0 };
  let sent = 0;
  try {
    for (let round = 0; round < 200; round++) {
      const all = (await storeAll('outbox')).sort((a, b) => a.seq - b.seq);
      if (!all.length) break;
      const batch = []; let size = 0;
      for (const e of all) { const s = JSON.stringify(e).length; if (batch.length && (size + s > 350000 || batch.length >= 120)) break; batch.push(e); size += s; }
      const j = await backupCall(cfg, { action: 'push', events: batch });
      const ok = new Set(j.accepted || []);
      if (!ok.size) throw new Error('Backup did not confirm any changes');
      const d = await chalkDb(); const t = d.transaction('outbox', 'readwrite'); const O = t.objectStore('outbox');
      batch.forEach(e => { if (ok.has(e.id)) O.delete(e.id); }); await txDone(t);
      sent += ok.size;
    }
    await kvSet('syncStatus', { lastOk: Date.now(), lastError: null, lastErrorAt: null });
    return { state: 'ok', sent };
  } catch (err) {
    const prev = (await kvGet('syncStatus')) || {};
    await kvSet('syncStatus', { ...prev, lastError: String(err && err.message || err), lastErrorAt: Date.now() });
    throw err;
  }
}
function withSyncLock(fn) {
  if (self.navigator && navigator.locks && navigator.locks.request) return navigator.locks.request('chalk-sync', fn);
  return fn();
}

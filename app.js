'use strict';
/* =========================================================
   Chalk — strength training log
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const clone = (o) => JSON.parse(JSON.stringify(o));
const LIBRARY = JSON.parse(document.getElementById('library').textContent);
const RPE_TABLE = LIBRARY.rpe;
const DATA_VERSION = 2;

const PATTERNS = {
  SQ: { name: 'Squat', cls: '' }, HI: { name: 'Hinge' }, HP: { name: 'Horizontal press' }, VP: { name: 'Vertical press' },
  HL: { name: 'Horizontal pull' }, VL: { name: 'Vertical pull' }, OT: { name: 'Accessory' }
};
const PAT_ORDER = ['SQ', 'HI', 'HP', 'VP', 'HL', 'VL', 'OT'];
const MUSCLES = ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'forearms', 'quads', 'glutes', 'hamstrings', 'lower back', 'calves', 'core'];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const patVar = (p) => `var(--p-${(p || 'OT').toLowerCase()})`;
const plate = (p, lg) => `<i class="plate${lg ? ' lg' : ''}${p === 'VL' ? ' vl' : ''}" style="--c:${patVar(p)}" aria-hidden="true"></i>`;

const SHORT = {
  'bench-press-regular-barbell': 'Bench press', 'overhead-press-barbell': 'Overhead press', 'deadlift-regular': 'Deadlift',
  'high-bar': 'High-bar squat', 'low-bar': 'Low-bar squat', 'incline-press-barbell': 'Incline press', 'goodmorning-barbell': 'Good morning',
  'rows-cable': 'Cable row', 'ssb-squat': 'SSB squat', 'deadlift-trapbar': 'Trap-bar deadlift', 'bench-press-2-ct-paused': 'Paused bench',
  'romanian-deadlift': 'RDL', 'rows-barbell': 'Barbell row', 'bench-press-close-grip': 'Close-grip bench', 'incline-press-dumbbell': 'DB incline press'
};

/* ---------- RPE math (from the RPE table in your workbook) ---------- */
function pct(reps, rpe) {
  if (reps == null || rpe == null || rpe === '') return null;
  const r = Math.round(reps); const k = Math.round(rpe * 2) / 2;
  if (r < 1 || r > 20 || k < 5 || k > 10) return null;
  return RPE_TABLE[k.toFixed(1)][r - 1];
}
function e1rm(w, r, rpe) { const p = pct(r, rpe); return (p && w > 0) ? w / p : null; }
function roundTo(x, step) { return Math.round(x / step) * step; }

/* ---------- formatting ---------- */
const nf = (n, d = 1) => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('nl-NL', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const kg = (n) => n == null ? '–' : nf(n, 1);
const ton = (n) => n >= 1000 ? nf(n / 1000, 1) + ' t' : nf(n, 0) + ' kg';
const parseNum = (s) => { if (s == null) return null; s = String(s).trim().replace(',', '.'); if (s === '') return null; const v = parseFloat(s); return isNaN(v) ? null : v; };
const D = (iso) => new Date(iso);
const fmtDate = (d, o = { weekday: 'short', day: 'numeric', month: 'short' }) => d.toLocaleDateString('en-GB', o);
const fmtDateY = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return { y, w, key: `${y}-W${String(w).padStart(2, '0')}` };
}
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1); return x; }
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const periodKey = (d, gran) => gran === 'month' ? monthKey(d) : isoWeek(d).key;
function localISO(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function durText(min) { if (!min) return ''; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h ${m} min` : `${m} min`; }
function clock(ms) { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0'); }

/* ---------- data model ---------- */
let db;
function libraryPrograms() {
  return LIBRARY.programs.map(p => ({
    id: p.id, name: p.name, desc: p.desc,
    weeks: p.weeks.map(w => ({ name: w.name, days: w.days.map(d => ({ name: d.name, note: d.note || '', items: d.items.map(it => ({ id: uid(), exerciseId: it.e, note: it.n || '', group: it.g ? 'g' + it.g : null, sets: it.p.map(([r, rpe]) => ({ r, rpe })) })) })) }))
  }));
}
const DEFAULT_SETTINGS = { activeProgramId: 'current-split', pos: { week: 0, day: 1 }, rest: 150, round: 2.5, bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], theme: 'auto', countWarmups: false };
function defaultData() {
  return { version: DATA_VERSION, exercises: LIBRARY.exercises.map(e => ({ ...e, custom: false })), sessions: [], trash: [], programs: libraryPrograms(), active: null, settings: clone(DEFAULT_SETTINGS) };
}
/* ids that were merged in the naming clean-up; used when importing older files */
const ID_REMAP = { 'incline-db-press-15': 'incline-press-dumbbell', 'straight-arm-pulldown': 'triceps-pushdown', 'cable-curl': 'biceps-curl' };

const exById = (id) => db.exercises.find(e => e.id === id) || { id, name: id, pattern: 'OT', primary: [], secondary: [] };
const exName = (id) => exById(id).name;
const exShort = (id) => SHORT[id] || exName(id);

/* ---------- derived data (memoised) ---------- */
let cache = null;
function invalidate() { cache = null; }
function isHard(s) { return s.done && (db.settings.countWarmups || s.type !== 'warm'); }
function derived() {
  if (cache) return cache;
  const flat = []; const ex = {};
  const sessions = [...db.sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sessions) {
    const d = D(s.date);
    for (const it of s.items) {
      if (it.kind !== 'lift') continue;
      const X = exById(it.exerciseId);
      const st = ex[it.exerciseId] || (ex[it.exerciseId] = { id: it.exerciseId, count: 0, best: null, bestW: null, repMax: {}, last: null, lastE1: null, history: [] });
      st.count++;
      const e1s = [];
      it.sets.forEach((set, i) => {
        if (!isHard(set)) return;
        const e = e1rm(set.w, set.r, set.rpe);
        if (e) { e1s.push(e); if (!st.best || e > st.best.v) st.best = { v: e, date: s.date, w: set.w, r: set.r, rpe: set.rpe, sid: s.id }; }
        if (set.w > 0 && set.r) {
          if (!st.bestW || set.w > st.bestW.w) st.bestW = { w: set.w, r: set.r, date: s.date };
          const rm = st.repMax[set.r]; if (!rm || set.w > rm.w) st.repMax[set.r] = { w: set.w, date: s.date, rpe: set.rpe };
        }
        flat.push({ d, sid: s.id, ex: it.exerciseId, pat: X.pattern, prim: X.primary, sec: X.secondary, w: set.w || 0, r: set.r || 0, rpe: set.rpe, e1: e });
      });
      const band = e1s.length ? { min: Math.min(...e1s), max: Math.max(...e1s), avg: e1s.reduce((a, b) => a + b, 0) / e1s.length } : null;
      st.last = { sid: s.id, date: s.date, sets: it.sets, note: it.note, band };
      if (band) st.lastE1 = { v: band.avg, date: s.date };
      st.history.push({ sid: s.id, date: s.date, sets: it.sets, note: it.note, band });
    }
  }
  cache = { flat, ex };
  return cache;
}
function sessionStats(s) {
  let sets = 0, reps = 0, tonnage = 0; const pats = new Set(); const byPat = {};
  for (const it of s.items) {
    if (it.kind !== 'lift') continue;
    const p = exById(it.exerciseId).pattern;
    for (const set of it.sets) { if (!isHard(set)) continue; sets++; reps += set.r || 0; tonnage += (set.w || 0) * (set.r || 0); pats.add(p); byPat[p] = (byPat[p] || 0) + 1; }
  }
  return { sets, reps, tonnage, pats: PAT_ORDER.filter(p => pats.has(p)), byPat };
}
function sessionTitle(s) {
  if (s.title) return s.title;
  if (s.programRef) { const d = programDay(s.programRef); if (d) return d.name; }
  const seen = new Set(); const names = [];
  for (const i of s.items) {
    if (i.kind !== 'lift') continue;
    if (i.group) { if (seen.has(i.group)) continue; seen.add(i.group); }
    names.push(exShort(i.exerciseId)); if (names.length === 2) break;
  }
  return names.length ? names.join(' & ') : (s.items[0]?.name || 'Workout');
}
function setStr(sets) {
  const hard = sets.filter(s => s.done !== false);
  if (!hard.length) return '';
  const R = hard.map(s => s.r ?? '–').join('/');
  const W = [...new Set(hard.map(s => s.w))];
  const wPart = W.length === 1 ? (W[0] ? kg(W[0]) + ' kg' : 'BW') : hard.map(s => kg(s.w)).join('/') + ' kg';
  const E = hard.some(s => s.rpe != null) ? ' @ ' + hard.map(s => s.rpe != null ? nf(s.rpe) : '–').join('/') : '';
  return `${R} × ${wPart}${E}`;
}
function rxStr(sets) {
  if (!sets.length) return '';
  const R = sets.map(s => s.r ?? '–').join('/');
  const E = sets.some(s => s.rpe != null) ? ' @ ' + sets.map(s => s.rpe != null ? nf(s.rpe) : '–').join('/') : '';
  return R + E;
}
function suggestLoad(exId, r, rpe) {
  const st = derived().ex[exId]; if (!st || !st.lastE1) return null;
  const p = pct(r, rpe); if (!p) return null;
  return roundTo(st.lastE1.v * p, db.settings.round || 2.5);
}

/* ---------- periods, ranges, volume ---------- */
const RANGES = { '4w': 28, '12w': 84, '6m': 183, '1y': 365, 'all': 99999 };
function rangeStart(r) {
  if (r === 'all') { const f = derived().flat; return f.length ? mondayOf(f[0].d) : new Date(); }
  const d = new Date(); d.setDate(d.getDate() - RANGES[r] + 1); return mondayOf(d);
}
function periodsBetween(start, end, gran) {
  const out = []; const d = gran === 'month' ? new Date(start.getFullYear(), start.getMonth(), 1) : mondayOf(start);
  while (d <= end) {
    const key = periodKey(d, gran);
    let label;
    if (gran === 'month') label = d.toLocaleDateString('en-GB', { month: 'short' }) + (d.getMonth() === 0 || !out.length ? ' ’' + String(d.getFullYear()).slice(2) : '');
    else label = fmtDate(d, { day: 'numeric', month: 'short' });
    out.push({ key, label, start: new Date(d) });
    if (gran === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 7);
  }
  return out;
}
function volumeBy(periods, gran, metric, by) {
  const idx = Object.fromEntries(periods.map((p, i) => [p.key, i]));
  const res = {}; const add = (cat, i, v) => { (res[cat] || (res[cat] = new Array(periods.length).fill(0)))[i] += v; };
  for (const f of derived().flat) {
    const i = idx[periodKey(f.d, gran)]; if (i == null) continue;
    const v = metric === 'sets' ? 1 : metric === 'reps' ? f.r : f.w * f.r;
    if (by === 'pattern') add(f.pat, i, v);
    else { (f.prim || []).forEach(m => add(m, i, v)); (f.sec || []).forEach(m => add(m, i, v * 0.5)); }
  }
  return res;
}
function e1Series(exId, periods, gran) {
  const idx = Object.fromEntries(periods.map((p, i) => [p.key, i]));
  const buckets = periods.map(() => []);
  for (const f of derived().flat) { if (f.ex !== exId || !f.e1) continue; const i = idx[periodKey(f.d, gran)]; if (i != null) buckets[i].push(f.e1); }
  return buckets.map(b => b.length ? { min: Math.min(...b), max: Math.max(...b), avg: b.reduce((a, c) => a + c, 0) / b.length } : null);
}

/* ---------- programs ---------- */
const progById = (id) => db.programs.find(p => p.id === id);
function programDay(ref) { const p = progById(ref?.programId); return p?.weeks[ref.week]?.days[ref.day] || null; }
function planByPattern(week) {
  const out = {}; if (!week) return out;
  for (const d of week.days) for (const it of d.items) { const p = exById(it.exerciseId).pattern; out[p] = (out[p] || 0) + it.sets.length; }
  return out;
}
function advancePos(prog, pos) {
  let { week, day } = pos; day++;
  if (day >= (prog.weeks[week]?.days.length || 0)) { day = 0; week++; if (week >= prog.weeks.length) week = 0; }
  return { week, day };
}
function lastDoneFor(progId, w, d) {
  return db.sessions.find(s => s.programRef && s.programRef.programId === progId && s.programRef.week === w && s.programRef.day === d);
}
function parseScheme(reps, rpe) {
  const R = String(reps || '').split(/[\/,\s]+/).map(x => parseInt(x)).filter(x => !isNaN(x));
  const E = String(rpe || '').split('/').map(x => parseNum(x));
  return R.map((r, i) => ({ r, rpe: E.length === 1 ? E[0] : (E[i] ?? null) }));
}
const schemeReps = (sets) => sets.map(s => s.r).join('/');
const schemeRpe = (sets) => sets.some(s => s.rpe != null) ? sets.map(s => s.rpe != null ? nf(s.rpe) : '').join('/') : '';

/* ---------- icons ---------- */
const sv = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
const I = {
  today: sv('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/>'),
  history: sv('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  progress: sv('<path d="M4 19V5M4 19h16"/><path d="M7.5 15l4-4.5 3 2.5 5-6"/>'),
  programs: sv('<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M14.5 3.5V7.5h4M9 12h6.5M9 16h6.5"/>'),
  more: sv('<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>'),
  check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
  x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  down: sv('<path d="M6 9l6 6 6-6"/>'),
  kebab: sv('<circle cx="12" cy="5.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor"/>'),
  up: sv('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  dn: sv('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  link: sv('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>'),
  unlink: sv('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/><path d="M3.5 3.5l17 17"/>'),
  trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  swap: sv('<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
  clock: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  calc: sv('<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8 11h2M12 11h0M16 11h0M8 15h2M12 15h0M16 15v3"/>'),
  plates: sv('<path d="M3 12h18"/><rect x="6" y="6" width="3" height="12" rx="1"/><rect x="15" y="6" width="3" height="12" rx="1"/><rect x="9.5" y="8" width="2" height="8" rx=".8"/><rect x="12.5" y="8" width="2" height="8" rx=".8"/>'),
  copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  edit: sv('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
  play: sv('<path d="M8 5.5v13l10.5-6.5z"/>'),
  min: sv('<path d="M6 9l6 6 6-6"/>'),
  note: sv('<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>'),
  warm: sv('<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-7.5z"/>'),
  drop: sv('<path d="M12 4v12M6 12l6 6 6-6"/>'),
  flag: sv('<path d="M5 21V4h11l-2 4 2 4H5"/>'),
};

/* ---------- ui state ---------- */
const ui = { view: 'today', range: '12w', gran: 'week', prEx: null, metric: 'sets', by: 'pattern', histQ: '', histLimit: 12, progSel: null, progWeek: 0, pickPat: null, pickQ: '' };
let charts = [];
function destroyCharts() { charts.forEach(c => c.destroy()); charts = []; }
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const patColor = (p) => cssVar('--p-' + (p || 'OT').toLowerCase());
function alpha(hex, a) { if (!hex.startsWith('#')) return hex; const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

/* ---------- toast & sheet ---------- */
let toastT;
function toast(msg, kind) {
  $$('.toast').forEach(t => t.remove()); clearTimeout(toastT);
  const t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t); toastT = setTimeout(() => t.remove(), kind === 'pr' ? 3600 : 2400);
}
const sheets = [];
function openSheet(title, body, opts = {}) {
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', title.replace(/<[^>]+>/g, ''));
  sh.innerHTML = `<div class="grab"></div><div class="sh-head"><h2>${title}</h2><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div><div class="sh-body">${body}</div>`;
  scrim.addEventListener('click', () => closeSheet());
  document.body.append(scrim, sh); ensureGuard();
  const rec = { scrim, sh, opts, charts: [] }; sheets.push(rec);
  const f = sh.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 80);
  return rec;
}
function closeSheet() { const s = sheets.pop(); if (!s) return; s.charts.forEach(c => c.destroy()); s.scrim.remove(); s.sh.remove(); s.opts.onClose && s.opts.onClose(); }
function closeAllSheets() { while (sheets.length) closeSheet(); }
const topSheet = () => sheets[sheets.length - 1];
function menuSheet(title, items) {
  openSheet(title, `<div class="menu">${items.filter(Boolean).map(it => `<button data-act="menu-pick" data-k="${it.k}" class="${it.danger ? 'danger' : ''}">${it.icon || ''}<span>${it.label}</span></button>`).join('')}</div>`, { menu: items });
}
let confirmCb = null;
function confirmSheet(title, text, label, cb) {
  confirmCb = cb;
  openSheet(title, `<p class="muted" style="margin-top:0">${text}</p><div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="confirm-yes">${label}</button></div>`);
}

/* ---------- router ---------- */
const VIEWS = { today: renderToday, history: renderHistory, progress: renderProgress, programs: renderPrograms, more: renderMore };
function route(scrollTop = true) {
  const v = (location.hash || '#today').slice(1);
  const name = VIEWS[v] ? v : 'today';
  if (name !== ui.view && scrollTop) window.scrollTo(0, 0);
  ui.view = name;
  $$('.tabs a').forEach(a => a.setAttribute('aria-current', a.dataset.v === name ? 'page' : 'false'));
  destroyCharts();
  VIEWS[name]();
  renderResume();
}
const rerender = () => route(false);
const view = () => $('#view');

/* ---------- shared row ---------- */
function sessionRow(s) {
  const d = D(s.date); const st = sessionStats(s);
  const lifts = s.items.filter(i => i.kind === 'lift').length;
  const meta = [fmtDate(d, { weekday: 'short' }), `${lifts} exercise${lifts === 1 ? '' : 's'}`, st.tonnage ? ton(st.tonnage) : null].filter(Boolean);
  return `<button class="srow" data-act="open-session" data-id="${s.id}">
    <div class="date"><div class="dd">${d.getDate()}</div><div class="mm">${fmtDate(d, { month: 'short' })}</div></div>
    <div style="min-width:0"><div class="t">${esc(sessionTitle(s))}</div><div class="m">${meta.map(m => `<span>${m}</span>`).join('')}</div>
    <div class="pips">${st.pats.map(p => `<i style="--c:${patVar(p)}" title="${PATTERNS[p].name}"></i>`).join('')}</div></div>
    <div class="r"><b>${st.sets}</b>sets</div></button>`;
}

/* ---------- TODAY ---------- */
function weekSessions(monday) { const end = new Date(monday); end.setDate(end.getDate() + 7); return db.sessions.filter(s => { const d = D(s.date); return d >= monday && d < end; }); }
function weekTotals(list) { let sets = 0, tonnage = 0; const byPat = {}; list.forEach(s => { const st = sessionStats(s); sets += st.sets; tonnage += st.tonnage; for (const p in st.byPat) byPat[p] = (byPat[p] || 0) + st.byPat[p]; }); return { n: list.length, sets, tonnage, byPat }; }
function renderToday() {
  const now = new Date(); const mon = mondayOf(now);
  const prog = progById(db.settings.activeProgramId);
  let hero = '';
  if (prog) {
    const pos = db.settings.pos; const wk = prog.weeks[pos.week]; const day = wk?.days[pos.day];
    if (day) {
      const rows = day.items.map(it => {
        const X = exById(it.exerciseId);
        const loads = it.sets.map(s => suggestLoad(it.exerciseId, s.r, s.rpe)).filter(Boolean);
        const load = loads.length ? (Math.min(...loads) === Math.max(...loads) ? `${kg(loads[0])} kg` : `${kg(Math.min(...loads))}–${kg(Math.max(...loads))} kg`) : '';
        return `<li>${plate(X.pattern)}<span>${esc(X.name)}${it.group ? '<span class="ss-tag">Superset</span>' : ''}</span><span class="rx"><b>${esc(rxStr(it.sets))}</b>${load ? `<br>${load}` : ''}</span></li>`;
      }).join('');
      hero = `<div class="hero">
        <div class="eyebrow"><span>${esc(prog.name)}</span><span class="badge">${esc(wk.name)}, day ${pos.day + 1}</span></div>
        <div class="day">${esc(day.name)}</div>
        ${day.note ? `<p class="muted small" style="margin:-6px 0 14px">${esc(day.note)}</p>` : ''}
        ${rows ? `<ol>${rows}</ol>` : ''}
        <div class="actions"><button class="btn primary big" data-act="start-next">${I.play}Start workout</button><button class="btn big" data-act="pick-day">Choose another day</button></div>
      </div>`;
    }
  }
  if (!hero) hero = `<div class="hero"><div class="eyebrow">No active program</div><div class="day">Ready when you are</div><div class="actions"><button class="btn primary big" data-act="start-empty">${I.play}Start empty workout</button><a class="btn big" href="#programs">Pick a program</a></div></div>`;

  const thisWeek = weekSessions(mon); const tw = weekTotals(thisWeek);
  const prev = [1, 2, 3, 4].map(k => { const m = new Date(mon); m.setDate(m.getDate() - 7 * k); return weekTotals(weekSessions(m)); });
  const avg = (f) => prev.reduce((a, w) => a + f(w), 0) / 4;
  const dlt = (cur, a, fmt) => { const d = cur - a; if (Math.abs(d) < 0.05) return `<div class="d">same as 4-week avg</div>`; return `<div class="d ${d > 0 ? 'up' : ''}">${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} vs 4-week avg</div>`; };
  const days = [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return d; });
  const strip = days.map(d => {
    const ss = thisWeek.filter(s => D(s.date).toDateString() === d.toDateString());
    const pats = new Set(); ss.forEach(s => sessionStats(s).pats.forEach(p => pats.add(p)));
    const isToday = d.toDateString() === now.toDateString();
    return `<div class="d ${ss.length ? 'on' : ''} ${isToday ? 'today' : ''}">${fmtDate(d, { weekday: 'narrow' })}<span class="dot">${d.getDate()}</span><span class="pips">${[...pats].map(p => `<i style="--c:${patVar(p)}"></i>`).join('')}</span></div>`;
  }).join('');
  const plan = prog ? planByPattern(prog.weeks[db.settings.pos.week]) : {};
  const pats = PAT_ORDER.filter(p => plan[p] || tw.byPat[p]);
  const maxV = Math.max(1, ...pats.map(p => Math.max(plan[p] || 0, tw.byPat[p] || 0)));
  const bars = pats.length ? pats.map(p => {
    const done = tw.byPat[p] || 0, pl = plan[p] || 0;
    return `<div class="bar-row"><span class="name">${plate(p)}${PATTERNS[p].name}</span><div class="track" style="--c:${patVar(p)}"><div class="fill" style="width:${done / maxV * 100}%"></div>${pl ? `<div class="plan" style="left:calc(${pl / maxV * 100}% - 1px)" title="Planned ${pl}"></div>` : ''}</div><span class="val">${nf(done, 0)}${pl ? `<span> / ${pl}</span>` : ''}</span></div>`;
  }).join('') : `<div class="empty">No sets logged yet this week.</div>`;

  view().innerHTML = `
    <div class="page-head"><div><h1>${fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</h1><div class="sub">Week ${isoWeek(now).w}</div></div>${syncPill()}</div>
    ${backupBanner()}
    ${hero}
    <div class="grid2">
      <section class="block">
        <div class="block-head"><h2>This week</h2><a class="btn ghost sm" href="#progress">Progress</a></div>
        <div class="week-strip">${strip}</div>
        <div class="kpis">
          <div class="kpi"><div class="v">${tw.n}</div><div class="l">Workouts</div>${dlt(tw.n, avg(w => w.n), v => nf(v, 1))}</div>
          <div class="kpi"><div class="v">${tw.sets}</div><div class="l">Hard sets</div>${dlt(tw.sets, avg(w => w.sets), v => nf(v, 0))}</div>
          <div class="kpi"><div class="v">${nf(tw.tonnage / 1000, 1)}<span style="font-size:18px"> t</span></div><div class="l">Tonnage</div>${dlt(tw.tonnage / 1000, avg(w => w.tonnage) / 1000, v => nf(v, 1) + ' t')}</div>
        </div>
      </section>
      <section class="block">
        <div class="block-head"><h2>Sets by movement</h2><span class="small muted">${prog ? 'Line marks the plan' : ''}</span></div>
        <div class="bars">${bars}</div>
      </section>
    </div>
    <section class="block">
      <div class="block-head"><h2>Recent workouts</h2><a class="btn ghost sm" href="#history">All history</a></div>
      <div class="list">${db.sessions.slice(0, 4).map(sessionRow).join('') || '<div class="empty">Your logged workouts show up here.</div>'}</div>
      <div class="row wrap" style="margin-top:16px"><button class="btn" data-act="start-empty">${I.plus}Empty workout</button><button class="btn ghost" data-act="log-past">Log a past workout</button></div>
    </section>`;
}

/* ---------- HISTORY ---------- */
function renderHistory() {
  const q = ui.histQ.trim().toLowerCase();
  let list = db.sessions;
  if (q) list = list.filter(s => sessionTitle(s).toLowerCase().includes(q) || (s.notes || '').toLowerCase().includes(q) || s.items.some(i => (i.kind === 'lift' ? exName(i.exerciseId) : i.name || '').toLowerCase().includes(q) || (i.note || '').toLowerCase().includes(q)));
  const groups = []; let cur = null;
  for (const s of list) { const w = isoWeek(D(s.date)); if (!cur || cur.key !== w.key) { cur = { key: w.key, w, items: [] }; groups.push(cur); } cur.items.push(s); }
  const shown = q ? groups.slice(0, 40) : groups.slice(0, ui.histLimit);
  const first = db.sessions[db.sessions.length - 1];
  view().innerHTML = `
    <div class="page-head"><div><h1>History</h1><div class="sub">${db.sessions.length} workouts${first ? ' since ' + fmtDate(D(first.date), { month: 'long', year: 'numeric' }) : ''}</div></div><button class="btn sm" data-act="log-past">${I.plus}Log past workout</button></div>
    <input class="input" type="search" placeholder="Filter by exercise, note or title" value="${esc(ui.histQ)}" data-hf="q" aria-label="Filter history">
    <div class="list" style="margin-top:6px">
      ${shown.map(g => { const t = weekTotals(g.items); return `<div class="week-h"><h3>Week ${g.w.w}, ${g.w.y}</h3><span>${t.n} workout${t.n > 1 ? 's' : ''}, ${t.sets} sets, ${ton(t.tonnage)}</span></div>${g.items.map(sessionRow).join('')}`; }).join('') || `<div class="empty" style="margin-top:14px">${q ? 'No workouts match that filter.' : 'No workouts yet. Start one from Today.'}</div>`}
    </div>
    ${!q && groups.length > ui.histLimit ? `<div style="text-align:center;margin-top:18px"><button class="btn" data-act="hist-more">Show older weeks</button></div>` : ''}`;
}

function sessionDetail(id) {
  const s = db.sessions.find(x => x.id === id); if (!s) return;
  const d = D(s.date); const st = sessionStats(s);
  const meta = [
    `<span>${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>`,
    s.duration ? `<span>${durText(s.duration)}</span>` : '',
  ].join('');
  const meta2 = [s.bodyweight ? `<span>Bodyweight <b>${kg(s.bodyweight)} kg</b></span>` : ''].join('');
  const items = s.items.map(it => {
    if (it.kind === 'cardio') return `<div class="sd-item"><div class="h">${I.clock.replace('<svg', '<svg width="16" height="16"')}<span>${esc(it.name || 'Conditioning')}</span></div><div class="sd-note">${esc([it.scheme, it.result].filter(Boolean).join(', ')) || 'No details'}</div></div>`;
    const X = exById(it.exerciseId);
    const e1s = it.sets.filter(isHard).map(x => e1rm(x.w, x.r, x.rpe)).filter(Boolean);
    const band = e1s.length ? `e1RM ${nf(Math.min(...e1s), 0)}${e1s.length > 1 ? '–' + nf(Math.max(...e1s), 0) : ''}` : '';
    return `<div class="sd-item"><div class="h">${plate(X.pattern)}<span>${esc(X.name)}${it.group ? '<span class="ss-tag">Superset</span>' : ''}</span><span class="e">${band}</span></div>
      <div class="sd-sets">${it.sets.map(x => `<span class="${x.type === 'warm' ? 'w' : ''}">${x.type === 'warm' ? 'W ' : x.type === 'drop' ? 'D ' : ''}${x.w ? kg(x.w) : 'BW'} × ${x.r ?? '–'}${x.rpe != null ? ' @ ' + nf(x.rpe) : ''}</span>`).join('')}</div>
      ${it.note ? `<div class="sd-note">${esc(it.note)}</div>` : ''}</div>`;
  }).join('');
  openSheet(esc(sessionTitle(s)), `
    <div class="meta-line">${meta}</div>${meta2 ? `<div class="meta-line">${meta2}</div>` : ''}
    <div class="sum-grid" style="grid-template-columns:repeat(3,1fr)"><div><div class="v num">${st.sets}</div><div class="l">Hard sets</div></div><div><div class="v num">${st.reps}</div><div class="l">Reps</div></div><div><div class="v num">${nf(st.tonnage / 1000, 1)} t</div><div class="l">Tonnage</div></div></div>
    ${items}
    ${s.notes ? `<p style="margin:16px 0 0">${esc(s.notes)}</p>` : ''}
    <div class="row wrap" style="margin-top:20px"><button class="btn primary" data-act="sess-edit" data-id="${s.id}">${I.edit}Edit</button><button class="btn" data-act="sess-repeat" data-id="${s.id}">${I.copy}Repeat workout</button><span class="spacer"></span><button class="btn ghost danger" data-act="sess-del" data-id="${s.id}">${I.trash}Delete</button></div>`);
}

/* =========================================================
   WORKOUT LOGGER
   ========================================================= */
function newSession(extra = {}) {
  return { id: uid(), date: localISO(new Date()), title: '', notes: '', bodyweight: null, duration: null, programRef: null, items: [], startedAt: Date.now(), mode: 'live', ...extra };
}
function guardActive() {
  if (db.active) { toast(db.active.mode === 'edit' ? 'Finish editing that workout first' : 'You have a workout in progress'); openWorkout(); return true; }
  return false;
}
function liftItem(exId, n = 3, extra = {}) {
  const st = derived().ex[exId]; const cnt = st?.last ? Math.max(1, st.last.sets.filter(s => s.type !== 'warm').length) : n;
  return { id: uid(), kind: 'lift', exerciseId: exId, note: '', group: null, sets: [...Array(cnt)].map(() => ({ w: null, r: null, rpe: null, type: 'work', done: false })), ...extra };
}
function startFromProgram(progId, w, d) {
  if (guardActive()) return;
  const prog = progById(progId); const day = prog?.weeks[w]?.days[d]; if (!day) return;
  const s = newSession({ programRef: { programId: progId, week: w, day: d } });
  s.items = day.items.map(it => ({ id: uid(), kind: 'lift', exerciseId: it.exerciseId, note: '', target: it.note || '', group: it.group || null, sets: it.sets.map(x => ({ w: null, r: null, rpe: null, type: 'work', done: false, tr: x.r, trpe: x.rpe })) }));
  db.active = s; saveActive(true); closeAllSheets(); openWorkout();
}
function startEmpty(past) {
  if (guardActive()) return;
  const extra = {};
  if (past) { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(18, 0, 0, 0); Object.assign(extra, { mode: 'past', date: localISO(d), startedAt: null }); }
  db.active = newSession(extra); saveActive(true); openWorkout();
  if (!past) setTimeout(() => openPicker('Add exercise', addExerciseToActive), 120);
}
function repeatSession(id) {
  if (guardActive()) return;
  const src = db.sessions.find(s => s.id === id); if (!src) return;
  const s = newSession({ title: src.title || '' });
  s.items = src.items.map(it => it.kind === 'lift'
    ? { id: uid(), kind: 'lift', exerciseId: it.exerciseId, note: '', group: it.group, sets: it.sets.map(x => ({ w: null, r: null, rpe: null, type: x.type || 'work', done: false })) }
    : { id: uid(), kind: 'cardio', name: it.name, scheme: it.scheme, result: '' });
  db.active = s; saveActive(true); closeAllSheets(); openWorkout();
}
function editSession(id) {
  if (guardActive()) return;
  const src = db.sessions.find(s => s.id === id); if (!src) return;
  db.active = { ...clone(src), mode: 'edit' }; saveActive(true); closeAllSheets(); openWorkout();
}
const findItem = (id) => db.active?.items.find(i => i.id === id);

/* placeholders: program target first, then last time */
function placeholder(it, i) {
  const s = it.sets[i]; const st = derived().ex[it.exerciseId];
  const prevSets = st?.last ? st.last.sets.filter(x => x.type !== 'warm') : [];
  const workIdx = it.sets.slice(0, i).filter(x => x.type !== 'warm').length;
  const prev = s.type === 'warm' ? null : (prevSets[workIdx] || prevSets[prevSets.length - 1] || null);
  if (s.tr != null) return { w: suggestLoad(it.exerciseId, s.tr, s.trpe) ?? prev?.w ?? null, r: s.tr, rpe: s.trpe ?? null };
  return prev ? { w: prev.w, r: prev.r, rpe: prev.rpe } : { w: null, r: null, rpe: null };
}

function normalizeGroups(items) {
  const seen = {};
  items.forEach((it, i) => {
    if (!it.group) return;
    const g = it.group;
    if (seen[g] == null) { seen[g] = i; return; }
    if (items[i - 1]?.group !== g) it.group = null; // not contiguous: drop from group
  });
  const counts = {}; items.forEach(it => { if (it.group) counts[it.group] = (counts[it.group] || 0) + 1; });
  items.forEach(it => { if (it.group && counts[it.group] < 2) it.group = null; });
}

function openWorkout() {
  closeAllSheets();
  let ov = $('#wo');
  if (!ov) { ov = document.createElement('div'); ov.id = 'wo'; ov.className = 'overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Workout'); document.body.append(ov); }
  document.body.style.overflow = 'hidden'; ensureGuard();
  renderWorkout(); startClock(); renderResume();
}
function minimizeWorkout() { $('#wo')?.remove(); document.body.style.overflow = ''; renderResume(); }

function renderWorkout() {
  const a = db.active; const ov = $('#wo'); if (!a || !ov) return;
  const body = $('.ov-body', ov); const st = body ? body.scrollTop : 0;
  const live = a.mode === 'live';
  const titlePh = a.programRef ? (programDay(a.programRef)?.name || 'Workout') : a.mode === 'edit' ? sessionTitle(a) : 'Workout';
  let html = ''; let i = 0; let letter = 0;
  while (i < a.items.length) {
    const it = a.items[i];
    if (it.group && a.items[i + 1]?.group === it.group) {
      const grp = []; while (i < a.items.length && a.items[i].group === it.group) grp.push(a.items[i++]);
      html += `<div class="ss-wrap"><div class="ss-label"><i></i>Superset ${String.fromCharCode(65 + letter++)}</div>${grp.map(itemCard).join('')}</div>`;
    } else { html += itemCard(it); i++; }
  }
  const ci = a.bodyweight != null;
  ov.innerHTML = `
    <div class="ov-head">
      ${live ? `<button class="icon-btn" data-act="wo-min" aria-label="Minimise workout">${I.min}</button>` : `<button class="icon-btn" data-act="wo-discard" aria-label="Cancel">${I.x}</button>`}
      <div class="title"><input data-sf="title" value="${esc(a.title)}" placeholder="${esc(titlePh)}" aria-label="Workout name">
        <div class="clock">${live ? `<span id="wo-clock">${clock(Date.now() - a.startedAt)}</span>` : a.mode === 'edit' ? 'Editing workout' : 'Logging a past workout'}</div></div>
      <button class="btn primary sm" data-act="wo-finish">${live ? 'Finish' : 'Save'}</button>
    </div>
    <div class="ov-body"><div class="ov-inner">
      ${!live ? `<div class="field"><label for="wo-date">Date and time</label><input id="wo-date" class="input" type="datetime-local" data-sf="date" value="${esc(a.date)}"></div>` : ''}
      <details class="checkin" ${ci ? 'open' : ''}><summary>Bodyweight<span class="muted small">Optional</span></summary>
        <div class="grid" style="grid-template-columns:1fr">
          <div class="field" style="margin:0"><label for="ci-b" class="hide">Bodyweight</label><input id="ci-b" class="input" inputmode="decimal" data-sf="bodyweight" value="${a.bodyweight != null ? nf(a.bodyweight) : ''}" placeholder="kg"></div>
        </div></details>
      ${html || `<div class="empty" style="margin-bottom:14px">Add your first exercise to start logging sets.</div>`}
      <div class="wo-actions"><button class="btn" data-act="add-ex">${I.plus}Add exercise</button><button class="btn" data-act="add-cardio">${I.clock}Add conditioning</button></div>
      <div class="field"><label for="wo-notes">Workout notes</label><textarea id="wo-notes" class="input" data-sf="notes" placeholder="How did it feel? Anything to remember next time?">${esc(a.notes)}</textarea></div>
      <div style="text-align:center"><button class="btn ghost danger" data-act="wo-discard">${a.mode === 'edit' ? 'Discard changes' : 'Discard workout'}</button></div>
    </div></div>`;
  $('.ov-body', ov).scrollTop = st;
}

function itemCard(it) {
  if (it.kind === 'cardio') {
    return `<div class="xc cardio" style="--pc:var(--ink)" data-item="${it.id}">
      <div class="xc-head"><div class="nm"><button tabindex="-1">Conditioning</button></div><button class="icon-btn" data-act="item-menu" data-item="${it.id}" aria-label="Options">${I.kebab}</button></div>
      <div class="grid">
        <div class="field" style="grid-column:1/-1;margin:0"><label>Activity</label><input class="input" data-cf="name" data-item="${it.id}" value="${esc(it.name)}" placeholder="Assault bike, sled, swim…"></div>
        <div class="field" style="margin:0"><label>Scheme</label><input class="input" data-cf="scheme" data-item="${it.id}" value="${esc(it.scheme)}" placeholder="Tabata, 25 min, EMOM 10"></div>
        <div class="field" style="margin:0"><label>Result</label><input class="input" data-cf="result" data-item="${it.id}" value="${esc(it.result)}" placeholder="60 kcal, 2,5 km"></div>
      </div><div style="height:8px"></div></div>`;
  }
  const X = exById(it.exerciseId); const st = derived().ex[it.exerciseId];
  const meta = [];
  const tgt = it.sets.filter(s => s.tr != null);
  if (tgt.length) {
    const loads = it.sets.map(s => s.tr != null ? suggestLoad(it.exerciseId, s.tr, s.trpe) : null).filter(Boolean);
    meta.push(`<span>Target <b>${esc(rxStr(tgt.map(s => ({ r: s.tr, rpe: s.trpe }))))}</b>${loads.length ? `, about <b>${[...new Set(loads)].map(kg).join('/')} kg</b>` : ''}${it.target ? ` (${esc(it.target)})` : ''}</span>`);
  }
  if (st?.last && db.active.mode !== 'edit') meta.push(`<span>Last time <b>${esc(setStr(st.last.sets))}</b>, ${fmtDate(D(st.last.date), { day: 'numeric', month: 'short' })}</span>`);
  if (st?.best) meta.push(`<span>Best e1RM <b>${kg(st.best.v)} kg</b></span>`);
  let wn = 0;
  const rows = it.sets.map((s, i) => {
    const ph = placeholder(it, i);
    const label = s.type === 'warm' ? 'W' : s.type === 'drop' ? 'D' : String(++wn);
    const e = e1rm(s.w, s.r, s.rpe);
    return `<div class="set-line ${s.done ? 'done' : ''}">
      <button class="sn ${s.type === 'warm' ? 'w' : s.type === 'drop' ? 'd' : ''}" data-act="set-menu" data-item="${it.id}" data-set="${i}" aria-label="Set ${i + 1} options">${label}</button>
      <input inputmode="decimal" enterkeyhint="next" data-f="w" data-item="${it.id}" data-set="${i}" value="${s.w != null ? nf(s.w, 2) : ''}" placeholder="${ph.w != null ? nf(ph.w, 2) : (X.bw ? 'BW' : '')}" aria-label="Set ${i + 1} weight in kg">
      <input inputmode="numeric" enterkeyhint="next" data-f="r" data-item="${it.id}" data-set="${i}" value="${s.r ?? ''}" placeholder="${ph.r ?? ''}" aria-label="Set ${i + 1} reps">
      <input inputmode="decimal" enterkeyhint="done" data-f="rpe" data-item="${it.id}" data-set="${i}" value="${s.rpe != null ? nf(s.rpe) : ''}" placeholder="${ph.rpe != null ? nf(ph.rpe) : ''}" aria-label="Set ${i + 1} RPE">
      <div class="e1 ${s.pr ? 'pr' : ''}" id="e1-${it.id}-${i}">${e ? nf(e, 0) : ''}</div>
      <button class="ok" data-act="set-done" data-item="${it.id}" data-set="${i}" aria-pressed="${!!s.done}" aria-label="Mark set ${i + 1} done">${I.check}</button>
    </div>`;
  }).join('');
  return `<div class="xc" style="--pc:${patVar(X.pattern)}" data-item="${it.id}">
    <div class="xc-head"><div class="nm"><button data-act="ex-detail" data-id="${it.exerciseId}">${esc(X.name)}</button></div><button class="icon-btn" data-act="item-menu" data-item="${it.id}" aria-label="Options for ${esc(X.name)}">${I.kebab}</button></div>
    ${meta.length ? `<div class="xc-meta">${meta.join('')}</div>` : ''}
    <div class="sets"><div class="hd">Set</div><div class="hd">kg</div><div class="hd">Reps</div><div class="hd">RPE</div><div class="hd">e1RM</div><div class="hd"></div>${rows}</div>
    <button class="add-set" data-act="add-set" data-item="${it.id}">+ Add set</button>
    <textarea class="xc-note" rows="1" placeholder="Note: tempo, belt, cues, how it felt" data-f="note" data-item="${it.id}">${esc(it.note)}</textarea>
  </div>`;
}
function rerenderCard(itemId) {
  const card = $(`#wo .xc[data-item="${itemId}"]`); if (!card) return renderWorkout();
  const it = findItem(itemId); const tmp = document.createElement('div'); tmp.innerHTML = itemCard(it); card.replaceWith(tmp.firstElementChild);
}

function toggleSet(itemId, idx) {
  const it = findItem(itemId); const s = it?.sets[idx]; if (!s) return;
  if (s.done) { s.done = false; s.pr = false; saveActive(true); rerenderCard(itemId); return; }
  const ph = placeholder(it, idx); const X = exById(it.exerciseId);
  if (s.w == null) s.w = ph.w ?? (X.bw ? 0 : null);
  if (s.r == null) s.r = ph.r;
  if (s.rpe == null && ph.rpe != null) s.rpe = ph.rpe;
  if (s.r == null) { toast('Enter the reps for this set first'); const inp = $(`#wo input[data-f="r"][data-item="${itemId}"][data-set="${idx}"]`); inp && inp.focus(); return; }
  if (s.w == null) s.w = 0;
  s.done = true;
  // PR check against history
  const st = derived().ex[it.exerciseId]; const e = e1rm(s.w, s.r, s.rpe);
  const sessionBest = Math.max(0, ...db.active.items.filter(x => x.exerciseId === it.exerciseId).flatMap(x => x.sets).filter(x => x !== s && x.done).map(x => e1rm(x.w, x.r, x.rpe) || 0));
  if (db.active.mode !== 'edit' && e && st?.best && e > st.best.v && e > sessionBest) { s.pr = true; toast(`New e1RM record: ${kg(e)} kg (was ${kg(st.best.v)})`, 'pr'); }
  else if (db.active.mode !== 'edit' && s.type !== 'warm' && s.w > 0 && st?.repMax[s.r] && s.w > st.repMax[s.r].w) { s.pr = true; toast(`Rep record: ${kg(s.w)} kg × ${s.r}`, 'pr'); }
  saveActive(true); rerenderCard(itemId);
  if (db.active.mode === 'live' && s.type !== 'warm') {
    if (it.group) {
      const members = db.active.items.filter(x => x.group === it.group); const pos = members.indexOf(it);
      if (pos < members.length - 1) { toast(`Next: ${exName(members[pos + 1].exerciseId)}`); return; }
    }
    startRest(db.settings.rest);
  }
}
function addExerciseToActive(exId) {
  db.active.items.push(liftItem(exId)); saveActive(true); renderWorkout();
  const last = $$('#wo .xc'); last[last.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function itemMenu(itemId) {
  const a = db.active; const idx = a.items.findIndex(i => i.id === itemId); const it = a.items[idx];
  const next = a.items[idx + 1];
  menuCtx = { type: 'item', itemId };
  const isLift = it.kind === 'lift';
  menuSheet(isLift ? esc(exName(it.exerciseId)) : 'Conditioning', [
    idx > 0 && { k: 'up', label: 'Move up', icon: I.up },
    idx < a.items.length - 1 && { k: 'down', label: 'Move down', icon: I.dn },
    isLift && next && next.kind === 'lift' && next.group !== it.group && { k: 'ss', label: `Superset with ${esc(exShort(next.exerciseId))}`, icon: I.link },
    isLift && it.group && { k: 'unss', label: 'Remove from superset', icon: I.unlink },
    isLift && { k: 'replace', label: 'Replace exercise', icon: I.swap },
    isLift && { k: 'detail', label: 'Exercise history', icon: I.progress },
    isLift && { k: 'plates', label: 'Plate calculator', icon: I.plates },
    { k: 'remove', label: 'Remove', icon: I.trash, danger: true },
  ]);
}
function itemMenuPick(k) {
  const a = db.active; const idx = a.items.findIndex(i => i.id === menuCtx.itemId); const it = a.items[idx]; if (!it) return;
  closeSheet();
  if (k === 'up' || k === 'down') { const j = k === 'up' ? idx - 1 : idx + 1; [a.items[idx], a.items[j]] = [a.items[j], a.items[idx]]; normalizeGroups(a.items); }
  else if (k === 'ss') { const nx = a.items[idx + 1]; const g = it.group || 'g' + uid(); it.group = g; if (nx.group && nx.group !== g) { const old = nx.group; a.items.forEach(x => { if (x.group === old) x.group = g; }); } else nx.group = g; normalizeGroups(a.items); }
  else if (k === 'unss') { const g = it.group; it.group = null; const pos = idx; // move out to the end of the group
    let end = pos; while (a.items[end + 1]?.group === g) end++; if (end > pos) { a.items.splice(pos, 1); a.items.splice(end, 0, it); } normalizeGroups(a.items); }
  else if (k === 'replace') { openPicker('Replace exercise', (id) => { it.exerciseId = id; saveActive(true); renderWorkout(); }); return; }
  else if (k === 'detail') { exerciseDetail(it.exerciseId); return; }
  else if (k === 'plates') { const s = it.sets.find(x => !x.done) || it.sets[it.sets.length - 1]; const ph = s ? placeholder(it, it.sets.indexOf(s)) : {}; plateCalc(s?.w ?? ph.w ?? 100); return; }
  else if (k === 'remove') { a.items.splice(idx, 1); normalizeGroups(a.items); }
  saveActive(true); renderWorkout();
}
function setMenu(itemId, idx) {
  menuCtx = { type: 'set', itemId, idx };
  const s = findItem(itemId).sets[idx];
  menuSheet(`Set ${idx + 1}`, [
    s.type !== 'work' && { k: 'work', label: 'Working set', icon: I.flag },
    s.type !== 'warm' && { k: 'warm', label: 'Warm-up set (not counted in volume)', icon: I.warm },
    s.type !== 'drop' && { k: 'drop', label: 'Drop set', icon: I.drop },
    { k: 'dup', label: 'Duplicate set', icon: I.copy },
    { k: 'del', label: 'Delete set', icon: I.trash, danger: true },
  ]);
}
function setMenuPick(k) {
  const it = findItem(menuCtx.itemId); const i = menuCtx.idx; closeSheet(); if (!it) return;
  if (k === 'del') it.sets.splice(i, 1);
  else if (k === 'dup') it.sets.splice(i + 1, 0, { ...it.sets[i], done: false, pr: false });
  else it.sets[i].type = k;
  saveActive(true); rerenderCard(it.id);
}
let menuCtx = null;

function finishWorkout() {
  const a = db.active;
  const pending = a.items.filter(i => i.kind === 'lift').flatMap(i => i.sets).filter(s => !s.done && s.w != null && s.r != null).length;
  const cleaned = cleanSession(a);
  if (!cleaned.items.length) { toast('Log at least one set before saving'); return; }
  const st = sessionStats(cleaned);
  const prs = a.items.flatMap(it => it.kind === 'lift' ? it.sets.filter(s => s.pr && s.done).map(s => ({ it, s })) : []);
  const mins = a.mode === 'live' ? Math.round((Date.now() - a.startedAt) / 60000) : null;
  const pats = PAT_ORDER.filter(p => st.byPat[p]);
  openSheet(a.mode === 'live' ? 'Nice work' : 'Save workout', `
    <div class="sum-grid">
      ${mins != null ? `<div><div class="v">${durText(mins) || '0 min'}</div><div class="l">Duration</div></div>` : ''}
      <div><div class="v">${st.sets}</div><div class="l">Hard sets</div></div>
      <div><div class="v">${st.reps}</div><div class="l">Reps</div></div>
      <div><div class="v">${nf(st.tonnage / 1000, 2)} t</div><div class="l">Tonnage</div></div>
    </div>
    ${prs.length ? `<div class="pr-list">${prs.map(({ it, s }) => `<div class="pr-item">${I.flag.replace('<svg', '<svg width="18" height="18"')}${esc(exShort(it.exerciseId))}: ${kg(s.w)} kg × ${s.r}${s.rpe != null ? ' @ ' + nf(s.rpe) : ''}${e1rm(s.w, s.r, s.rpe) ? `, e1RM ${kg(e1rm(s.w, s.r, s.rpe))}` : ''}</div>`).join('')}</div>` : ''}
    ${pats.length ? `<div class="plan-sum" style="margin-bottom:18px">${pats.map(p => `<span>${plate(p)}${PATTERNS[p].name} ${st.byPat[p]}</span>`).join('')}</div>` : ''}
    ${pending ? `<p class="small muted">${pending} filled-in set${pending > 1 ? 's were' : ' was'} not ticked off and will be saved as done. Empty sets are dropped.</p>` : `<p class="small muted">Empty sets are dropped when saving.</p>`}
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-act="sheet-close">Keep logging</button><button class="btn primary" data-act="wo-commit">Save workout</button></div>`);
}
function cleanSession(a) {
  const s = clone(a);
  s.items = s.items.map(it => {
    if (it.kind === 'cardio') return (it.name || it.scheme || it.result) ? { id: it.id, kind: 'cardio', name: it.name, scheme: it.scheme, result: it.result } : null;
    const sets = it.sets.filter(x => x.done || (x.w != null && x.r != null)).map(x => ({ w: x.w ?? 0, r: x.r, rpe: x.rpe ?? null, type: x.type || 'work', done: true }));
    return sets.length ? { id: it.id, kind: 'lift', exerciseId: it.exerciseId, note: it.note || '', group: it.group || null, sets } : null;
  }).filter(Boolean);
  normalizeGroups(s.items);
  return s;
}
function commitWorkout() {
  const a = db.active; const s = cleanSession(a);
  if (a.mode === 'live') s.duration = Math.max(1, Math.round((Date.now() - a.startedAt) / 60000));
  const mode = a.mode; delete s.startedAt; delete s.mode;
  if (mode === 'edit') { const i = db.sessions.findIndex(x => x.id === s.id); if (i >= 0) db.sessions[i] = s; else db.sessions.push(s); }
  else db.sessions.push(s);
  db.sessions.sort((x, y) => y.date.localeCompare(x.date));
  if (mode !== 'edit' && s.programRef && s.programRef.programId === db.settings.activeProgramId) {
    const p = progById(s.programRef.programId); if (p) db.settings.pos = advancePos(p, { week: s.programRef.week, day: s.programRef.day });
  }
  db.active = null; stopRest(); closeAllSheets(); minimizeWorkout();
  saveNow().then(() => toast(mode === 'edit' ? 'Changes saved' : 'Workout saved on this phone'));
  rerender();
}
function discardWorkout() {
  const edit = db.active.mode === 'edit';
  confirmSheet(edit ? 'Discard changes?' : 'Discard this workout?', edit ? 'The saved version of this workout stays as it was.' : 'Everything logged in this session will be removed.', edit ? 'Discard changes' : 'Discard', () => {
    db.active = null; saveNow(); stopRest(); closeAllSheets(); minimizeWorkout(); rerender();
  });
}

/* ---------- clock, resume bar ---------- */
let clockT = null;
function startClock() { if (clockT) return; clockT = setInterval(() => { const a = db.active; if (!a) { clearInterval(clockT); clockT = null; return; } const t = a.startedAt ? clock(Date.now() - a.startedAt) : ''; const c = $('#wo-clock'); if (c) c.textContent = t; const r = $('#resume-t'); if (r) r.textContent = t; }, 1000); }
function renderResume() {
  $('#resume')?.remove();
  const a = db.active; if (!a || $('#wo')) return;
  const b = document.createElement('button'); b.id = 'resume'; b.className = 'resume'; b.dataset.act = 'resume';
  const sets = a.items.filter(i => i.kind === 'lift').flatMap(i => i.sets); const done = sets.filter(s => s.done).length;
  b.innerHTML = `<div><div class="t">${a.mode === 'edit' ? 'Editing a workout' : 'Workout in progress'}</div><div class="s">${a.startedAt ? `<span id="resume-t">${clock(Date.now() - a.startedAt)}</span>, ` : ''}${done} of ${sets.length} sets done</div></div><span class="go">Resume</span>`;
  document.body.append(b); startClock();
}

/* ---------- rest timer ---------- */
const rest = { end: 0, dur: 0, t: null, hideT: null };
function startRest(sec) {
  clearTimeout(rest.hideT); rest.dur = sec; rest.end = Date.now() + sec * 1000;
  let el = $('#rest');
  if (!el) { el = document.createElement('div'); el.id = 'rest'; el.className = 'rest'; el.setAttribute('role', 'timer'); document.body.append(el); }
  el.classList.remove('over');
  el.innerHTML = `<span class="t" id="rest-t">${clock(sec * 1000)}</span><span class="lbl">Rest</span><button data-act="rest-sub" aria-label="Remove 15 seconds">−15</button><button data-act="rest-add" aria-label="Add 15 seconds">+15</button><button data-act="rest-skip" aria-label="Skip rest">Skip</button><span class="prog"><i id="rest-p"></i></span>`;
  clearInterval(rest.t); rest.t = setInterval(tickRest, 250); tickRest();
}
function tickRest() {
  const left = rest.end - Date.now(); const t = $('#rest-t'); const p = $('#rest-p');
  if (left <= 0) {
    clearInterval(rest.t); rest.t = null;
    const el = $('#rest'); if (el) { el.classList.add('over'); el.innerHTML = `<span class="t">Go</span><span class="lbl">Rest is over</span><button data-act="rest-skip">Close</button>`; }
    try { navigator.vibrate && navigator.vibrate([180, 90, 180]); } catch (e) { }
    beep(); rest.hideT = setTimeout(stopRest, 6000); return;
  }
  if (t) t.textContent = clock(left + 999);
  if (p) p.style.transform = `scaleX(${Math.max(0, left / (rest.dur * 1000))})`;
}
function stopRest() { clearInterval(rest.t); rest.t = null; clearTimeout(rest.hideT); $('#rest')?.remove(); }
let audioCtx;
function beep() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5); o.start(); o.stop(audioCtx.currentTime + 0.55); } catch (e) { }
}

/* ---------- exercise picker ---------- */
let pickCb = null;
function openPicker(title, cb) { pickCb = cb; ui.pickQ = ''; ui.pickPat = null; openSheet(title, pickerBody()); }
function pickerBody() {
  return `<input class="input" type="search" placeholder="Search exercises" data-pick="q" value="${esc(ui.pickQ)}" autofocus aria-label="Search exercises">
    <div class="chips" style="margin-top:10px">${[null, ...PAT_ORDER].map(p => `<button class="chip" data-act="pick-pat" data-p="${p || ''}" aria-pressed="${ui.pickPat === p}">${p ? plate(p) : ''}${p ? PATTERNS[p].name : 'All'}</button>`).join('')}</div>
    <div id="pick-list">${pickerList()}</div>`;
}
function pickerList() {
  const q = ui.pickQ.trim().toLowerCase(); const dx = derived().ex;
  let list = db.exercises.filter(e => (!ui.pickPat || e.pattern === ui.pickPat) && (!q || e.name.toLowerCase().includes(q) || (SHORT[e.id] || '').toLowerCase().includes(q)));
  const btn = (e) => { const st = dx[e.id]; return `<button data-act="pick" data-id="${e.id}">${plate(e.pattern, true)}<span style="flex:1;min-width:0"><span style="display:block">${esc(e.name)}</span><span class="sub">${[cap((e.primary || []).join(', ')), st ? `${st.count}× logged` : null].filter(Boolean).join('. ')}</span></span></button>`; };
  let html = '';
  if (!q && !ui.pickPat) {
    const recent = Object.values(dx).filter(s => s.last).sort((a, b) => b.last.date.localeCompare(a.last.date)).slice(0, 8).map(s => exById(s.id));
    if (recent.length) html += `<div class="pick-h">Recently used</div><div class="pick-list">${recent.map(btn).join('')}</div><div class="pick-h">All exercises</div>`;
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  html += `<div class="pick-list">${list.map(btn).join('')}</div>`;
  if (q && !db.exercises.some(e => e.name.toLowerCase() === q)) html += `<div style="margin-top:12px"><button class="btn block" data-act="pick-create">${I.plus}Create “${esc(ui.pickQ.trim())}”</button></div>`;
  else if (!list.length) html += `<div class="empty">Nothing here yet.</div>`;
  return html;
}

/* ---------- exercise form ---------- */
let exForm = null, exFormCb = null;
function exerciseForm(ex, cb) {
  exForm = ex ? clone(ex) : { id: null, name: ui.pickQ.trim(), pattern: ui.pickPat || 'OT', primary: [], secondary: [], bw: false, custom: true };
  exFormCb = cb; openSheet(ex ? 'Edit exercise' : 'New exercise', exFormBody());
}
function exFormBody() {
  const f = exForm;
  const mchips = (kind) => `<div class="chips mchips">${MUSCLES.map(m => `<button class="chip" data-act="exf-m" data-kind="${kind}" data-m="${m}" aria-pressed="${f[kind].includes(m)}">${cap(m)}</button>`).join('')}</div>`;
  return `<div class="field"><label for="exf-n">Name</label><input id="exf-n" class="input" data-exf="name" value="${esc(f.name)}" autofocus></div>
    <div class="field"><span class="lbl">Movement pattern</span><div class="chips">${PAT_ORDER.map(p => `<button class="chip" data-act="exf-p" data-p="${p}" aria-pressed="${f.pattern === p}">${plate(p)}${PATTERNS[p].name}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">Primary muscles (count as 1 set)</span>${mchips('primary')}</div>
    <div class="field"><span class="lbl">Secondary muscles (count as half a set)</span>${mchips('secondary')}</div>
    <label class="row" style="margin:6px 0 18px"><input type="checkbox" data-exf="bw" ${f.bw ? 'checked' : ''}> Bodyweight exercise (no e1RM)</label>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="exf-save">Save exercise</button></div>`;
}
function saveExForm() {
  const f = exForm; if (!f.name.trim()) { toast('Give the exercise a name'); return; }
  f.name = cap(f.name.trim());
  if (!f.id) { let base = f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercise'; let id = base, n = 2; while (db.exercises.some(e => e.id === id)) id = base + '-' + n++; f.id = id; db.exercises.push(f); }
  else { const i = db.exercises.findIndex(e => e.id === f.id); db.exercises[i] = f; }
  save(); closeSheet(); const cb = exFormCb; exFormCb = null; cb && cb(f.id);
}

/* =========================================================
   PROGRESS
   ========================================================= */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function baseOpts(extra = {}) {
  return {
    responsive: true, maintainAspectRatio: false, animation: reduceMotion ? false : { duration: 350 },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: cssVar('--primary'), titleColor: cssVar('--on-primary'), bodyColor: cssVar('--on-primary'), padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4, ...(extra.tooltip || {}) } },
    scales: {
      x: { grid: { display: false }, border: { color: cssVar('--line-2') }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7, color: cssVar('--muted') }, stacked: !!extra.stacked },
      y: { grid: { color: cssVar('--line') }, border: { display: false }, ticks: { color: cssVar('--muted'), maxTicksLimit: 6, callback: (v) => nf(v, 0) }, stacked: !!extra.stacked, beginAtZero: !!extra.zero }
    }
  };
}
function e1Chart(canvas, periods, series, color) {
  const n = periods.length;
  const pick = (k) => series.map(s => s ? Math.round(s[k] * 10) / 10 : null);
  return new Chart(canvas, {
    type: 'line',
    data: { labels: periods.map(p => p.label), datasets: [
      { label: 'Highest', data: pick('max'), borderColor: 'transparent', pointRadius: 0, pointHoverRadius: 0, spanGaps: true, fill: false, tension: .25 },
      { label: 'Lowest', data: pick('min'), borderColor: 'transparent', pointRadius: 0, pointHoverRadius: 0, spanGaps: true, fill: '-1', backgroundColor: alpha(color, .2), tension: .25 },
      { label: 'Average', data: pick('avg'), borderColor: color, backgroundColor: color, borderWidth: 2.5, pointRadius: n > 40 ? 0 : 3, pointHoverRadius: 5, spanGaps: true, tension: .25 }
    ] },
    options: baseOpts({ tooltip: { callbacks: { label: (c) => c.raw == null ? null : ` ${c.dataset.label}: ${nf(c.raw, 1)} kg` }, filter: (c) => c.raw != null } })
  });
}
function renderProgress() {
  const periods = periodsBetween(rangeStart(ui.range), new Date(), ui.gran);
  const startD = periods[0]?.start || new Date();
  const flatR = derived().flat.filter(f => f.d >= startD);
  // e1RM candidates in range
  const cnt = {}; flatR.forEach(f => { if (f.e1) cnt[f.ex] = (cnt[f.ex] || 0) + 1; });
  const cands = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  if (!ui.prEx || !cnt[ui.prEx]) ui.prEx = cands[0] || null;
  const top = cands.slice(0, 6); if (ui.prEx && !top.includes(ui.prEx)) top.push(ui.prEx);
  let e1html = `<div class="empty">No sets with RPE in this period. Log weight, reps and RPE to see estimated 1RM.</div>`;
  let series = null;
  if (ui.prEx) {
    series = e1Series(ui.prEx, periods, ui.gran);
    const nn = series.map((s, i) => s ? i : -1).filter(i => i >= 0);
    const last = series[nn[nn.length - 1]], first = series[nn[0]];
    const d = last && first ? last.avg - first.avg : 0; const st = derived().ex[ui.prEx];
    const bestR = flatR.filter(f => f.ex === ui.prEx && f.e1).reduce((b, f) => !b || f.e1 > b.e1 ? f : b, null);
    e1html = `<div class="row wrap" style="align-items:flex-end">
        <div><div class="big-stat"><span class="v">${nf(last?.avg, 0)}</span><span class="u">kg</span>${nn.length > 1 ? `<span class="delta ${d > 0.5 ? 'up' : d < -0.5 ? 'down' : ''}">${d >= 0 ? '+' : '−'}${nf(Math.abs(d), 1)} kg</span>` : ''}</div>
        <div class="small muted">Average e1RM in the latest ${ui.gran}, ${nn.length > 1 ? 'change since the start of this range' : 'one data point in range'}</div></div>
        <span class="spacer"></span>
        ${bestR ? `<div class="small" style="text-align:right"><div class="muted">Best in range</div><b>${kg(bestR.e1)} kg</b> from ${kg(bestR.w)} × ${bestR.r} @ ${nf(bestR.rpe)}<br><span class="muted">${fmtDateY(bestR.d)}${st?.best ? `. All-time ${kg(st.best.v)} kg` : ''}</span></div>` : ''}
      </div>
      <div class="chart-box"><canvas id="c-e1" aria-label="Estimated 1RM chart"></canvas></div>
      <div class="legend"><span><i class="plate" style="--c:${patVar(exById(ui.prEx).pattern)}"></i>Average</span><span><i style="display:inline-block;width:18px;height:10px;border-radius:3px;background:${alpha(patColor(exById(ui.prEx).pattern), .25)}"></i>Range between lowest and highest set</span></div>`;
  }
  const muscleMode = ui.by === 'muscle';
  view().innerHTML = `
    <div class="page-head"><div><h1>Progress</h1><div class="sub">${periods.length} ${ui.gran}s, ${new Set(flatR.map(f => f.sid)).size} workouts</div></div></div>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Time range">${[['4w', '4 weeks'], ['12w', '12 weeks'], ['6m', '6 months'], ['1y', '1 year'], ['all', 'All']].map(([k, l]) => `<button data-act="pr-range" data-v="${k}" aria-pressed="${ui.range === k}">${l}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Granularity">${[['week', 'Weekly'], ['month', 'Monthly']].map(([k, l]) => `<button data-act="pr-gran" data-v="${k}" aria-pressed="${ui.gran === k}">${l}</button>`).join('')}</div>
    </div>
    <section class="block panel">
      <div class="block-head e1-head"><h2>Estimated 1RM</h2>${cands.length > 6 ? `<select class="input" style="width:auto;min-height:36px;padding:6px 10px" data-act-change="pr-ex" aria-label="Choose exercise">${cands.map(id => `<option value="${id}" ${id === ui.prEx ? 'selected' : ''}>${esc(exName(id))}</option>`).join('')}</select>` : ''}</div>
      <div class="chips" style="margin-bottom:14px">${top.map(id => `<button class="chip" data-act="pr-ex" data-id="${id}" aria-pressed="${id === ui.prEx}">${plate(exById(id).pattern)}${esc(exShort(id))}</button>`).join('')}</div>
      ${e1html}
    </section>
    <section class="block panel">
      <div class="block-head"><h2>Volume</h2></div>
      <div class="toolbar" style="margin-bottom:6px">
        <div class="seg" role="group" aria-label="Group by">${[['pattern', 'Movement'], ['muscle', 'Muscle group']].map(([k, l]) => `<button data-act="pr-by" data-v="${k}" aria-pressed="${ui.by === k}">${l}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Metric">${[['sets', 'Hard sets'], ['reps', 'Reps'], ['tonnage', 'Tonnage']].map(([k, l]) => `<button data-act="pr-metric" data-v="${k}" aria-pressed="${ui.metric === k}">${l}</button>`).join('')}</div>
      </div>
      ${muscleMode ? heatGrid(periods) : `<div class="chart-box"><canvas id="c-vol" aria-label="Volume chart"></canvas></div><div class="legend">${PAT_ORDER.map(p => `<span>${plate(p)}${PATTERNS[p].name}</span>`).join('')}</div>`}
    </section>
    <div>
      <section class="block panel">
        <div class="block-head"><h2>Consistency</h2><span class="small muted">${nf(new Set(flatR.map(f => f.sid)).size / Math.max(1, periods.length), 1)} workouts per ${ui.gran}</span></div>
        <div class="chart-box sm"><canvas id="c-cons" aria-label="Workouts per period"></canvas></div>
      </section>

    </div>
    <section class="block panel">
      <div class="block-head"><h2>Exercises in this range</h2></div>
      <div class="tbl-wrap">${exerciseTable(flatR, periods)}</div>
    </section>`;

  if (ui.prEx && series) charts.push(e1Chart($('#c-e1'), periods, series, patColor(exById(ui.prEx).pattern)));
  if (!muscleMode) {
    const vol = volumeBy(periods, ui.gran, ui.metric, 'pattern');
    charts.push(new Chart($('#c-vol'), { type: 'bar', data: { labels: periods.map(p => p.label), datasets: PAT_ORDER.filter(p => vol[p]).map(p => ({ label: PATTERNS[p].name, data: vol[p].map(v => Math.round(v)), backgroundColor: patColor(p), borderRadius: 2, maxBarThickness: 34 })) }, options: baseOpts({ stacked: true, zero: true, tooltip: { callbacks: { label: (c) => c.raw ? ` ${c.dataset.label}: ${ui.metric === 'tonnage' ? ton(c.raw) : nf(c.raw, 0)}` : null }, filter: (c) => !!c.raw } }) }));
  }
  const cons = periods.map(() => new Set()); const idx = Object.fromEntries(periods.map((p, i) => [p.key, i]));
  flatR.forEach(f => { const i = idx[periodKey(f.d, ui.gran)]; if (i != null) cons[i].add(f.sid); });
  charts.push(new Chart($('#c-cons'), { type: 'bar', data: { labels: periods.map(p => p.label), datasets: [{ label: 'Workouts', data: cons.map(s => s.size), backgroundColor: cssVar('--ink-2'), borderRadius: 3, maxBarThickness: 26 }] }, options: (() => { const o = baseOpts({ zero: true }); o.scales.y.ticks.precision = 0; o.scales.y.ticks.stepSize = 1; return o; })() }));
}
function heatGrid(periods) {
  const cols = periods.slice(-12);
  const vol = volumeBy(cols, ui.gran, ui.metric, 'muscle');
  const wk = ui.gran === 'month' ? 4.35 : 1;
  const allV = MUSCLES.flatMap(m => vol[m] || []).filter(v => v > 0); const mx = Math.max(1, ...allV);
  const lvl = (v) => {
    if (!v) return '';
    if (ui.metric === 'sets') { const w = v / wk; return w < 5 ? 'l1' : w < 10 ? 'l2' : w <= 20 ? 'l3' : 'l4'; }
    const r = v / mx; return r < .25 ? 'l1' : r < .55 ? 'l2' : r < .85 ? 'l3' : 'l4';
  };
  const fmt = (v) => !v ? '' : ui.metric === 'tonnage' ? nf(v / 1000, 1) : nf(v, ui.metric === 'sets' ? 1 : 0);
  return `<div class="heat-wrap"><table class="heat"><thead><tr><th></th>${cols.map(p => `<th>${p.label}</th>`).join('')}</tr></thead><tbody>
    ${MUSCLES.map(m => `<tr><th class="m" scope="row">${cap(m)}</th>${cols.map((p, i) => { const v = vol[m]?.[i] || 0; return `<td class="${lvl(v)}" title="${cap(m)}, ${p.label}: ${fmt(v) || 0}">${fmt(v)}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>
    <div class="scale">${ui.metric === 'sets'
      ? `<span><i style="background:color-mix(in srgb,var(--p-hi) 16%,var(--sunk))"></i>Under 5 a week</span><span><i style="background:color-mix(in srgb,var(--p-hi) 40%,var(--sunk))"></i>5 to 10</span><span><i style="background:var(--p-hi)"></i>10 to 20, the usual growth range</span><span><i style="background:var(--p-sq)"></i>Over 20</span>`
      : `<span>Darker means more ${ui.metric === 'tonnage' ? 'tonnage (in tonnes)' : 'reps'}</span>`}</div>
    <p class="small muted" style="margin:8px 0 0">Primary muscles count a full set, secondary muscles half a set. Warm-ups are left out.${ui.gran === 'month' && ui.metric === 'sets' ? ' Monthly colours use the weekly average.' : ''}</p>`;
}
function exerciseTable(flatR, periods) {
  const by = {};
  flatR.forEach(f => { const b = by[f.ex] || (by[f.ex] = { sets: 0, sids: new Set(), best: 0, ton: 0 }); b.sets++; b.sids.add(f.sid); b.ton += f.w * f.r; if (f.e1 && f.e1 > b.best) b.best = f.e1; });
  const ids = Object.keys(by).sort((a, b) => by[b].sets - by[a].sets);
  if (!ids.length) return `<div class="empty">Nothing logged in this range.</div>`;
  return `<table class="extable"><thead><tr><th>Exercise</th><th class="r">Workouts</th><th class="r">Hard sets</th><th class="r hide-sm">Tonnage</th><th class="r">Best e1RM</th></tr></thead><tbody>
    ${ids.map(id => { const b = by[id]; return `<tr data-act="ex-detail" data-id="${id}" tabindex="0"><td><span class="row" style="gap:8px">${plate(exById(id).pattern)}${esc(exName(id))}</span></td><td class="r">${b.sids.size}</td><td class="r">${b.sets}</td><td class="r hide-sm">${ton(b.ton)}</td><td class="r">${b.best ? kg(b.best) : '–'}</td></tr>`; }).join('')}</tbody></table>`;
}

function exerciseDetail(id) {
  const X = exById(id); const st = derived().ex[id];
  const hist = st ? [...st.history].reverse() : [];
  const periods = st ? periodsBetween(mondayOf(D(st.history[0].date)), new Date(), hist.length > 60 ? 'month' : 'week') : [];
  const gran = hist.length > 60 ? 'month' : 'week';
  const series = st ? e1Series(id, periods, gran) : [];
  const hasE1 = series.some(Boolean);
  const reps = st ? Object.keys(st.repMax).map(Number).filter(r => r <= 15).sort((a, b) => a - b) : [];
  const rec = openSheet(esc(X.name), `
    <div class="meta-line"><span class="row" style="gap:6px">${plate(X.pattern)}${PATTERNS[X.pattern].name}</span><span>${cap([...(X.primary || []), ...(X.secondary || []).map(m => m + ' (half)')].join(', ')) || 'No muscles set'}</span></div>
    ${st ? `<div class="sum-grid" style="grid-template-columns:repeat(3,1fr)"><div><div class="v">${st.best ? kg(st.best.v) : '–'}</div><div class="l">Best e1RM, kg</div></div><div><div class="v">${st.bestW ? kg(st.bestW.w) : '–'}</div><div class="l">Heaviest, kg</div></div><div><div class="v">${st.count}</div><div class="l">Times logged</div></div></div>` : '<div class="empty">Not logged yet.</div>'}
    ${hasE1 ? `<h3 style="margin-top:8px">Estimated 1RM, ${gran === 'month' ? 'monthly' : 'weekly'}</h3><div class="chart-box sm" style="height:190px"><canvas id="c-exd"></canvas></div>` : ''}
    ${reps.length ? `<h3 style="margin:20px 0 6px">Rep records</h3><div class="tbl-wrap"><table class="extable"><thead><tr><th>Reps</th><th class="r">Heaviest</th><th class="r">RPE</th><th class="r">Date</th></tr></thead><tbody>${reps.map(r => `<tr><td>${r}</td><td class="r"><b>${kg(st.repMax[r].w)} kg</b></td><td class="r">${st.repMax[r].rpe != null ? nf(st.repMax[r].rpe) : '–'}</td><td class="r muted">${fmtDateY(D(st.repMax[r].date))}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${hist.length ? `<h3 style="margin:20px 0 6px">Recent</h3><div class="list">${hist.slice(0, 10).map(h => `<div class="sd-item"><div class="h"><span>${fmtDate(D(h.date), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><span class="e">${h.band ? `e1RM ${nf(h.band.min, 0)}–${nf(h.band.max, 0)}` : ''}</span></div><div class="sd-note" style="margin-left:0;color:var(--ink-2)">${esc(setStr(h.sets))}${h.note ? ` <span class="muted">(${esc(h.note)})</span>` : ''}</div></div>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:18px"><button class="btn sm" data-act="ex-edit" data-id="${id}">${I.edit}Edit pattern and muscles</button></div>`);
  if (hasE1) rec.charts.push(e1Chart($('#c-exd', rec.sh), periods, series, patColor(X.pattern)));
}

/* =========================================================
   PROGRAMS
   ========================================================= */
function renderPrograms() {
  const sel = ui.progSel && progById(ui.progSel);
  if (!sel) {
    view().innerHTML = `
      <div class="page-head"><div><h1>Programs</h1><div class="sub">Plan your weeks, then start each day with targets filled in</div></div><button class="btn sm primary" data-act="prog-new">${I.plus}New program</button></div>
      <div class="cards">${db.programs.map(p => { const days = p.weeks.reduce((a, w) => a + w.days.length, 0); const active = p.id === db.settings.activeProgramId;
        return `<button class="prog-card ${active ? 'active' : ''}" data-act="prog-open" data-id="${p.id}"><div class="row">${active ? '<span class="badge ink">Active</span>' : ''}<span class="badge">${p.weeks.length} week${p.weeks.length > 1 ? 's' : ''}, ${days} days</span></div><div class="name">${esc(p.name)}</div>${p.desc ? `<div class="small muted">${esc(p.desc)}</div>` : ''}</button>`; }).join('') || '<div class="empty">No programs yet.</div>'}</div>`;
    return;
  }
  const p = sel; const active = p.id === db.settings.activeProgramId; const pos = db.settings.pos;
  if (ui.progWeek >= p.weeks.length) ui.progWeek = 0;
  const w = p.weeks[ui.progWeek]; const plan = planByPattern(w);
  view().innerHTML = `
    <div style="margin-bottom:8px"><button class="btn ghost sm" data-act="prog-back">All programs</button></div>
    <div class="page-head" style="align-items:flex-start"><div><h1>${esc(p.name)}</h1>${p.desc ? `<div class="sub">${esc(p.desc)}</div>` : ''}</div></div>
    <div class="row wrap" style="margin-bottom:22px">
      ${active ? '<span class="badge ink">Active program</span>' : `<button class="btn sm primary" data-act="prog-active" data-id="${p.id}">Make active</button>`}
      <button class="btn sm" data-act="prog-edit" data-id="${p.id}">${I.edit}Edit</button>
      <button class="btn sm" data-act="prog-dup" data-id="${p.id}">${I.copy}Duplicate</button>
      <button class="btn sm ghost danger" data-act="prog-del" data-id="${p.id}">${I.trash}Delete</button>
    </div>
    ${p.weeks.length > 1 ? `<div class="week-tabs seg" role="group" aria-label="Week">${p.weeks.map((wk, i) => `<button data-act="prog-week" data-v="${i}" aria-pressed="${i === ui.progWeek}">${esc(wk.name)}</button>`).join('')}</div>` : ''}
    <div class="plan-sum" style="margin-bottom:16px"><span class="muted">Planned hard sets this week:</span>${PAT_ORDER.filter(x => plan[x]).map(x => `<span>${plate(x)}${PATTERNS[x].name} ${plan[x]}</span>`).join('') || '<span class="muted">none</span>'}</div>
    ${w.days.map((d, di) => {
      const done = lastDoneFor(p.id, ui.progWeek, di); const isNext = active && pos.week === ui.progWeek && pos.day === di;
      return `<div class="day-card"><div class="dh"><h3>${esc(d.name)}</h3>${isNext ? '<span class="badge ink">Next up</span>' : ''}${done ? `<span class="done-mark">Done ${fmtDate(D(done.date), { day: 'numeric', month: 'short' })}</span>` : ''}${d.items.length ? `<button class="btn sm" data-act="prog-start" data-w="${ui.progWeek}" data-d="${di}">${I.play}Start</button>` : ''}</div>
        ${d.note ? `<p class="small muted" style="margin:0 0 8px">${esc(d.note)}</p>` : ''}
        ${d.items.map(it => `<div class="rx-row ${it.group ? 'ss' : ''}">${plate(exById(it.exerciseId).pattern)}<span>${esc(exName(it.exerciseId))}${it.note ? ` <span class="muted small">(${esc(it.note)})</span>` : ''}</span><span class="rx">${esc(rxStr(it.sets))}</span></div>`).join('')}</div>`;
    }).join('')}`;
}

/* ---------- program editor ---------- */
let pe = null; // { draft, week }
function openProgramEditor(prog) {
  pe = { draft: prog ? clone(prog) : { id: 'p' + uid(), name: '', desc: '', weeks: [{ name: 'Week 1', days: [{ name: 'Day 1', note: '', items: [] }] }] }, week: 0, isNew: !prog };
  let ov = $('#pe'); if (!ov) { ov = document.createElement('div'); ov.id = 'pe'; ov.className = 'overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Program editor'); document.body.append(ov); }
  document.body.style.overflow = 'hidden'; ensureGuard(); renderPE();
}
function closePE() { $('#pe')?.remove(); pe = null; if (!$('#wo')) document.body.style.overflow = ''; }
function renderPE() {
  const ov = $('#pe'); if (!ov || !pe) return; const body = $('.ov-body', ov); const st = body ? body.scrollTop : 0;
  const p = pe.draft; const w = p.weeks[pe.week]; const plan = planByPattern(w);
  ov.innerHTML = `
    <div class="ov-head"><button class="icon-btn" data-act="pe-cancel" aria-label="Cancel">${I.x}</button><div class="title"><b>${pe.isNew ? 'New program' : 'Edit program'}</b></div><button class="btn primary sm" data-act="pe-save">Save</button></div>
    <div class="ov-body"><div class="ov-inner">
      <div class="field"><label for="pe-n">Name</label><input id="pe-n" class="input" data-pf="name" value="${esc(p.name)}" placeholder="e.g. Upper/lower, 4 days"></div>
      <div class="field"><label for="pe-d">Description</label><input id="pe-d" class="input" data-pf="desc" value="${esc(p.desc)}" placeholder="Goal, length, notes"></div>
      <div class="block-head" style="margin-top:18px"><h2>Weeks</h2><div class="row"><button class="btn sm" data-act="pe-add-week">${I.copy}Copy this week</button>${p.weeks.length > 1 ? `<button class="btn sm ghost danger" data-act="pe-del-week">Delete week</button>` : ''}</div></div>
      <div class="week-tabs seg" role="group" aria-label="Week">${p.weeks.map((wk, i) => `<button data-act="pe-week" data-v="${i}" aria-pressed="${i === pe.week}">${esc(wk.name)}</button>`).join('')}</div>
      <div class="field"><label for="pe-wn">Week name</label><input id="pe-wn" class="input" data-pwf="name" value="${esc(w.name)}"></div>
      <div class="plan-sum" style="margin-bottom:14px"><span class="muted">Planned hard sets:</span>${PAT_ORDER.filter(x => plan[x]).map(x => `<span>${plate(x)}${PATTERNS[x].name} ${plan[x]}</span>`).join('') || '<span class="muted">none yet</span>'}</div>
      ${w.days.map((d, di) => `<div class="day-card">
        <div class="dh"><input class="input" data-pdf="name" data-d="${di}" value="${esc(d.name)}" aria-label="Day name" style="font-weight:650">${w.days.length > 1 ? `<button class="icon-btn" data-act="pe-del-day" data-d="${di}" aria-label="Delete day">${I.trash}</button>` : ''}</div>
        <input class="input" data-pdf="note" data-d="${di}" value="${esc(d.note)}" placeholder="Day note, e.g. conditioning 25 min at RPE 6" style="margin-bottom:6px">
        ${d.items.map((it, ii) => `<div class="pe-item ${it.group ? 'ss' : ''}">
          <div class="top"><button class="nm" data-act="pe-item-ex" data-d="${di}" data-i="${ii}">${plate(exById(it.exerciseId).pattern)}${esc(exName(it.exerciseId))}</button>
            ${ii < d.items.length - 1 ? `<button class="icon-btn" data-act="pe-item-ss" data-d="${di}" data-i="${ii}" aria-label="${it.group && d.items[ii + 1].group === it.group ? 'Unlink superset' : 'Superset with next'}" title="${it.group && d.items[ii + 1].group === it.group ? 'Unlink superset' : 'Superset with next'}">${it.group && d.items[ii + 1].group === it.group ? I.unlink : I.link}</button>` : ''}
            ${ii > 0 ? `<button class="icon-btn" data-act="pe-item-up" data-d="${di}" data-i="${ii}" aria-label="Move up">${I.up}</button>` : ''}
            <button class="icon-btn" data-act="pe-item-del" data-d="${di}" data-i="${ii}" aria-label="Remove">${I.trash}</button></div>
          <div class="rxin"><input class="input" data-pif="reps" data-d="${di}" data-i="${ii}" value="${esc(schemeReps(it.sets))}" placeholder="Reps, e.g. 5/5/5" inputmode="text" aria-label="Reps per set"><input class="input" data-pif="rpe" data-d="${di}" data-i="${ii}" value="${esc(schemeRpe(it.sets))}" placeholder="RPE, e.g. 7/8/9" aria-label="RPE per set"></div>
          <input class="input" data-pif="note" data-d="${di}" data-i="${ii}" value="${esc(it.note)}" placeholder="Note (belted, paused, myo-reps)" style="margin-top:8px;min-height:38px">
        </div>`).join('')}
        <button class="add-set" data-act="pe-add-item" data-d="${di}">+ Add exercise</button>
      </div>`).join('')}
      <button class="btn block" data-act="pe-add-day">${I.plus}Add day</button>
      <p class="kbd-hint" style="margin-top:14px">Write sets the way you’re used to: reps “5/5/5” and RPE “7/8/9”. A single RPE like “8” applies to every set. The number of reps sets the number of sets.</p>
    </div></div>`;
  $('.ov-body', ov).scrollTop = st;
}
function savePE() {
  const p = pe.draft; if (!p.name.trim()) { toast('Give the program a name'); $('#pe-n')?.focus(); return; }
  p.weeks.forEach(w => w.days.forEach(d => normalizeGroups(d.items)));
  const i = db.programs.findIndex(x => x.id === p.id);
  if (i >= 0) db.programs[i] = p; else db.programs.push(p);
  const pos = db.settings.pos; if (p.id === db.settings.activeProgramId && (!p.weeks[pos.week] || !p.weeks[pos.week].days[pos.day])) db.settings.pos = { week: 0, day: 0 };
  save(); closePE(); ui.progSel = p.id; toast('Program saved'); if (location.hash !== '#programs') location.hash = '#programs'; else rerender();
}

/* =========================================================
   MORE: tools, settings, data
   ========================================================= */
const calc = { w: 100, r: 5, rpe: 8, tr: 3, trpe: 8 };
function calcOut() {
  const e = e1rm(calc.w, calc.r, calc.rpe); const p = pct(calc.tr, calc.trpe);
  return `<div class="row wrap" style="gap:24px;margin-top:6px"><div><div class="lbl">Estimated 1RM</div><div class="big-stat"><span class="v" style="font-size:44px">${e ? nf(e, 1) : '–'}</span><span class="u">kg</span></div></div>
    <div><div class="lbl">Load for ${calc.tr ?? '–'} reps @ ${nf(calc.trpe) || '–'}</div><div class="big-stat"><span class="v" style="font-size:44px">${e && p ? kg(roundTo(e * p, db.settings.round)) : '–'}</span><span class="u">kg</span></div><div class="small muted">${p ? `${nf(p * 100, 1)}% of e1RM, rounded to ${nf(db.settings.round)} kg` : ''}</div></div></div>`;
}
function renderMore() {
  const s = db.settings;
  view().innerHTML = `
    <div class="page-head"><div><h1>Tools and settings</h1><div class="sub">Calculators, preferences and your data</div></div></div>
    ${backupSection()}
    <div class="grid2">
      <section class="block panel">
        <div class="block-head"><h2>RPE calculator</h2><button class="btn ghost sm" data-act="rpe-table">Show table</button></div>
        <div class="lbl" style="margin-bottom:6px">A set you did</div>
        <div class="row"><input class="input" inputmode="decimal" data-calc="w" value="${nf(calc.w)}" aria-label="Weight"><span class="muted">kg ×</span><input class="input" inputmode="numeric" data-calc="r" value="${calc.r}" aria-label="Reps"><span class="muted">@</span><input class="input" inputmode="decimal" data-calc="rpe" value="${nf(calc.rpe)}" aria-label="RPE"></div>
        <div class="lbl" style="margin:14px 0 6px">What you want to do next</div>
        <div class="row"><input class="input" inputmode="numeric" data-calc="tr" value="${calc.tr}" aria-label="Target reps"><span class="muted">reps @</span><input class="input" inputmode="decimal" data-calc="trpe" value="${nf(calc.trpe)}" aria-label="Target RPE"></div>
        <div id="calc-out">${calcOut()}</div>
        <div style="margin-top:16px"><button class="btn sm" data-act="plates">${I.plates}Plate calculator</button></div>
      </section>
      <section class="block">
        <div class="block-head"><h2>Settings</h2></div>
        <div class="settings-list">
          <div class="it"><div class="l">Rest timer<small>Starts when you tick off a set</small></div><input class="input" inputmode="numeric" data-setting="rest" value="${s.rest}" aria-label="Rest seconds"><span class="muted small">sec</span></div>
          <div class="it"><div class="l">Round suggested loads to<small>Used for targets from RPE</small></div><input class="input" inputmode="decimal" data-setting="round" value="${nf(s.round)}" aria-label="Rounding"><span class="muted small">kg</span></div>
          <div class="it"><div class="l">Bar weight</div><input class="input" inputmode="decimal" data-setting="bar" value="${nf(s.bar)}" aria-label="Bar weight"><span class="muted small">kg</span></div>
          <div class="it"><div class="l">Plates you have<small>Per side, separated by slashes</small></div><input class="input" style="width:150px" data-setting="plates" value="${s.plates.map(x => nf(x, 2)).join('/')}" aria-label="Plates"></div>
          <div class="it"><div class="l">Count warm-ups as volume</div><input type="checkbox" data-setting="countWarmups" ${s.countWarmups ? 'checked' : ''} aria-label="Count warm-ups"></div>
          <div class="it"><div class="l">Appearance</div><select class="input" data-setting="theme" aria-label="Appearance"><option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Match device</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option></select></div>
        </div>
      </section>
    </div>
    <div class="grid2">
      <section class="block">
        <div class="block-head"><h2>Your data</h2></div>
        <div class="settings-list">
          <div class="it"><div class="l">Recently deleted<small>${(db.trash || []).length} workout${(db.trash || []).length === 1 ? '' : 's'}, kept for 30 days</small></div><button class="btn sm" data-act="trash-open">Open</button></div>
          <div class="it"><div class="l">Save a backup file<small>Full copy you can import on any device</small></div><button class="btn sm" data-act="export-json">Export</button></div>
          <div class="it"><div class="l">Sets for Power BI or Excel<small>One row per set, with e1RM, pattern and muscles</small></div><button class="btn sm" data-act="export-csv">Export CSV</button></div>
          <div class="it"><div class="l">Import a file<small>Adds anything missing, never overwrites what’s here</small></div><label class="btn sm">Import<input type="file" accept=".json,application/json" data-act-change="import-json" hidden></label></div>
        </div>
      </section>
      <section class="block">
        <div class="block-head"><h2>Exercises</h2></div>
        <div class="settings-list">
          <div class="it"><div class="l">Exercise library<small>${db.exercises.length} exercises with movement pattern and muscles</small></div><button class="btn sm" data-act="ex-lib">Open</button></div>
          <div class="it"><div class="l">Add an exercise</div><button class="btn sm" data-act="ex-new">${I.plus}New</button></div>
        </div>
        <p class="small muted">Chalk ${APP_VERSION}. ${storageLine()}</p>
      </section>
    </div>
    <section class="block panel">
      <h2 style="margin-bottom:8px">How the numbers work</h2>
      <p class="small" style="margin:0 0 8px;max-width:72ch"><b>Estimated 1RM</b> uses the RPE table from your workbook: weight divided by the percentage for that rep count and RPE. Per workout you see the band from your lowest to highest set; charts show the average with that band around it.</p>
      <p class="small" style="margin:0 0 8px;max-width:72ch"><b>Hard sets</b> are completed sets that aren’t marked as warm-up. <b>Tonnage</b> is weight × reps. Movement patterns follow your own categories: squat, hinge, horizontal and vertical press and pull, and accessories.</p>
      <p class="small" style="margin:0;max-width:72ch"><b>Suggested loads</b> take the average e1RM from the last time you did the lift and apply the target reps and RPE, rounded to your plate increment.</p>
    </section>`;
}
function plateCalc(target) {
  const body = (t) => {
    const bar = db.settings.bar; let side = (t - bar) / 2; const out = [];
    if (side > 0) for (const p of [...db.settings.plates].sort((a, b) => b - a)) { while (side >= p - 1e-9) { out.push(p); side -= p; } }
    const col = { 25: 'var(--p-sq)', 20: 'var(--p-hi)', 15: 'var(--p-hp)', 10: 'var(--p-vp)', 5: '#E8EAEC', 2.5: 'var(--p-sq)', 2: 'var(--p-hi)', 1.25: '#9AA3AD', 1: '#9AA3AD', 0.5: '#9AA3AD' };
    const hgt = { 25: 132, 20: 126, 15: 114, 10: 100, 5: 78, 2.5: 62, 2: 58, 1.25: 50, 1: 46, 0.5: 40 };
    const vis = out.map(p => `<div class="pl" style="height:${hgt[p] || 60}px;background:${col[p] || '#9AA3AD'};${p === 5 ? 'box-shadow:inset 0 0 0 1px #9AA3AD;' : ''}"><span style="${p === 5 || p <= 1.25 ? 'color:#1B2430' : ''}">${nf(p, 2)}</span></div>`).join('');
    return `<div class="barbell" aria-hidden="true"><div class="bar"></div><div class="collar"></div><div style="display:flex;align-items:center">${vis}</div><div class="end"></div></div>
      <p style="text-align:center;margin:4px 0 0"><b>${out.length ? out.map(p => nf(p, 2)).join(' + ') : 'Just the bar'}</b> per side</p>
      <p class="small muted" style="text-align:center;margin:4px 0 0">Bar ${nf(bar)} kg${side > 0.01 ? `. ${nf(side * 2, 2)} kg can’t be loaded with your plates.` : ''}</p>`;
  };
  const rec = openSheet('Plate calculator', `<div class="field"><label for="pc-t">Total weight (kg)</label><input id="pc-t" class="input" inputmode="decimal" data-plate="t" value="${nf(target, 2)}" autofocus></div><div id="pc-out">${body(target)}</div>`);
  rec.plateBody = body;
}
function rpeTable() {
  const reps = [...Array(12)].map((_, i) => i + 1); const rpes = ['10.0', '9.5', '9.0', '8.5', '8.0', '7.5', '7.0', '6.5', '6.0'];
  openSheet('RPE table', `<p class="small muted" style="margin-top:0">Percentage of 1RM for reps (columns) at RPE (rows), from your workbook.</p><div class="tbl-wrap"><table class="rpe-grid"><thead><tr><th>RPE</th>${reps.map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody>${rpes.map(k => `<tr><th>${nf(+k)}</th>${reps.map(r => { const hl = Math.round(calc.trpe * 2) / 2 === +k && calc.tr === r; const hr = Math.round(calc.rpe * 2) / 2 === +k && calc.r === r; return `<td class="${hl ? 'hl' : hr ? 'hr' : ''}">${nf(RPE_TABLE[k][r - 1] * 100, 1)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="small muted">Dark cell: your target in the calculator. Shaded cell: the set you entered.</p>`);
}
function exLibrary() {
  const by = {}; db.exercises.forEach(e => (by[e.pattern] || (by[e.pattern] = [])).push(e));
  openSheet('Exercise library', `<button class="btn sm" data-act="ex-new">${I.plus}New exercise</button>${PAT_ORDER.filter(p => by[p]).map(p => `<div class="pick-h">${PATTERNS[p].name}</div><div class="pick-list">${by[p].sort((a, b) => a.name.localeCompare(b.name)).map(e => `<button data-act="ex-edit" data-id="${e.id}">${plate(p, true)}<span style="flex:1"><span style="display:block">${esc(e.name)}</span><span class="sub">${cap([...(e.primary || []), ...(e.secondary || []).map(m => m + ' (half)')].join(', ')) || 'No muscles set'}</span></span></button>`).join('')}</div>`).join('')}`);
}
async function saveFile(name, data, mime) {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await window.claude.use('downloads');
      if (dl) { try { await dl.save({ filename: name, data }); toast('File saved'); } catch (e) { if (e && e.code !== 'declined') toast('Couldn’t save the file here'); } return; }
    }
  } catch (e) { }
  const url = URL.createObjectURL(new Blob([data], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function exportCSV() {
  const q = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['date', 'iso_week', 'session_id', 'session', 'exercise', 'pattern', 'primary_muscles', 'secondary_muscles', 'superset', 'set_no', 'set_type', 'weight_kg', 'reps', 'rpe', 'e1rm_kg', 'tonnage_kg', 'exercise_note']];
  for (const s of [...db.sessions].reverse()) {
    const d = D(s.date);
    s.items.filter(i => i.kind === 'lift').forEach(it => { const X = exById(it.exerciseId); it.sets.forEach((x, n) => { const e = e1rm(x.w, x.r, x.rpe);
      rows.push([s.date.replace('T', ' '), isoWeek(d).key, s.id, sessionTitle(s), X.name, PATTERNS[X.pattern].name, (X.primary || []).join('|'), (X.secondary || []).join('|'), it.group || '', n + 1, x.type, String(x.w ?? '').replace('.', ','), x.r, x.rpe != null ? String(x.rpe).replace('.', ',') : '', e ? e.toFixed(1).replace('.', ',') : '', String((x.w || 0) * (x.r || 0)).replace('.', ','), it.note]); }); });
  }
  saveFile(`chalk-sets-${localISO(new Date()).slice(0, 10)}.csv`, '\ufeff' + rows.map(r => r.map(q).join(';')).join('\n'), 'text/csv');
}

/* =========================================================
   EVENTS
   ========================================================= */
const ACT = {
  'sheet-close': () => closeSheet(),
  'confirm-yes': () => { const cb = confirmCb; confirmCb = null; closeSheet(); cb && cb(); },
  'menu-pick': (el) => { const k = el.dataset.k; if (menuCtx?.type === 'set') setMenuPick(k); else if (menuCtx?.type === 'item') itemMenuPick(k); else if (menuCtx?.type === 'day') { closeSheet(); const [w, d] = k.split(':').map(Number); startFromProgram(db.settings.activeProgramId, w, d); } },
  'start-next': () => startFromProgram(db.settings.activeProgramId, db.settings.pos.week, db.settings.pos.day),
  'pick-day': () => { const p = progById(db.settings.activeProgramId); if (!p) return; menuCtx = { type: 'day' }; const w = db.settings.pos.week; const items = []; p.weeks.forEach((wk, wi) => { if (p.weeks.length > 1 && Math.abs(wi - w) > 1) return; wk.days.forEach((d, di) => { if (d.items.length) items.push({ k: `${wi}:${di}`, label: `${p.weeks.length > 1 ? esc(wk.name) + ', ' : ''}${esc(d.name)}`, icon: I.play }); }); }); menuSheet('Choose a day', items); },
  'start-empty': () => startEmpty(false),
  'log-past': () => startEmpty(true),
  'resume': () => openWorkout(),
  'open-session': (el) => sessionDetail(el.dataset.id),
  'hist-more': () => { ui.histLimit += 12; rerender(); },
  'sess-edit': (el) => editSession(el.dataset.id),
  'sess-repeat': (el) => repeatSession(el.dataset.id),
  'sess-del': (el) => confirmSheet('Delete this workout?', 'It moves to Recently deleted in More, where you can restore it for 30 days.', 'Delete', () => { const s = db.sessions.find(x => x.id === el.dataset.id); if (s) { db.trash = db.trash || []; db.trash.unshift({ ...s, deletedAt: Date.now() }); db.sessions = db.sessions.filter(x => x !== s); } saveNow(); closeAllSheets(); toast('Workout moved to Recently deleted'); rerender(); }),
  'wo-min': () => minimizeWorkout(),
  'wo-finish': () => finishWorkout(),
  'wo-commit': () => commitWorkout(),
  'wo-discard': () => discardWorkout(),
  'add-ex': () => openPicker('Add exercise', addExerciseToActive),
  'add-cardio': () => { db.active.items.push({ id: uid(), kind: 'cardio', name: '', scheme: '', result: '' }); saveActive(true); renderWorkout(); },
  'add-set': (el) => { const it = findItem(el.dataset.item); const last = it.sets[it.sets.length - 1]; const n = { w: last?.w ?? null, r: last && last.tr == null ? last.r : null, rpe: null, type: 'work', done: false }; if (last?.tr != null) { n.tr = last.tr; n.trpe = last.trpe; } it.sets.push(n); saveActive(true); rerenderCard(it.id); },
  'set-done': (el) => toggleSet(el.dataset.item, +el.dataset.set),
  'set-menu': (el) => setMenu(el.dataset.item, +el.dataset.set),
  'item-menu': (el) => itemMenu(el.dataset.item),
  'rest-add': () => { rest.end += 15000; rest.dur += 15; tickRest(); },
  'rest-sub': () => { rest.end -= 15000; rest.dur = Math.max(15, rest.dur - 15); tickRest(); },
  'rest-skip': () => stopRest(),
  'pick': (el) => { const cb = pickCb; closeSheet(); cb && cb(el.dataset.id); },
  'pick-pat': (el) => { ui.pickPat = el.dataset.p || null; $$('[data-act="pick-pat"]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.p || null) === ui.pickPat))); $('#pick-list').innerHTML = pickerList(); },
  'pick-create': () => { const cb = pickCb; closeSheet(); exerciseForm(null, cb); },
  'exf-m': (el) => { const arr = exForm[el.dataset.kind]; const m = el.dataset.m; const i = arr.indexOf(m); if (i >= 0) arr.splice(i, 1); else { arr.push(m); const other = exForm[el.dataset.kind === 'primary' ? 'secondary' : 'primary']; const j = other.indexOf(m); if (j >= 0) other.splice(j, 1); } topSheet().sh.querySelector('.sh-body').innerHTML = exFormBody(); },
  'exf-p': (el) => { exForm.pattern = el.dataset.p; topSheet().sh.querySelector('.sh-body').innerHTML = exFormBody(); },
  'exf-save': () => saveExForm(),
  'ex-detail': (el) => exerciseDetail(el.dataset.id),
  'ex-edit': (el) => exerciseForm(exById(el.dataset.id), () => { closeAllSheets(); toast('Exercise updated'); if (db.active && $('#wo')) renderWorkout(); else rerender(); }),
  'ex-new': () => { ui.pickQ = ''; ui.pickPat = null; exerciseForm(null, () => { closeAllSheets(); toast('Exercise added'); rerender(); }); },
  'ex-lib': () => exLibrary(),
  'pr-range': (el) => { ui.range = el.dataset.v; if (ui.range === 'all' || ui.range === '1y') ui.gran = ui.range === 'all' ? 'month' : ui.gran; rerender(); },
  'pr-gran': (el) => { ui.gran = el.dataset.v; rerender(); },
  'pr-ex': (el) => { ui.prEx = el.dataset.id; rerender(); },
  'pr-metric': (el) => { ui.metric = el.dataset.v; rerender(); },
  'pr-by': (el) => { ui.by = el.dataset.v; rerender(); },
  'prog-open': (el) => { ui.progSel = el.dataset.id; ui.progWeek = el.dataset.id === db.settings.activeProgramId ? db.settings.pos.week : 0; window.scrollTo(0, 0); rerender(); },
  'prog-back': () => { ui.progSel = null; rerender(); },
  'prog-week': (el) => { ui.progWeek = +el.dataset.v; rerender(); },
  'prog-active': (el) => { db.settings.activeProgramId = el.dataset.id; db.settings.pos = { week: 0, day: 0 }; save(); toast('Active program changed'); rerender(); },
  'prog-start': (el) => { const id = ui.progSel; if (id !== db.settings.activeProgramId) { db.settings.activeProgramId = id; } db.settings.pos = { week: +el.dataset.w, day: +el.dataset.d }; save(); startFromProgram(id, +el.dataset.w, +el.dataset.d); },
  'prog-edit': (el) => openProgramEditor(progById(el.dataset.id)),
  'prog-new': () => openProgramEditor(null),
  'prog-dup': (el) => { const p = clone(progById(el.dataset.id)); p.id = 'p' + uid(); p.name += ' (copy)'; db.programs.push(p); save(); ui.progSel = p.id; toast('Program duplicated'); rerender(); },
  'prog-del': (el) => confirmSheet('Delete this program?', 'Workouts you logged from it stay in your history.', 'Delete', () => { db.programs = db.programs.filter(p => p.id !== el.dataset.id); if (db.settings.activeProgramId === el.dataset.id) db.settings.activeProgramId = db.programs[0]?.id || null; db.settings.pos = { week: 0, day: 0 }; ui.progSel = null; save(); rerender(); }),
  'pe-cancel': () => closePE(),
  'pe-save': () => savePE(),
  'pe-week': (el) => { pe.week = +el.dataset.v; renderPE(); },
  'pe-add-week': () => { const w = clone(pe.draft.weeks[pe.week]); w.name = 'Week ' + (pe.draft.weeks.length + 1); w.days.forEach(d => d.items.forEach(i => i.id = uid())); pe.draft.weeks.push(w); pe.week = pe.draft.weeks.length - 1; renderPE(); toast(`${w.name} added as a copy`); },
  'pe-del-week': () => { pe.draft.weeks.splice(pe.week, 1); pe.week = Math.max(0, pe.week - 1); renderPE(); },
  'pe-add-day': () => { const w = pe.draft.weeks[pe.week]; w.days.push({ name: 'Day ' + (w.days.length + 1), note: '', items: [] }); renderPE(); },
  'pe-del-day': (el) => { pe.draft.weeks[pe.week].days.splice(+el.dataset.d, 1); renderPE(); },
  'pe-add-item': (el) => { const d = pe.draft.weeks[pe.week].days[+el.dataset.d]; openPicker('Add to ' + d.name, (id) => { d.items.push({ id: uid(), exerciseId: id, note: '', group: null, sets: [{ r: 5, rpe: 7 }, { r: 5, rpe: 8 }, { r: 5, rpe: 9 }] }); renderPE(); }); },
  'pe-item-ex': (el) => { const it = pe.draft.weeks[pe.week].days[+el.dataset.d].items[+el.dataset.i]; openPicker('Change exercise', (id) => { it.exerciseId = id; renderPE(); }); },
  'pe-item-del': (el) => { const d = pe.draft.weeks[pe.week].days[+el.dataset.d]; d.items.splice(+el.dataset.i, 1); normalizeGroups(d.items); renderPE(); },
  'pe-item-up': (el) => { const d = pe.draft.weeks[pe.week].days[+el.dataset.d]; const i = +el.dataset.i; [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]]; normalizeGroups(d.items); renderPE(); },
  'pe-item-ss': (el) => { const d = pe.draft.weeks[pe.week].days[+el.dataset.d]; const i = +el.dataset.i; const a = d.items[i], b = d.items[i + 1];
    if (a.group && a.group === b.group) { const g = a.group; let k = i + 1; while (d.items[k]?.group === g) { d.items[k].group = 'g' + uid(); k++; } const ng = d.items[i + 1].group; for (let j = i + 1; j < k; j++) d.items[j].group = ng; }
    else { const g = a.group || 'g' + uid(); a.group = g; if (b.group) { const old = b.group; d.items.forEach(x => { if (x.group === old) x.group = g; }); } else b.group = g; }
    normalizeGroups(d.items); renderPE(); },
  'rpe-table': () => rpeTable(),
  'plates': () => { const e = e1rm(calc.w, calc.r, calc.rpe); const p = pct(calc.tr, calc.trpe); plateCalc(e && p ? roundTo(e * p, db.settings.round) : 100); },
  'export-json': () => saveFile(`chalk-backup-${localISO(new Date()).slice(0, 10)}.json`, JSON.stringify(exportData()), 'application/json'),
  'export-csv': () => exportCSV(),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName === 'LABEL') return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheets.length) { closeSheet(); return; }
  if (e.key === 'Enter' && e.target.closest('.sets input')) {
    e.preventDefault(); const inputs = $$('input', e.target.closest('.xc')).filter(i => i.closest('.sets')); const i = inputs.indexOf(e.target);
    if (i >= 0 && i < inputs.length - 1) inputs[i + 1].focus(); else e.target.blur();
  }
  if (e.key === 'Enter' && e.target.matches('tr[data-act]')) e.target.click();
});
document.addEventListener('focusin', (e) => { if (e.target.matches('.sets input')) setTimeout(() => e.target.select(), 0); });
document.addEventListener('input', (e) => {
  const t = e.target; const ds = t.dataset;
  if (ds.f && db.active) {
    const it = findItem(ds.item); if (!it) return;
    if (ds.f === 'note') { it.note = t.value; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; saveActive(); return; }
    const s = it.sets[+ds.set]; s[ds.f] = ds.f === 'r' ? (parseInt(t.value) || null) : parseNum(t.value);
    const e1 = e1rm(s.w, s.r, s.rpe); const cell = document.getElementById(`e1-${it.id}-${ds.set}`); if (cell) cell.textContent = e1 ? nf(e1, 0) : '';
    saveActive(); return;
  }
  if (ds.sf && db.active) { const k = ds.sf; db.active[k] = ['bodyweight'].includes(k) ? parseNum(t.value) : t.value; saveActive(); return; }
  if (ds.cf && db.active) { const it = findItem(ds.item); if (it) { it[ds.cf] = t.value; saveActive(); } return; }
  if (ds.hf) { ui.histQ = t.value; clearTimeout(ui.hT); ui.hT = setTimeout(() => { const pos = t.selectionStart; rerender(); const n = $('[data-hf="q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 200); return; }
  if (ds.pick) { ui.pickQ = t.value; $('#pick-list').innerHTML = pickerList(); return; }
  if (ds.exf) { exForm[ds.exf] = t.type === 'checkbox' ? t.checked : t.value; return; }
  if (ds.pf && pe) { pe.draft[ds.pf] = t.value; return; }
  if (ds.pwf && pe) { pe.draft.weeks[pe.week].name = t.value; return; }
  if (ds.pdf && pe) { pe.draft.weeks[pe.week].days[+ds.d][ds.pdf] = t.value; return; }
  if (ds.pif && pe && ds.pif === 'note') { pe.draft.weeks[pe.week].days[+ds.d].items[+ds.i].note = t.value; return; }
  if (ds.calc) { calc[ds.calc] = ds.calc === 'r' || ds.calc === 'tr' ? parseInt(t.value) || null : parseNum(t.value); $('#calc-out').innerHTML = calcOut(); return; }
  if (ds.plate) { const rec = topSheet(); const v = parseNum(t.value); if (rec?.plateBody && v != null) $('#pc-out').innerHTML = rec.plateBody(v); return; }
});
document.addEventListener('change', (e) => {
  const t = e.target; const ds = t.dataset;
  if (ds.pif && pe && ds.pif !== 'note') {
    const it = pe.draft.weeks[pe.week].days[+ds.d].items[+ds.i];
    const row = t.closest('.rxin'); const reps = $('[data-pif="reps"]', row).value; const rpe = $('[data-pif="rpe"]', row).value;
    const sets = parseScheme(reps, rpe); if (sets.length) it.sets = sets; else toast('Write reps like 5/5/5');
    renderPE(); return;
  }
  if (ds.setting) {
    const k = ds.setting; const s = db.settings;
    if (k === 'theme') { s.theme = t.value; applyTheme(); save(); rerender(); return; }
    if (k === 'countWarmups') { s.countWarmups = t.checked; save(); return; }
    if (k === 'plates') { const arr = t.value.split(/[\/;\s]+/).map(parseNum).filter(v => v > 0); if (arr.length) s.plates = arr; save(); return; }
    const v = parseNum(t.value); if (v != null && v > 0) { s[k] = k === 'rest' ? Math.round(v) : v; save(); if (k === 'round') $('#calc-out').innerHTML = calcOut(); }
    return;
  }
  if (ds.actChange === 'pr-ex') { ui.prEx = t.value; rerender(); return; }
  if (ds.actChange === 'import-json') { const f = t.files[0]; t.value = ''; if (f) importFromFile(f); }

});

/* =========================================================
   INIT
   ========================================================= */
function applyTheme() { const t = db.settings.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

/* =========================================================
   PERSISTENCE (on this phone)
   ========================================================= */
const APP_VERSION = '1.0.0';
let device = null;
let persisted = new Map();       // record key -> JSON as last written to the device
let activeWritten = null;        // JSON of the active workout as last written
let persistChain = Promise.resolve();
let persistTimer = null, wantRecords = false, storageFailed = false;

function recordMap() {
  const m = new Map();
  db.sessions.forEach(s => m.set('session:' + s.id, s));
  (db.trash || []).forEach(s => m.set('trash:' + s.id, s));
  db.programs.forEach(p => m.set('program:' + p.id, p));
  db.exercises.forEach(e => m.set('exercise:' + e.id, e));
  m.set('settings:main', db.settings);
  return m;
}
function persistNow(tsOverride) {
  clearTimeout(persistTimer); persistTimer = null;
  const doRecords = wantRecords || tsOverride != null; wantRecords = false;
  persistChain = persistChain.then(async () => {
    try {
      // 1. active workout: synchronous copy first, then the database
      const aj = db.active ? JSON.stringify(db.active) : null;
      if (aj !== activeWritten) {
        try { localStorage.setItem('chalk.active', aj || ''); } catch (e) { }
        await kvSet('active', aj ? JSON.parse(aj) : null);
        activeWritten = aj;
      }
      // 2. records that changed since the last write, with their outbox entries
      if (doRecords) {
        const now = tsOverride ?? Date.now(); const m = recordMap(); const changes = []; const next = new Map();
        for (const [k, v] of m) { const j = JSON.stringify(v); next.set(k, j); if (persisted.get(k) !== j) changes.push({ k, op: 'put', data: JSON.parse(j), ts: now }); }
        for (const k of persisted.keys()) if (!m.has(k)) changes.push({ k, op: 'delete', data: null, ts: now });
        if (changes.length) { await writeChanges(changes, device); persisted = next; requestSync(); refreshSyncState().then(renderStatus); }
      }
      if (storageFailed) { storageFailed = false; renderStatus(); }
    } catch (err) {
      console.error(err); storageFailed = true; wantRecords = true;
      toast('Saving on this phone failed. Keep the app open and export a backup file from More.');
      renderStatus();
    }
  });
  return persistChain;
}
function save() { invalidate(); wantRecords = true; if (!persistTimer) persistTimer = setTimeout(persistNow, 150); }
function saveActive(now) { if (now) return persistNow(); if (!persistTimer) persistTimer = setTimeout(persistNow, 300); }
function saveNow(tsOverride) { invalidate(); wantRecords = true; return persistNow(tsOverride); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { persistNow(); requestSync(0); } });
window.addEventListener('pagehide', () => persistNow());

function loadFromRecords(recs) {
  const d = defaultData(); d.sessions = []; d.trash = [];
  const ex = [], progs = [];
  for (const r of recs) {
    const [type] = r.k.split(':');
    if (type === 'session') d.sessions.push(r.data);
    else if (type === 'trash') d.trash.push(r.data);
    else if (type === 'program') progs.push(r.data);
    else if (type === 'exercise') ex.push(r.data);
    else if (type === 'settings') d.settings = { ...clone(DEFAULT_SETTINGS), ...r.data };
  }
  if (ex.length) { const have = new Set(ex.map(e => e.id)); d.exercises = [...ex, ...d.exercises.filter(e => !have.has(e.id))]; } // new built-ins appear automatically
  if (recs.some(r => r.k.startsWith('program:')) || recs.some(r => r.k === 'settings:main')) d.programs = progs;
  d.sessions.sort((a, b) => b.date.localeCompare(a.date));
  d.trash.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  return d;
}
async function reloadFromDevice() {
  const recs = await storeAll('records'); const active = db?.active ?? null;
  db = loadFromRecords(recs); db.active = active;
  persisted = new Map(recs.map(r => [r.k, JSON.stringify(r.data)]));
  invalidate();
}

/* =========================================================
   BACKUP SYNC (to your Google Sheet)
   ========================================================= */
const sync = { configured: false, pending: 0, oldestPending: null, lastOk: null, lastError: null, busy: false, cfg: null };
let syncTimer = null, retryDelay = 15000;
function requestSync(delay = 1500) {
  clearTimeout(syncTimer); syncTimer = setTimeout(runSync, delay);
  if (navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.sync && r.sync.register('chalk-sync')).catch(() => { });
}
async function runSync() {
  await refreshSyncState();
  if (!sync.configured || !sync.pending) { renderStatus(); return; }
  if (!navigator.onLine) { renderStatus(); return; }
  sync.busy = true; renderStatus();
  try { await withSyncLock(pushOutbox); retryDelay = 15000; }
  catch (e) { clearTimeout(syncTimer); syncTimer = setTimeout(runSync, retryDelay); retryDelay = Math.min(retryDelay * 2, 10 * 60000); }
  sync.busy = false; await refreshSyncState(); renderStatus();
}
async function refreshSyncState() {
  try {
    const [cfg, st, ob] = await Promise.all([kvGet('backup'), kvGet('syncStatus'), storeAll('outbox')]);
    sync.cfg = cfg || null; sync.configured = !!(cfg && cfg.url && cfg.key);
    sync.pending = ob.length; sync.oldestPending = ob.length ? Math.min(...ob.map(e => Math.floor(e.seq / 1000))) : null;
    sync.lastOk = st?.lastOk || null; sync.lastError = st?.lastError && (!st.lastOk || st.lastErrorAt > st.lastOk) ? st.lastError : null;
  } catch (e) { }
}
function ago(ms) { const s = Math.round((Date.now() - ms) / 1000); if (s < 60) return 'just now'; const m = Math.round(s / 60); if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 36) return h + ' h ago'; return Math.round(h / 24) + ' days ago'; }
function syncLevel() {
  if (storageFailed) return { cls: 'bad', text: 'Not saved on phone' };
  if (!sync.configured) return { cls: 'bad', text: 'No backup set up' };
  if (sync.busy) return { cls: 'warn', text: 'Backing up…' };
  if (sync.pending) { const old = sync.oldestPending && Date.now() - sync.oldestPending > 864e5; return { cls: old ? 'bad' : 'warn', text: `${sync.pending} change${sync.pending > 1 ? 's' : ''} waiting${navigator.onLine ? '' : ', offline'}` }; }
  return { cls: 'ok', text: sync.lastOk ? 'Backed up ' + ago(sync.lastOk) : 'Backed up' };
}
function syncPill() { const l = syncLevel(); return `<button class="sync-pill ${l.cls}" data-act="goto-backup" id="sync-pill"><i></i>${l.text}</button>`; }
function backupBanner() {
  if (storageFailed) return `<div class="banner bad">Your last change couldn’t be saved on this phone. Keep the app open, then export a backup file from More.</div>`;
  if (!sync.configured && db.sessions.length) return `<div class="banner bad"><div><b>Your workouts are only on this phone.</b> Connect your Google Sheet backup so nothing is lost if the phone is.</div><button class="btn sm primary" data-act="goto-backup">Set up backup</button></div>`;
  if (sync.pending && sync.oldestPending && Date.now() - sync.oldestPending > 864e5) return `<div class="banner bad"><div><b>${sync.pending} changes haven’t reached your backup for over a day.</b> ${esc(sync.lastError || 'Connect to the internet and open the app.')}</div><button class="btn sm" data-act="sync-now">Try now</button></div>`;
  return '';
}
function renderStatus() {
  const p = $('#sync-pill'); if (p) p.outerHTML = syncPill();
  const b = $('#backup-status'); if (b) b.innerHTML = backupStatusHtml();
}
function backupStatusHtml() {
  const l = syncLevel();
  return `<div class="row" style="gap:10px;margin-bottom:6px"><span class="sync-pill ${l.cls}" style="pointer-events:none"><i></i>${l.text}</span></div>
    ${sync.lastError ? `<p class="small" style="color:var(--danger);margin:6px 0">Last attempt failed: ${esc(sync.lastError)}</p>` : ''}
    ${sync.cfg?.sheet ? `<p class="small muted" style="margin:4px 0">Connected to “${esc(sync.cfg.sheet)}” from this phone (${esc(device)}).</p>` : ''}`;
}
function backupSection() {
  if (!sync.configured) return `<section class="block panel" id="backup">
    <div class="block-head"><h2>Google Sheet backup</h2></div>
    <p class="small" style="margin-top:0;max-width:70ch">Every change is saved on this phone first, then copied to a Google Sheet in your own Drive. The README in the download explains the 10-minute setup.</p>
    ${backupForm('connect')}</section>`;
  return `<section class="block panel" id="backup">
    <div class="block-head"><h2>Google Sheet backup</h2></div>
    <div id="backup-status">${backupStatusHtml()}</div>
    <div class="row wrap" style="margin-top:12px"><button class="btn sm primary" data-act="sync-now">Back up now</button><button class="btn sm" data-act="pull-now">Get latest from backup</button><span class="spacer"></span><button class="btn sm ghost danger" data-act="backup-off">Disconnect</button></div>
  </section>`;
}
function backupForm(mode) {
  return `<div class="field"><label for="bk-url">Web app link</label><input id="bk-url" class="input" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" spellcheck="false" value="${esc(sync.cfg?.url || '')}"></div>
    <div class="field"><label for="bk-key">Backup key</label><input id="bk-key" class="input" placeholder="From the “about” tab in your sheet" autocomplete="off" spellcheck="false"></div>
    <div id="bk-msg" class="small" style="min-height:20px;margin-bottom:8px"></div>
    <button class="btn primary" data-act="${mode === 'restore' ? 'onb-restore' : 'backup-connect'}">${mode === 'restore' ? 'Restore my workouts' : 'Connect backup'}</button>`;
}
function readBackupForm() {
  const url = ($('#bk-url')?.value || '').trim(), key = ($('#bk-key')?.value || '').trim();
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { $('#bk-msg').innerHTML = `<span style="color:var(--danger)">That doesn’t look like an Apps Script web app link. It starts with https://script.google.com/macros/s/</span>`; return null; }
  if (key.length < 16) { $('#bk-msg').innerHTML = `<span style="color:var(--danger)">Paste the full backup key from the “about” tab.</span>`; return null; }
  return { url, key, device };
}
async function connectBackup(cfg, { restore } = {}) {
  const msg = (s, bad) => { const m = $('#bk-msg'); if (m) m.innerHTML = bad ? `<span style="color:var(--danger)">${esc(s)}</span>` : esc(s); };
  msg('Checking the connection…');
  let info;
  try { info = await backupCall(cfg, { action: 'ping' }, 30000); }
  catch (e) { msg(e.name === 'AbortError' ? 'No answer from the backup. Check your connection and try again.' : e.message, true); return false; }
  cfg.sheet = info.name || 'Chalk backup'; cfg.connectedAt = Date.now();
  await kvSet('backup', cfg);
  msg(info.events ? `Connected. Getting ${info.events} saved changes…` : 'Connected. Sending your workouts…');
  try {
    if (info.events) await pullAndMerge();
    await withSyncLock(pushOutbox);
  } catch (e) { msg('Connected, but the first sync didn’t finish: ' + e.message + ' It will retry automatically.', true); await refreshSyncState(); return true; }
  await refreshSyncState(); return true;
}
async function pullAndMerge() {
  const cfg = await kvGet('backup'); if (!cfg) return 0;
  const j = await backupCall(cfg, { action: 'pull' }, 120000);
  const pend = new Set((await storeAll('outbox')).map(e => e.k));
  const local = new Map((await storeAll('records')).map(r => [r.k, r]));
  const changes = [];
  for (const r of j.records || []) {
    if (!r || !r.k || pend.has(r.k)) continue;   // your unsent change on this phone is newer
    const l = local.get(r.k);
    if (r.op === 'delete') { if (l && r.ts >= l.ts) changes.push({ k: r.k, op: 'delete', ts: r.ts, local: true }); }
    else if (!l || r.ts > l.ts) changes.push({ k: r.k, op: 'put', data: r.data, ts: r.ts, local: true });
  }
  if (changes.length) { await persistChain; await writeChanges(changes, device); await reloadFromDevice(); }
  await kvSet('lastPull', Date.now());
  return changes.length;
}

/* =========================================================
   TRASH, IMPORT, EXPORT
   ========================================================= */
function purgeTrash() { const cut = Date.now() - 30 * 864e5; const before = (db.trash || []).length; db.trash = (db.trash || []).filter(s => (s.deletedAt || 0) > cut); return before !== db.trash.length; }
function trashSheet() {
  const t = db.trash || [];
  openSheet('Recently deleted', t.length ? `<p class="small muted" style="margin-top:0">Deleted workouts stay here for 30 days. Your Google Sheet keeps every version permanently.</p><div class="list">${t.map(s => `<div class="sd-item"><div class="h"><span>${esc(sessionTitle(s))}</span><span class="e">${fmtDate(D(s.date), { day: 'numeric', month: 'short', year: 'numeric' })}</span></div><div class="row" style="margin:8px 0 0 0"><span class="small muted">Deleted ${ago(s.deletedAt)}</span><span class="spacer"></span><button class="btn sm" data-act="trash-restore" data-id="${s.id}">Restore</button></div></div>`).join('')}</div>` : `<div class="empty">Nothing deleted in the last 30 days.</div>`);
}
function exportData() {
  return { format: 'chalk-backup', version: DATA_VERSION, exportedAt: new Date().toISOString(), device, app: APP_VERSION, exercises: db.exercises, sessions: db.sessions, programs: db.programs, settings: db.settings, trash: db.trash || [] };
}
function normalizeImport(d) {
  if (!d || typeof d !== 'object') throw new Error('Not a Chalk file');
  const remap = (id) => ID_REMAP[id] || id;
  const fixSession = (s) => { delete s.readiness; delete s.sleep; (s.items || []).forEach(i => { if (i.exerciseId) i.exerciseId = remap(i.exerciseId); }); return s; };
  const valid = (s) => s && typeof s.id === 'string' && typeof s.date === 'string' && Array.isArray(s.items);
  if (d.format === 'chalk-history') return { base: true, sessions: (d.sessions || []).filter(valid).map(fixSession), exercises: [], programs: [], trash: [] };
  if (Array.isArray(d.sessions)) return {
    base: false, sessions: d.sessions.filter(valid).map(fixSession), trash: (d.trash || []).filter(valid).map(fixSession),
    exercises: (d.exercises || []).filter(e => e && e.id && e.name), programs: (d.programs || []).filter(p => p && p.id && Array.isArray(p.weeks)).map(p => { p.weeks.forEach(w => w.days.forEach(x => x.items.forEach(i => i.exerciseId = remap(i.exerciseId)))); return p; })
  };
  throw new Error('Not a Chalk file');
}
function mergeImport(n) {
  const have = (arr) => new Set(arr.map(x => x.id));
  const hs = have(db.sessions), ht = have(db.trash || []), he = have(db.exercises), hp = have(db.programs);
  const add = { sessions: 0, exercises: 0, programs: 0 };
  n.exercises.forEach(e => { if (!he.has(e.id)) { db.exercises.push(e); add.exercises++; } });
  n.sessions.forEach(s => { if (!hs.has(s.id) && !ht.has(s.id)) { db.sessions.push(s); add.sessions++; } });
  n.trash.forEach(s => { if (!hs.has(s.id) && !ht.has(s.id)) { db.trash.push(s); } });
  n.programs.forEach(p => { if (!hp.has(p.id)) { db.programs.push(p); add.programs++; } });
  db.sessions.sort((a, b) => b.date.localeCompare(a.date));
  return add;
}
function importFromFile(file, after) {
  const r = new FileReader();
  r.onload = async () => {
    let n; try { n = normalizeImport(JSON.parse(r.result)); } catch (e) { toast('That file isn’t a Chalk history or backup file'); return; }
    const add = mergeImport(n);
    // history from the workbook gets the oldest possible timestamp, so it never overrules a later edit
    await saveNow(n.base ? 1 : undefined);
    toast(`Added ${add.sessions} workout${add.sessions === 1 ? '' : 's'}${add.exercises ? `, ${add.exercises} exercises` : ''}${add.programs ? `, ${add.programs} programs` : ''}`);
    after ? after() : rerender();
  };
  r.onerror = () => toast('Couldn’t read that file');
  r.readAsText(file);
}
async function storageInfo() {
  const out = { persisted: null, usage: null };
  try { if (navigator.storage?.persisted) out.persisted = await navigator.storage.persisted(); if (navigator.storage?.estimate) out.usage = (await navigator.storage.estimate()).usage; } catch (e) { }
  return out;
}
let storageState = { persisted: null, usage: null };
function storageLine() {
  const p = storageState.persisted;
  return p === true ? 'Phone storage is protected from automatic clean-up.' : p === false ? 'Phone storage isn’t protected yet; install the app to your home screen.' : '';
}

/* =========================================================
   BACK BUTTON (Android): closes the top sheet or screen instead of leaving the app
   ========================================================= */
let guard = false;
function ensureGuard() { if (!guard) { history.pushState({ chalkGuard: 1 }, ''); guard = true; } }
function anyLayer() { return sheets.length || $('#pe') || $('#wo'); }
window.addEventListener('popstate', () => {
  if (!guard) return; guard = false;
  if (sheets.length) closeSheet(); else if ($('#pe')) closePE(); else if ($('#wo')) minimizeWorkout();
  if (anyLayer()) ensureGuard();
});
window.addEventListener('hashchange', () => { guard = false; });

/* =========================================================
   ONBOARDING (first run on a phone)
   ========================================================= */
let onbMode = null;
function renderOnboarding() {
  $('.tabs').classList.add('hide');
  view().innerHTML = `
    <div class="onb">
      <div class="brand-big"><i class="plate lg" style="--c:var(--p-sq)"></i>Chalk</div>
      <h1 class="onb-h">Your training log, on this phone</h1>
      <p class="muted" style="max-width:52ch">Everything you log is saved on the phone first and works without signal. A copy goes to a Google Sheet in your Drive whenever you’re online.</p>
      <div class="onb-cards">
        <div class="onb-card ${onbMode === 'restore' ? 'open' : ''}">
          <button class="onb-t" data-act="onb-mode" data-v="restore"><b>Restore from my Google Sheet</b><span>For a new phone, or after reinstalling</span></button>
          ${onbMode === 'restore' ? `<div class="onb-b">${backupForm('restore')}</div>` : ''}
        </div>
        <div class="onb-card ${onbMode === 'file' ? 'open' : ''}">
          <button class="onb-t" data-act="onb-mode" data-v="file"><b>Import my history file</b><span>chalk-history-import.json with your 648 workbook workouts, or a backup file</span></button>
          ${onbMode === 'file' ? `<div class="onb-b"><label class="btn primary">Choose file<input type="file" accept=".json,application/json" data-act-change="onb-file" hidden></label></div>` : ''}
        </div>
        <div class="onb-card">
          <button class="onb-t" data-act="onb-empty"><b>Start with an empty log</b><span>You can import or connect a backup later in More</span></button>
        </div>
      </div>
    </div>`;
}
async function finishOnboarding() {
  await kvSet('initialized', Date.now());
  $('.tabs').classList.remove('hide');
  location.hash = '#today'; route();
  requestSync(500);
}
Object.assign(ACT, {
  'goto-backup': () => { location.hash = '#more'; setTimeout(() => $('#backup')?.scrollIntoView({ behavior: 'smooth' }), 80); },
  'sync-now': async () => { await persistNow(); if (!navigator.onLine) { toast('You’re offline. Changes are safe on this phone and will be sent later.'); return; } await runSync(); toast(sync.pending ? 'Some changes are still waiting' : 'Everything is backed up'); },
  'pull-now': async () => { try { toast('Getting latest from backup…'); const n = await pullAndMerge(); toast(n ? `${n} change${n > 1 ? 's' : ''} brought in` : 'Already up to date'); rerender(); } catch (e) { toast(e.message); } },
  'backup-connect': async () => { const cfg = readBackupForm(); if (!cfg) return; await persistNow(); if (await connectBackup(cfg)) { toast('Backup connected'); rerender(); } },
  'backup-off': () => confirmSheet('Disconnect the backup?', 'Your workouts stay on this phone and in the sheet. New changes will wait on the phone until you connect again.', 'Disconnect', async () => { await kvSet('backup', null); await refreshSyncState(); rerender(); }),
  'trash-open': () => trashSheet(),
  'trash-restore': (el) => { const s = db.trash.find(x => x.id === el.dataset.id); if (!s) return; db.trash = db.trash.filter(x => x !== s); const r = { ...s }; delete r.deletedAt; db.sessions.push(r); db.sessions.sort((a, b) => b.date.localeCompare(a.date)); saveNow(); closeSheet(); toast('Workout restored'); rerender(); },
  'onb-mode': (el) => { onbMode = onbMode === el.dataset.v ? null : el.dataset.v; renderOnboarding(); },
  'onb-empty': async () => { await saveNow(1); finishOnboarding(); },
  'onb-restore': async () => {
    const cfg = readBackupForm(); if (!cfg) return;
    if (await connectBackup(cfg, { restore: true })) { await saveNow(1); toast(`Restored ${db.sessions.length} workouts`); finishOnboarding(); }
  },
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.actChange === 'onb-file') { const f = e.target.files[0]; e.target.value = ''; if (f) importFromFile(f, finishOnboarding); }
});

/* =========================================================
   APP UPDATES
   ========================================================= */
function showUpdateBar(reg) {
  if ($('#update-bar')) return;
  const b = document.createElement('div'); b.id = 'update-bar'; b.className = 'update-bar';
  b.innerHTML = `<span>A new version of Chalk is ready.</span><button class="btn sm primary" id="upd-go">Reload</button>`;
  document.body.append(b);
  $('#upd-go').onclick = async () => { await persistNow(); reg.waiting && reg.waiting.postMessage('skipWaiting'); };
}
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(reg); }); });
    setInterval(() => reg.update().catch(() => { }), 60 * 60000);
  }).catch(err => console.warn('Service worker not registered', err));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data === 'synced') refreshSyncState().then(renderStatus); });
}

/* =========================================================
   BOOT
   ========================================================= */
async function boot() {
  if (window.Chart) { Chart.defaults.font.family = 'Archivo, ui-sans-serif, system-ui, sans-serif'; Chart.defaults.font.size = 12; }
  try {
    device = await kvGet('device');
    if (!device) { device = 'phone-' + newId().replace(/-/g, '').slice(0, 6); await kvSet('device', device); }
    const recs = await storeAll('records');
    db = recs.length ? loadFromRecords(recs) : defaultData();
    persisted = new Map(recs.map(r => [r.k, JSON.stringify(r.data)]));
    let active = await kvGet('active');
    if (!active) { try { const ls = localStorage.getItem('chalk.active'); if (ls) active = JSON.parse(ls); } catch (e) { } }
    db.active = active || null; activeWritten = db.active ? JSON.stringify(db.active) : null;
    const initialized = await kvGet('initialized');
    await refreshSyncState();
    applyTheme(); registerSW();
    try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { }
    storageState = await storageInfo();
    window.addEventListener('hashchange', () => route());
    window.addEventListener('online', () => requestSync(300));
    window.addEventListener('offline', () => renderStatus());
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (initialized) rerender(); });
    setInterval(() => { if (sync.pending && navigator.onLine) requestSync(0); else renderStatus(); }, 60000);
    if (!initialized && !recs.length) { renderOnboarding(); return; }
    if (purgeTrash()) save();
    if (recs.some(r => r.k.startsWith('exercise:')) && db.exercises.length > recs.filter(r => r.k.startsWith('exercise:')).length) save(); // store newly shipped exercises
    route(); renderResume();
    requestSync(800);
    const lastPull = await kvGet('lastPull');
    if (sync.configured && navigator.onLine && (!lastPull || Date.now() - lastPull > 10 * 60000)) pullAndMerge().then(n => { if (n) { toast(`${n} change${n > 1 ? 's' : ''} from your other device`); rerender(); } }).catch(() => { });
  } catch (err) {
    console.error(err);
    view().innerHTML = `<div class="empty" style="margin-top:40px"><b>Chalk couldn’t open its storage on this phone.</b><br>${esc(err.message || err)}<br><br>Your backup in Google Sheets is not affected. Try closing and reopening the app.</div>`;
  }
}
boot();


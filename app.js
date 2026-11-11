/* ===== a1.js ===== */
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
const DEFAULT_SETTINGS = { activeProgramId: 'current-split', pos: { week: 0, day: 1 }, rest: 150, round: 2.5, bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], theme: 'auto', countWarmups: false, rx: 'm', maxHr: 190, activePlanId: null, reviewed: {}, opener: true };
function defaultData() {
  return { version: DATA_VERSION, exercises: LIBRARY.exercises.map(e => ({ ...e, custom: false })), sessions: [], trash: [], programs: libraryPrograms(), wods: [], plans: [], garmin: [], extra: {}, active: null, settings: clone(DEFAULT_SETTINGS) };
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
    if (s.kind && s.kind !== 'strength') continue;
    for (const it of (s.items || [])) {
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
  for (const it of (s.items || [])) {
    if (it.kind !== 'lift') continue;
    const p = exById(it.exerciseId).pattern;
    for (const set of it.sets) { if (!isHard(set)) continue; sets++; reps += set.r || 0; tonnage += (set.w || 0) * (set.r || 0); pats.add(p); byPat[p] = (byPat[p] || 0) + 1; }
  }
  return { sets, reps, tonnage, pats: PAT_ORDER.filter(p => pats.has(p)), byPat };
}
function sessionTitle(s) {
  if (s.kind && s.kind !== 'strength') return s.name || 'Workout';
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

/* ===== a2.js ===== */
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
function renderTodayOld() {
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
function renderHistoryOld() {
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
  const sx = db.sessions.find(x => x.id === id); if (sx && sx.kind && sx.kind !== 'strength') return openEntry({ s: sx });
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

/* ===== b0.js ===== */
/* =========================================================
   PLOMPGYM LOOK: type icons, logo, opener
   ========================================================= */
Object.assign(I, {
  bar: sv('<path d="M8.4 11.1h7.2M8.4 12.9h7.2"/><ellipse cx="6.6" cy="12" rx="1.7" ry="5.6"/><path d="M5.9 6.6H3.7a1.7 5.4 0 0 0 0 10.8h2.2"/><ellipse cx="17.4" cy="12" rx="1.7" ry="5.6"/><path d="M18.1 6.6h2.2a1.7 5.4 0 0 1 0 10.8h-2.2"/>'), wod: sv('<path d="M12 2C8.6 2.05 6.6 2.5 5.7 3.4C4.9 4.2 4.6 5.4 4.75 7C4.95 8.5 5.6 9.6 6.4 10.6C6.6 10.9 6.6 11.2 6.35 11.55C5.2 13.1 4.7 14.7 4.7 16.2C4.7 18.6 5.8 20.6 7.6 21.6C8.1 21.9 8.6 22 9.2 22H14.8C15.4 22 15.9 21.9 16.4 21.6C18.2 20.6 19.3 18.6 19.3 16.2C19.3 14.7 18.8 13.1 17.65 11.55C17.4 11.2 17.4 10.9 17.6 10.6C18.4 9.6 19.05 8.5 19.25 7C19.4 5.4 19.1 4.2 18.3 3.4C17.4 2.5 15.4 2.05 12 2Z"/><path d="M12 4.45C10 4.45 8.6 4.6 7.9 5.1C7.4 5.5 7.2 6.1 7.4 6.8C7.7 7.8 8.2 8.8 8.5 9.3C8.7 9.6 9 9.55 9.4 9.35C10.2 8.95 11.1 8.75 12 8.75C12.9 8.75 13.8 8.95 14.6 9.35C15 9.55 15.3 9.6 15.5 9.3C15.8 8.8 16.3 7.8 16.6 6.8C16.8 6.1 16.6 5.5 16.1 5.1C15.4 4.6 14 4.45 12 4.45Z"/>'), bike: sv('<circle cx="5.3" cy="15.4" r="4.4"/><circle cx="18.7" cy="15.4" r="4.4"/><path d="M5.3 15.4L9.1 8.6H15.9L11.7 15.4H5.3M15.4 6.6l3.3 8.8M8.6 6.6l.5 2M7.3 6.6h2.8M15.4 6.6h2.2a1.4 1.4 0 0 1 0 2.8h-.5"/>'), walk: sv('<circle cx="13.4" cy="4.6" r="1.7"/><path d="M9.6 21l2.3-6.2 2.7 2.5V21M7.4 11.4l2.7-3.2 3.4.7 2.1 3 2.6.9M11.9 14.8l.9-4.3"/>'),
  watch: sv('<rect x="6.5" y="6.5" width="11" height="11" rx="3"/><path d="M9 6.5L9.5 3h5l.5 3.5M9 17.5l.5 3.5h5l.5-3.5M12 9.5V12l1.5 1"/>'), heart: sv('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'), shuffle: sv('<path d="M3 7h3.5c4 0 6 10 10 10H21M3 17h3.5c1.6 0 2.8-1.6 3.8-3.6M13.7 9.6C14.7 8 15.8 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/>'), upload: sv('<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v4.5h14V15"/>'),
  sheet: sv('<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M4 9h16M4 14.5h16M10 9v11.5"/>'), undo: sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'), pause: sv('<path d="M8 5v14M16 5v14"/>', 'stroke-width="2.6"'),
});
const TYPE = { strength: { cls: 't-str', icon: I.bar, name: 'Strength' }, wod: { cls: 't-wod', icon: I.wod, name: 'WOD' }, ride: { cls: 't-ride', icon: I.bike, name: 'Ride' }, other: { cls: 't-oth', icon: I.walk, name: 'Other' } };
const ticon = (t, sm) => `<span class="ticon ${TYPE[t].cls} ${sm ? 'sm' : ''}" aria-hidden="true">${TYPE[t].icon}</span>`;
const LOGO = (size = 32, cls = 'logo') => `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g class="lg-bar"><path d="M8.6 13H9.8M15.4 13H32.6M38.2 13H39.4"/><ellipse cx="6.6" cy="13" rx="2.1" ry="6.3"/><path d="M5.9 6.8H3.6a2.1 6.2 0 0 0 0 12.4h2.3"/><ellipse cx="41.4" cy="13" rx="2.1" ry="6.3"/><path d="M42.1 6.8h2.3a2.1 6.2 0 0 1 0 12.4h-2.3"/></g>
  <g class="lg-kb"><path d="M24 4C17.2 4.1 13.2 5 11.4 6.8C9.8 8.4 9.2 10.8 9.5 14C9.9 17 11.2 19.2 12.8 21.2C13.2 21.8 13.2 22.4 12.7 23.1C10.4 26.2 9.4 29.4 9.4 32.4C9.4 37.2 11.6 41.2 15.2 43.2C16.2 43.8 17.2 44 18.4 44H29.6C30.8 44 31.8 43.8 32.8 43.2C36.4 41.2 38.6 37.2 38.6 32.4C38.6 29.4 37.6 26.2 35.3 23.1C34.8 22.4 34.8 21.8 35.2 21.2C36.8 19.2 38.1 17 38.5 14C38.8 10.8 38.2 8.4 36.6 6.8C34.8 5 30.8 4.1 24 4ZM24 8.9C20 8.9 17.2 9.2 15.8 10.2C14.8 11 14.4 12.2 14.8 13.6C15.4 15.6 16.4 17.6 17 18.6C17.4 19.2 18 19.1 18.8 18.7C20.4 17.9 22.2 17.5 24 17.5C25.8 17.5 27.6 17.9 29.2 18.7C30 19.1 30.6 19.2 31 18.6C31.6 17.6 32.6 15.6 33.2 13.6C33.6 12.2 33.2 11 32.2 10.2C30.8 9.2 28 8.9 24 8.9Z" fill="var(--bg)" fill-rule="evenodd"/></g>
  <g class="lg-wheel"><circle cx="24" cy="33.4" r="8.4"/><g class="blades"><path d="M24.00 31.60L24.00 25.00M25.56 32.50L31.27 29.20M25.56 34.30L31.27 37.60M24.00 35.20L24.00 41.80M22.44 34.30L16.73 37.60M22.44 32.50L16.73 29.20" stroke-width="1.2"/></g><circle cx="24" cy="33.4" r="1.8" fill="var(--bg)" stroke-width="1.7"/></g>
</svg>`;
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }
function netSvg() {
  const r = rng(91); const P = [...Array(28)].map(() => [r() * 400, r() * 800]);
  let lines = '';
  P.forEach((p, i) => P.forEach((q, j) => { if (j > i && Math.hypot(p[0] - q[0], p[1] - q[1]) < 120) lines += `<path d="M${p[0].toFixed(0)} ${p[1].toFixed(0)}L${q[0].toFixed(0)} ${q[1].toFixed(0)}"/>`; }));
  return `<svg class="net" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g stroke="#7FA8C9" stroke-opacity=".16" stroke-width=".8">${lines}</g><g fill="#C9A24B">${P.map((p, i) => `<circle cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="${i % 5 ? 1.4 : 2.4}" fill-opacity="${i % 5 ? .35 : .7}"/>`).join('')}</g></svg>`;
}
const drawable = (svg) => svg.replace(/<(path|rect|circle)\b/g, '<$1 pathLength="1"');
function showOpener() {
  $('.opener')?.remove();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const op = document.createElement('div'); op.className = 'opener'; op.setAttribute('role', 'img'); op.setAttribute('aria-label', 'Plompgym. Chase the plomp.');
  const col = { strength: 'var(--steel)', wod: 'var(--copper)', ride: 'var(--green)' };
  op.innerHTML = `${netSvg()}
    <div class="op-stage"><div class="op-icons">${['strength', 'wod', 'ride'].map(t => `<span class="op-icon" style="color:${col[t]}">${drawable(TYPE[t].icon)}</span>`).join('')}</div>${LOGO(150, 'op-logo')}</div>
    <div class="op-word"><div class="w">Plompgym</div><div class="t">Chase the plomp.</div><div class="rule"></div><div class="k">Lift. Swing. Ride.</div></div>
    <div class="op-skip">Tap to skip</div>`;
  document.body.append(op);
  requestAnimationFrame(() => requestAnimationFrame(() => op.classList.add('go')));
  const done = () => { if (op.classList.contains('out')) return; op.classList.add('out'); setTimeout(() => op.remove(), 720); };
  const timer = setTimeout(done, reduced ? 1500 : 7600);
  op.addEventListener('click', () => { clearTimeout(timer); done(); });
}

/* ===== a3.js ===== */
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
  if (!past) ui.pendingPicker = true;
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
  if (a.kind === 'wod') return renderWod(); if (a.kind === 'ride') return renderRide();
  const body = $('.ov-body', ov); const st = body ? body.scrollTop : 0;
  const live = a.mode === 'live';
  const titlePh = a.programRef ? (programDay(a.programRef)?.name || 'Workout') : a.mode === 'edit' ? sessionTitle(a) : 'Workout';
  let html = ''; let i = 0; let letter = 0;
  const link = (k) => { const x = a.items[k], y = a.items[k + 1]; if (!y || x.kind !== 'lift' || y.kind !== 'lift') return ''; const on = x.group && x.group === y.group;
    return `<div class="ss-link ${on ? 'on' : ''}"><button data-act="ss-toggle" data-k="${k}">${on ? I.x + 'Unlink' : I.link + 'Superset with ' + esc(exShort(y.exerciseId))}</button></div>`; };
  while (i < a.items.length) {
    const it = a.items[i];
    if (it.group && a.items[i + 1]?.group === it.group) {
      const g = it.group; let inner = '';
      while (i < a.items.length && a.items[i].group === g) { inner += itemCard(a.items[i]); if (a.items[i + 1]?.group === g) inner += link(i); i++; }
      html += `<div class="ss-wrap"><div class="ss-label"><i></i>Superset ${String.fromCharCode(65 + letter++)}</div>${inner}</div>`;
      if (i < a.items.length) html += link(i - 1);
    } else { html += itemCard(it); html += link(i); i++; }
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
  if (a.kind === 'wod' || a.kind === 'ride') { b.innerHTML = `<div><div class="t">${a.kind === 'wod' ? esc((wodById(a.wodId) || {}).name || 'WOD') : esc(a.name || 'Ride')} in progress</div><div class="s">${a.kind === 'wod' && a.stage === 'timer' ? 'Clock running' : 'Not saved yet'}</div></div><span class="go">Resume</span>`; document.body.append(b); return; }
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

/* ===== a4.js ===== */
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
function renderStrengthProgress() {
  const periods = periodsBetween(rangeStart(ui.range), new Date(), ui.gran);
  const startD = periods[0]?.start || new Date();
  const flatR = derived().flat.filter(f => f.d >= startD);
  // e1RM candidates in range
  const cnt = {}; flatR.forEach(f => { if (f.e1) cnt[f.ex] = (cnt[f.ex] || 0) + 1; });
  const cands = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  if (!ui.prEx || !cnt[ui.prEx]) ui.prEx = cands[0] || null;
  if (ui.prEx && !ui.sGroupSet) ui.sGroup = exGroup(ui.prEx);
  const inGroup = cands.filter(id => exGroup(id) === ui.sGroup).sort((a, b) => exName(a).localeCompare(exName(b), 'en', { sensitivity: 'base' }));
  const untrained = ui.sAll ? db.exercises.filter(e => exGroup(e.id) === ui.sGroup && !cnt[e.id]).map(e => e.id).sort((a, b) => exName(a).localeCompare(exName(b), 'en', { sensitivity: 'base' })) : [];
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
      <div class="block-head"><h2>Estimated 1RM</h2></div>
      <div class="seg full" style="margin-bottom:10px">${GROUPS.map(g => `<button data-act="s-group" data-v="${g}" aria-pressed="${ui.sGroup === g}">${g}</button>`).join('')}</div>
      <div class="chips" style="margin-bottom:14px">${inGroup.map(id => `<button class="chip" data-act="pr-ex" data-id="${id}" aria-pressed="${id === ui.prEx}">${esc(exName(id))}<span class="cnt">${cnt[id]}</span></button>`).join('')}${untrained.map(id => `<button class="chip dim" data-act="pr-ex" data-id="${id}" aria-pressed="${id === ui.prEx}">${esc(exName(id))}</button>`).join('')}<button class="chip ghost-chip" data-act="s-all">${ui.sAll ? 'Only trained' : 'Show all'}</button>${!inGroup.length && !untrained.length ? '<span class="small muted">No sets with RPE in this group and range.</span>' : ''}</div>
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
function renderStrengthPrograms() {
  const sel = ui.progSel && progById(ui.progSel);
  if (!sel) {
    view().innerHTML = `
      <div class="page-head"><div><h1>Plans</h1><div class="sub">Plan your weeks, then start each day with targets filled in</div></div><button class="btn sm primary" data-act="prog-new">${I.plus}New program</button></div>
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
function renderMoreBase() {
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
        <p class="small muted">Plompgym ${APP_VERSION}. ${storageLine()}</p>
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
    if (s.kind && s.kind !== 'strength') continue;
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

/* ===== b1.js ===== */
/* =========================================================
   DATA: workout kinds, WOD library, cycling plans, Garmin activities
   ========================================================= */
// session.kind: undefined/'strength' | 'wod' | 'ride'
const kindOf = (s) => s.kind || 'strength';
const wodById = (id) => (db.wods || []).find(w => w.id === id);
const planById = (id) => (db.plans || []).find(p => p.id === id);
const garminById = (id) => (db.garmin || []).find(g => g.id === String(id));
const activePlan = () => planById(db.settings.activePlanId) || (db.plans || [])[0] || null;
function gDate(g) { return new Date(g.start); }
function linkedGarminIds() { const s = new Set(); db.sessions.forEach(x => { if (x.garminId) s.add(String(x.garminId)); }); return s; }
const isIndoor = (g) => /indoor|virtual|trainer/i.test(g.type || '') || (!g.dist && g.cls === 'ride');

/* ---------- scoring ---------- */
function scoreKind(w) {
  const s = w.score || '';
  if (s === 'Time') return 'time';
  if (/^Rounds \+ repetitions$/.test(s)) return 'rr';
  if (/per interval|each block/.test(s)) return 'multi';
  if (/Total/.test(s)) return 'reps';
  if (/station|round/i.test(s)) return 'stations';
  return w.format === 'AMRAP' ? 'rr' : w.format === 'EMOM' ? 'stations' : 'time';
}
function stationsTotal(w) { const m = /(\d+) rounds/.exec(w.structure || ''); const st = w.lines.filter(l => l.pre && !/Rest/i.test(l.mv)).length || w.lines.length; return m ? +m[1] * Math.max(1, st) : st; }
function multiParts(w) { return /Four/.test(w.structure || '') ? 4 : 3; }
function repsPerRound(lines) { return (lines || []).filter(l => !l.pre).reduce((a, l) => a + (parseInt(l.reps) || 0), 0) || 1; }
function scoreText(s) {
  if (!s) return '';
  if (s.kind === 'time') return s.capped ? `Capped, ${s.reps} reps` : clock(s.time * 1000);
  if (s.kind === 'rr') return `${s.rounds} + ${s.reps || 0}`;
  if (s.kind === 'reps') return `${s.reps} reps`;
  if (s.kind === 'stations') return `${s.done}/${s.total}`;
  if (s.kind === 'multi') return (s.parts || []).map(p => `${p.rounds}+${p.reps || 0}`).join(', ');
  return '';
}
function scoreVal(log) {
  const s = log.score || {}; if (s.kind === 'time') return s.capped ? -1e6 + (s.reps || 0) : -s.time;
  if (s.kind === 'rr') return s.rounds + (s.reps || 0) / repsPerRound(log.lines);
  if (s.kind === 'reps') return s.reps; if (s.kind === 'stations') return s.done;
  if (s.kind === 'multi') return (s.parts || []).reduce((a, p) => a + p.rounds + (p.reps || 0) / 100, 0); return 0;
}
const wodLogs = (id) => db.sessions.filter(l => l.kind === 'wod' && l.wodId === id).sort((a, b) => a.date.localeCompare(b.date));
function bestOf(id, exceptId) { const ls = wodLogs(id).filter(l => l.level !== 'modified' && l.id !== exceptId); return ls.length ? ls.reduce((b, l) => scoreVal(l) > scoreVal(b) ? l : b) : null; }

/* ---------- cycling plan ---------- */
function planDone(plan) { const done = {}; if (!plan) return done; db.sessions.filter(l => l.kind === 'ride' && l.planRef && l.planRef.planId === plan.id).forEach(l => done[`${l.planRef.week}:${l.planRef.slot}`] = l); return done; }
function planNext(plan) { plan = plan || activePlan(); if (!plan) return null; const done = planDone(plan); for (let w = 0; w < plan.weeks.length; w++) for (let s = 0; s < plan.weeks[w].length; s++) if (!done[`${w + 1}:${s}`]) return { week: w + 1, slot: s, code: plan.weeks[w][s] }; return null; }
function planTimeline(plan, code) {
  const out = []; const s = plan.sessions[code]; if (!s) return out;
  for (const st of s.steps) {
    if (st.reps) {
      if (st.z && st.min) { const gap = Math.max(0, (st.min - st.reps * st.on) / st.reps); for (let i = 0; i < st.reps; i++) { out.push({ min: gap, z: st.z }); out.push({ min: st.on, z: st.onz }); } }
      else for (let i = 0; i < st.reps; i++) { out.push({ min: st.on, z: st.onz }); if (i < st.reps - 1 && st.rest) out.push({ min: st.rest, z: 'Z1' }); }
    } else out.push({ min: st.min, z: st.z || 'Z1' });
  }
  return out;
}
const durTxt = (min) => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; };
const hmin = (min) => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}:${String(m).padStart(2, '0')} h` : `${m} min`; };
function stepTxt(st) { return st.txt || `${durTxt(st.min)} @ ${st.z}`; }
function zoneBar(plan, code, tall) {
  const tl = planTimeline(plan, code); const tot = tl.reduce((a, s) => a + s.min, 0) || 1;
  const H = { Z1: 30, Z2: 50, Z3: 70, SS: 85, Z4: 85, Z5: 100 };
  return `<div class="zbar ${tall ? 'tall' : ''}">${tl.map(s => `<i style="flex:${s.min / tot};--zc:var(--${s.z.toLowerCase()})${tall ? `;height:${H[s.z] || 50}%` : ''}" title="${s.z}, ${nf(s.min)} min"></i>`).join('')}</div>`;
}
const zLegend = `<div class="zlegend">${[['z1', 'Z1 easy'], ['z2', 'Z2 endurance'], ['z3', 'Z3 tempo'], ['ss', 'Sweet spot'], ['z5', 'Z5 hard']].map(([k, l]) => `<span><i style="--zc:var(--${k})"></i>${l}</span>`).join('')}</div>`;

/* ---------- one list of everything you did ---------- */
// Logged sessions, plus Garmin activities that no logged session covers.
function allEntries() {
  const linked = linkedGarminIds(); const out = [];
  db.sessions.forEach(s => out.push({ kind: kindOf(s), date: s.date, s, g: s.garminId ? garminById(s.garminId) : null }));
  (db.garmin || []).forEach(g => { if (!linked.has(g.id)) out.push({ kind: g.cls === 'strength' ? 'strength' : g.cls, date: g.start, g, garminOnly: true }); });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
function entryTitle(e) {
  if (e.s) return kindOf(e.s) === 'strength' ? sessionTitle(e.s) : e.s.name || TYPE[e.kind].name;
  const g = e.g; const nice = { walking: 'Walk', hiking: 'Hike', running: 'Run', treadmill_running: 'Treadmill run', trail_running: 'Trail run', lap_swimming: 'Swim', open_water_swimming: 'Open water swim', hiit: 'HIIT', strength_training: 'Strength (watch only)', road_biking: 'Ride', cycling: 'Ride', indoor_cycling: 'Indoor ride', virtual_ride: 'Virtual ride', yoga: 'Yoga' };
  return nice[g.type] || g.name || cap(String(g.type || 'Activity').replace(/_/g, ' '));
}
function weekStats(monday) {
  const end = new Date(monday); end.setDate(end.getDate() + 7);
  const es = allEntries().filter(e => { const d = new Date(e.date); return d >= monday && d < end; });
  const r = { strength: 0, sets: 0, wods: 0, wodMin: 0, rides: 0, rideMin: 0, km: 0, other: 0, otherMin: 0 };
  es.forEach(e => {
    const g = e.g; const min = g ? g.dur / 60 : (e.s && e.s.duration) || 0;
    if (e.kind === 'strength') { r.strength++; if (e.s) r.sets += sessionStats(e.s).sets; }
    if (e.kind === 'wod') { r.wods++; r.wodMin += min; }
    if (e.kind === 'ride') { r.rides++; r.rideMin += min; r.km += (g && g.dist) || 0; }
    if (e.kind === 'other') { r.other++; r.otherMin += min; }
  });
  return r;
}

/* ---------- linking logged workouts to Garmin activities ---------- */
const LINK_WINDOW_MIN = 45;
const COMPAT = { strength: ['strength', 'wod'], wod: ['wod', 'strength', 'other'], ride: ['ride'] };
function garminCandidates(session, opts = {}) {
  const linked = linkedGarminIds(); const t = new Date(session.date).getTime(); const kind = kindOf(session);
  const durMs = ((session.duration || 0) * 60000);
  return (db.garmin || []).filter(g => {
    if (linked.has(g.id) && g.id !== String(session.garminId)) return false;
    if (!(COMPAT[kind] || []).includes(g.cls)) return false;
    const gs = gDate(g).getTime();
    if (opts.sameDay) return gDate(g).toDateString() === new Date(session.date).toDateString();
    return gs >= t - LINK_WINDOW_MIN * 60000 && gs <= t + durMs + LINK_WINDOW_MIN * 60000;
  }).sort((a, b) => Math.abs(gDate(a) - t) - Math.abs(gDate(b) - t));
}
function autoLink() {
  if (!db.garmin || !db.garmin.length) return 0;
  const cut = Date.now() - 14 * 864e5; let n = 0;
  db.sessions.forEach(s => {
    if (s.garminId || s.noGarmin || new Date(s.date).getTime() < cut) return;
    const c = garminCandidates(s)[0]; if (c && (kindOf(s) !== 'strength' || c.cls === 'strength')) { s.garminId = c.id; n++; }
  });
  if (n) save();
  return n;
}
/* Garmin WODs and rides from the last 14 days that nothing covers yet */
function toComplete() {
  const linked = linkedGarminIds(); const cut = Date.now() - 14 * 864e5; const rev = db.settings.reviewed || {};
  return (db.garmin || []).filter(g => (g.cls === 'wod' || g.cls === 'ride') && !linked.has(g.id) && !rev[g.id] && gDate(g).getTime() > cut)
    .sort((a, b) => b.start.localeCompare(a.start));
}

/* ===== b2.js ===== */
/* =========================================================
   WODs: library, detail, logging (stored in db.active while in progress)
   ========================================================= */
const FOR_TIME = ['For Time', 'Chipper'];
function libFilter(q, fmt, band) {
  q = (q || '').toLowerCase();
  return (db.wods || []).filter(w => (!fmt || w.format === fmt) && (!band || w.band === band) && (!q || (w.name + ' ' + (w.movements || []).join(' ') + ' ' + (w.equipment || []).join(' ')).toLowerCase().includes(q)))
    .sort((a, b) => (a.libNo || 999) - (b.libNo || 999) || a.name.localeCompare(b.name));
}
function libList(list) {
  if (!(db.wods || []).length) return `<div class="empty">No WODs yet. Tap Import to add your WOD_Library.xlsx, paste a workout, or add rows in the wod_library tab of your sheet.</div>`;
  return list.map(w => { const ls = wodLogs(w.id); const b = bestOf(w.id); return `<button class="lib-row" data-act="wod-open" data-id="${esc(w.id)}"><span><span class="fmt">${esc(w.format)}</span><span class="n">${esc(w.name)}</span>${w.own ? ' <span class="badge">Yours</span>' : ''}</span><span class="best">${b ? `<b>${scoreText(b.score)}</b>best, ${ls.length}×` : esc(String(w.band || '').replace('-', '–'))}</span><span class="m">${esc(w.structure)}. ${esc((w.movements || []).join(', '))}</span></button>`; }).join('') || '<div class="empty">No WODs match.</div>';
}
function rxOf(l) { return db.settings.rx === 'f' ? (l.f ?? l.m) : (l.m ?? l.f); }
function wodSheet(id) {
  const w = wodById(id); if (!w) return; const ls = wodLogs(id); const b = bestOf(id);
  openSheet(`<span class="fmt">${esc(w.format)}</span>${esc(w.name)}`, `
    <div class="meta-line"><span>${esc(w.structure)}</span></div>
    <ul class="rx-lines">${w.lines.map(l => `<li><span class="r">${esc(l.reps) || '–'}</span><span class="t">${l.pre ? `<span class="p">${esc(l.pre)}</span>` : ''}${esc(l.mv)}</span></li>`).join('')}</ul>
    ${(w.loads || []).length ? `<div class="pane"><h3>Rx loads</h3>${w.loads.map(l => `<div class="load-row" style="padding:6px 0"><span class="lm">${esc(l.mv)}<small>${esc(l.basis || '')}</small></span><b style="text-align:right">${nf(rxOf(l))} kg</b></div>`).join('')}</div>` : ''}
    <div class="info-grid">${[['Pacing', w.target], ['Score', w.score], ['Scaling', w.scaling], ['Coaching', w.notes]].filter(x => x[1]).map(([k, v]) => `<div><b>${k}</b>${esc(v)}</div>`).join('')}</div>
    ${ls.length ? `<div class="pane"><h3>Your results</h3>${ls.slice().reverse().map(l => `<div class="load-row" style="padding:7px 0;cursor:pointer" data-act="open-session" data-id="${l.id}"><span class="lm">${fmtDate(new Date(l.date), { day: 'numeric', month: 'short', year: 'numeric' })}<small>${l.level === 'rx' ? 'Rx' : l.level === 'scaled' ? 'Scaled' : 'Modified'}</small></span><b style="text-align:right;font-size:18px;font-stretch:75%">${scoreText(l.score)}${b === l ? ' <span class="badge pr" style="font-size:11px">Best</span>' : ''}</b></div>`).join('')}</div>` : ''}
    <div class="row" style="gap:10px;position:sticky;bottom:0;background:var(--bg2);padding:10px 0 4px"><button class="btn primary big" style="flex:1" data-act="wod-start" data-id="${esc(id)}">${I.play}Start</button><button class="btn big" data-act="wod-modify" data-id="${esc(id)}">${I.edit}Modify</button></div>`);
}

/* ---------- logging ---------- */
function startWod(id, stage, opts = {}) {
  if (guardActive()) return;
  const w = wodById(id); if (!w) return;
  const last = wodLogs(id).filter(l => l.level !== 'modified').pop();
  db.active = { kind: 'wod', id: uid(), wodId: id, stage, lines: clone(w.lines), cap: w.max, dur: w.min, scoreKind: scoreKind(w),
    loads: (w.loads || []).map(l => ({ mv: l.mv, target: rxOf(l), basis: l.basis || '', kg: (last && (last.loads || []).find(x => x.mv === l.mv) || {}).kg ?? rxOf(l) })),
    t: { start: null, elapsed: 0, running: false, rounds: 0 }, score: {}, rpe: null, notes: '', date: opts.date || localISO(new Date()), garminId: opts.garminId || null, gm: 'idle', startedAt: null };
  if (stage === 'score') prepScore(true);
  saveActive(true); closeAllSheets(); openWorkout();
}
const WA = () => db.active;
function wIsModified() { const A = WA(), w = wodById(A.wodId); return A.cap !== w.max || A.dur !== w.min || A.lines.length !== w.lines.length || A.lines.some((l, i) => l.reps !== w.lines[i].reps || l.mv !== w.lines[i].mv); }
function wChanges() {
  const A = WA(), w = wodById(A.wodId); const out = [];
  A.lines.forEach((l, i) => { const o = w.lines[i]; if (!o) out.push(`Added ${l.reps} ${l.mv}`); else { if (o.mv !== l.mv) out.push(`${o.mv} → ${l.mv}`); if (o.reps !== l.reps) out.push(`${l.mv} ${o.reps} → ${l.reps}`); } });
  if (w.lines.length > A.lines.length) out.push(`Removed ${w.lines.length - A.lines.length} line(s)`);
  if (A.cap !== w.max && FOR_TIME.includes(w.format)) out.push(`Cap ${w.max} → ${A.cap} min`);
  if (A.dur !== w.min && !FOR_TIME.includes(w.format)) out.push(`Clock ${w.min} → ${A.dur} min`);
  return out;
}
function wLevelAuto() { const A = WA(); if (wIsModified()) return 'modified'; return A.loads.every(l => (parseNum(l.kg) ?? 0) >= (l.target || 0)) ? 'rx' : 'scaled'; }
function ovHead(title, sub, right) { return `<div class="ov-head"><button class="icon-btn" data-act="wo-min" aria-label="Minimise">${I.min}</button><div class="title"><b style="font-size:17px;font-stretch:85%">${title}</b><div class="clock" id="wo-sub">${sub}</div></div>${right || ''}</div>`; }
let tickT = null;
function renderWod() {
  const A = WA(); const w = wodById(A.wodId); const ov = $('#wo'); if (!ov || !w) return;
  const body = $('.ov-body', ov); const st = body ? body.scrollTop : 0; const forTime = FOR_TIME.includes(w.format);
  destroyCharts();
  if (A.stage === 'setup' || A.stage === 'modify') {
    const mod = A.stage === 'modify';
    ov.innerHTML = ovHead(esc(w.name), `${esc(w.format)}, ${esc(w.structure)}`) + `<div class="ov-body"><div class="ov-inner">
      <div class="seg full" style="margin-bottom:14px"><button data-act="wod-stage" data-v="setup" aria-pressed="${!mod}">As written</button><button data-act="wod-stage" data-v="modify" aria-pressed="${mod}">Modify</button></div>
      ${mod ? `<div class="pane"><h3>Workout</h3>${A.lines.map((l, i) => `<div class="ed-row">${l.pre ? `<span class="pre">${esc(l.pre)}</span>` : ''}<input class="input reps" value="${esc(l.reps)}" data-wl="reps" data-i="${i}" aria-label="Reps"><input class="input" value="${esc(l.mv)}" data-wl="mv" data-i="${i}" aria-label="Movement"><button class="icon-btn" data-act="wl-del" data-i="${i}" aria-label="Remove">${I.trash}</button></div>`).join('')}
          <button class="add-set" data-act="wl-add">+ Add movement</button>
          <div class="row" style="margin-top:8px"><span class="lbl" style="flex:1">${forTime ? 'Time cap' : 'Clock'}</span><div class="kg-in" style="width:110px"><input inputmode="numeric" value="${forTime ? A.cap : A.dur}" data-wclock="1"><span>min</span></div></div>
          ${wIsModified() ? `<p class="small" style="color:var(--t-wod);margin:10px 0 0">Changed: ${wChanges().map(esc).join('; ')}. Saved as a modified result, kept apart from your Rx scores.</p><button class="btn sm ghost" data-act="wl-reset" style="margin-top:6px">Back to as written</button>` : ''}</div>`
        : `<ul class="rx-lines" style="margin-top:0">${A.lines.map(l => `<li><span class="r">${esc(l.reps) || '–'}</span><span class="t">${l.pre ? `<span class="p">${esc(l.pre)}</span>` : ''}${esc(l.mv)}</span></li>`).join('')}</ul>${w.target ? `<p class="small muted" style="margin-top:-6px">${esc(w.target)}</p>` : ''}`}
      ${A.loads.length ? `<div class="pane"><h3>Your loads</h3>${A.loads.map((l, i) => `<div class="load-row"><span class="lm">${esc(l.mv)}<small>Rx ${nf(l.target)} kg${l.basis ? ', ' + esc(l.basis) : ''}</small></span><div class="kg-in"><input inputmode="decimal" value="${nf(l.kg)}" data-wload="${i}" aria-label="Load"><span>kg</span></div></div>`).join('')}<p class="small muted" style="margin:8px 0 0">Filled in from last time. Below Rx counts as scaled.</p></div>` : ''}
      <div style="display:grid;gap:10px;margin-top:6px"><button class="btn primary big" data-act="wod-go">${I.play}Start ${w.format === 'AMRAP' ? `${A.dur}-min clock` : w.format === 'EMOM' ? `${A.dur}-min EMOM` : forTime ? `clock, ${A.cap}-min cap` : 'clock'}</button>
      <button class="btn big" data-act="wod-skip">Skip the clock, just log my score</button></div>
      <p class="small muted" style="text-align:center">Your Garmin keeps recording as usual; it links after you save.</p>
      <div style="text-align:center"><button class="btn ghost danger" data-act="wo-discard">Discard</button></div>
    </div></div>`;
    $('.ov-body', ov).scrollTop = st; return;
  }
  if (A.stage === 'timer') {
    const mode = A.mode = ['AMRAP', 'Mixed Blocks', 'Intervals'].includes(w.format) ? 'down' : w.format === 'EMOM' ? 'emom' : 'up';
    ov.innerHTML = ovHead(esc(w.name), A.t.running ? 'Running' : 'Paused', `<button class="btn primary sm" data-act="wod-finish">Finish</button>`) + `<div class="ov-body"><div class="timer">
      <div class="lbl" id="t-lbl"></div><div class="clock" id="t-clock">0:00</div>
      ${mode === 'emom' ? `<div class="station" id="t-station"></div>` : `<div class="rounds">Rounds<b id="t-rounds">${A.t.rounds}</b></div><button class="round-btn" data-act="t-round">+1 round</button>`}
      <div class="row"><button class="btn" data-act="t-pause">${A.t.running ? I.pause + 'Pause' : I.play + 'Resume'}</button>${mode !== 'emom' ? `<button class="btn ghost" data-act="t-undo">${I.undo}Undo round</button>` : ''}</div>
      <div class="mini">${A.lines.map(l => `${esc(l.reps)} ${esc(l.mv)}`).join(', ')}</div>
    </div></div>`;
    tick(); return;
  }
  // score
  const k = A.scoreKind; const s = A.score; const lvl = A.level || wLevelAuto();
  let inputs = '';
  if (k === 'time') inputs = s.capped ? `<div class="score-in"><div class="f"><label>Reps completed at the cap</label><input inputmode="numeric" value="${s.reps ?? ''}" data-sc="reps" style="width:140px"></div></div>` : `<div class="score-in"><div class="f"><label>Minutes</label><input inputmode="numeric" value="${s.min ?? ''}" data-sc="min"></div><span class="sep">:</span><div class="f"><label>Seconds</label><input inputmode="numeric" value="${s.sec ?? ''}" data-sc="sec"></div></div>`;
  if (k === 'rr') inputs = `<div class="score-in"><div class="f"><label>Rounds</label><input inputmode="numeric" value="${s.rounds ?? ''}" data-sc="rounds"></div><span class="sep">+</span><div class="f"><label>Extra reps</label><input inputmode="numeric" value="${s.reps ?? ''}" data-sc="reps"></div></div>`;
  if (k === 'reps') inputs = `<div class="score-in"><div class="f"><label>Total reps</label><input inputmode="numeric" value="${s.reps ?? ''}" data-sc="reps" style="width:140px"></div></div>`;
  if (k === 'stations') inputs = `<div class="score-in"><div class="f"><label>Completed</label><input inputmode="numeric" value="${s.done ?? ''}" data-sc="done"></div><span class="sep">/</span><div class="f"><label>Total</label><input value="${s.total}" disabled></div></div>`;
  if (k === 'multi') inputs = s.parts.map((p, i) => `<div class="score-in" style="margin-bottom:8px"><span class="lbl" style="width:62px;padding-bottom:18px">${/Four/.test(w.structure) ? 'Interval' : 'Block'} ${i + 1}</span><div class="f"><label>Rounds</label><input inputmode="numeric" value="${p.rounds ?? ''}" data-sp="rounds" data-i="${i}"></div><span class="sep">+</span><div class="f"><label>Reps</label><input inputmode="numeric" value="${p.reps ?? ''}" data-sp="reps" data-i="${i}"></div></div>`).join('');
  const best = bestOf(A.wodId);
  ov.innerHTML = ovHead(esc(w.name), 'Log your score', `<button class="btn primary sm" data-act="wod-save">Save</button>`) + `<div class="ov-body"><div class="ov-inner">
    <div class="field"><label for="w-date">Date and time</label><input id="w-date" class="input" type="datetime-local" data-wdate="1" value="${esc(A.date)}"></div>
    <div class="pane"><h3>Score <span class="muted small" style="font-weight:500">${esc(w.score)}</span></h3>${inputs}
      ${k === 'time' ? `<label class="row small" style="margin-top:10px"><input type="checkbox" data-chk="capped" ${s.capped ? 'checked' : ''}> Hit the ${A.cap}-min cap</label>` : ''}
      ${best ? `<p class="small muted" style="margin:10px 0 0">Your best: <b style="color:var(--ink)">${scoreText(best.score)}</b>, ${fmtDate(new Date(best.date), { day: 'numeric', month: 'short', year: 'numeric' })}</p>` : ''}</div>
    <div class="pane"><h3>How you did it</h3><div class="seg full">${[['rx', 'Rx'], ['scaled', 'Scaled'], ['modified', 'Modified']].map(([v, l]) => `<button data-act="wod-level" data-v="${v}" aria-pressed="${lvl === v}">${l}</button>`).join('')}</div>
      ${A.loads.map((l, i) => `<div class="load-row"><span class="lm">${esc(l.mv)}<small>Rx ${nf(l.target)} kg</small></span><div class="kg-in"><input inputmode="decimal" value="${nf(l.kg)}" data-wload="${i}"><span>kg</span></div></div>`).join('')}
      ${wIsModified() ? `<p class="small" style="color:var(--t-wod);margin:8px 0 0">Changed: ${wChanges().map(esc).join('; ')}</p>` : ''}</div>
    <div class="pane"><h3>Effort</h3><div class="rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button data-act="rpe" data-v="${n}" aria-pressed="${A.rpe === n}">${n}</button>`).join('')}</div><div class="rpe-cap"><span>Easy</span><span>All out</span></div></div>
    <div id="gm-pane">${garminPane(A)}</div>
    <div class="field"><label>Notes</label><textarea class="input" data-notes="1" placeholder="Pacing, what broke down, how it felt">${esc(A.notes)}</textarea></div>
    <div style="text-align:center"><button class="btn ghost danger" data-act="wo-discard">Discard</button></div>
  </div></div>`;
  $('.ov-body', ov).scrollTop = st;
  afterGarminPane(ov);
}
/* shared by WOD and ride logs: look for Garmin once, then fill the linked card's detail */
function afterGarminPane(ov) {
  const A = WA();
  if (A.garminId) { const g = garminById(A.garminId); if (g) fillGarminDetail(ov, g, 'live'); return; }
  if (A.gm === 'idle' && sync.configured && navigator.onLine) {
    A.gm = 'checking'; $('#gm-pane').innerHTML = garminPane(A);
    garminCheckNow(true).finally(() => { if (!db.active || db.active !== A) return; A.gm = 'ready'; const p = $('#gm-pane'); if (p) { p.innerHTML = garminPane(A); if (A.garminId) afterGarminPane($('#wo')); } });
  }
}
function tick() {
  clearInterval(tickT);
  const upd = () => {
    const A = WA(); if (!A || A.kind !== 'wod' || A.stage !== 'timer' || !$('#t-clock')) return clearInterval(tickT);
    const el = A.t.elapsed + (A.t.running ? (Date.now() - A.t.start) / 1000 : 0);
    const w = wodById(A.wodId); let shown = el, lbl = '';
    if (A.mode === 'down') { shown = Math.max(0, A.dur * 60 - el); lbl = `${A.dur}-minute ${w.format === 'AMRAP' ? 'AMRAP' : 'clock'}, time left`; if (shown <= 0) return finishTimer(); }
    if (A.mode === 'up') { lbl = `For time, cap ${A.cap}:00`; if (el >= A.cap * 60) { A.capped = true; return finishTimer(); } }
    if (A.mode === 'emom') {
      const min = Math.floor(el / 60); shown = 60 - (el % 60); const st = A.lines.filter(l => l.pre && !/rest/i.test(l.mv)); const all = A.lines.filter(l => l.pre); const list = all.length ? all : A.lines; const cur = list[min % list.length];
      lbl = `Minute ${min + 1} of ${A.dur}`; const s = $('#t-station'); if (s && cur) s.textContent = `${cur.reps} ${cur.mv}`.trim(); if (el >= A.dur * 60) return finishTimer();
      if (A.lastBeep !== min) { A.lastBeep = min; if (min > 0) { beep(); try { navigator.vibrate && navigator.vibrate(120); } catch (e) { } } }
    }
    const c = $('#t-clock'); if (c) c.textContent = clock(shown * 1000 + (A.mode === 'up' ? 0 : 999)); const l = $('#t-lbl'); if (l) l.textContent = lbl;
  };
  upd(); tickT = setInterval(upd, 250);
}
function finishTimer() {
  const A = WA(); clearInterval(tickT); if (A.t.running) { A.t.elapsed += (Date.now() - A.t.start) / 1000; A.t.running = false; }
  const w = wodById(A.wodId); const k = A.scoreKind; A.duration = Math.round(A.t.elapsed / 60);
  if (k === 'time') A.score = A.capped ? { capped: true } : { min: Math.floor(A.t.elapsed / 60), sec: Math.round(A.t.elapsed % 60) };
  if (k === 'rr') A.score = { rounds: A.t.rounds };
  if (k === 'stations') A.score = { total: stationsTotal(w), done: stationsTotal(w) };
  if (k === 'reps') A.score = {};
  if (k === 'multi') A.score = { parts: [...Array(multiParts(w))].map(() => ({})) };
  A.stage = 'score'; beep(); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
  saveActive(true); renderWod();
}
function prepScore(noRender) {
  const A = WA(); const w = wodById(A.wodId); const k = A.scoreKind;
  A.score = k === 'stations' ? { total: stationsTotal(w), done: null } : k === 'multi' ? { parts: [...Array(multiParts(w))].map(() => ({})) } : {};
  if (!A.garminId && !A.startedAt) { const d = new Date(Date.now() - (w.max || 20) * 60000); A.date = localISO(d); }
  A.stage = 'score'; if (!noRender) { saveActive(true); renderWod(); }
}
function saveWod() {
  const A = WA(); const w = wodById(A.wodId); const k = A.scoreKind; const s = A.score; let score;
  const n = (v) => parseInt(v) || 0;
  if (k === 'time') score = s.capped ? { kind: 'time', capped: true, reps: n(s.reps) } : { kind: 'time', time: n(s.min) * 60 + n(s.sec) };
  if (k === 'rr') score = { kind: 'rr', rounds: n(s.rounds), reps: n(s.reps) };
  if (k === 'reps') score = { kind: 'reps', reps: n(s.reps) };
  if (k === 'stations') score = { kind: 'stations', done: n(s.done), total: s.total };
  if (k === 'multi') score = { kind: 'multi', parts: s.parts.map(p => ({ rounds: n(p.rounds), reps: n(p.reps) })) };
  if ((k === 'time' && !s.capped && !score.time) || (k === 'rr' && !score.rounds && !score.reps) || (k === 'reps' && !score.reps)) { toast('Enter your score first'); return; }
  const g = A.garminId ? garminById(A.garminId) : null;
  const sess = { id: A.id || uid(), kind: 'wod', date: A.date, wodId: A.wodId, name: w.name + (wIsModified() ? ' (modified)' : ''), format: w.format, lines: clone(A.lines), cap: A.cap, dur: A.dur, changes: wChanges(), level: A.level || wLevelAuto(), score,
    loads: A.loads.map(l => ({ mv: l.mv, kg: parseNum(l.kg) ?? 0, target: l.target })), rpe: A.rpe, notes: A.notes, garminId: A.garminId || null, duration: A.duration || (g ? Math.round(g.dur / 60) : null) };
  const i = db.sessions.findIndex(x => x.id === sess.id); if (i >= 0) db.sessions[i] = sess; else db.sessions.push(sess);
  db.sessions.sort((a, b) => b.date.localeCompare(a.date));
  db.active = null; clearInterval(tickT); closeAllSheets(); minimizeWorkout();
  saveNow().then(() => { toast('WOD saved on this phone'); rerender(); openEntry({ s: sess }); });
}

/* ===== b3.js ===== */
/* =========================================================
   CYCLING: plan, ride log
   ========================================================= */
function planView() {
  const plans = db.plans || [];
  if (!plans.length) return `<div class="empty">No cycling plan yet. Tap Import and pick the cycling plan template from the package (your current 10-week plan is already in it), or add rows to the cycling_plans tab of your sheet.</div>`;
  const plan = activePlan(); const done = planDone(plan); const nx = planNext(plan); const total = plan.weeks.flat().length; const n = Object.keys(done).length;
  return `${plans.length > 1 ? `<div class="chips" style="margin-bottom:12px">${plans.map(p => `<button class="chip" data-act="plan-pick" data-id="${esc(p.id)}" aria-pressed="${p.id === plan.id}">${esc(p.name)}</button>`).join('')}</div>` : ''}
    <div class="panel" style="margin-bottom:18px"><div class="row" style="gap:12px">${ticon('ride')}<div><h2>${esc(plan.name)}</h2><div class="small muted">${plan.weeks.length} weeks. Cross-training days are covered by your strength and WOD sessions.</div></div></div>
      <div class="pbar"><i style="width:${n / total * 100}%"></i></div><div class="small muted">${n} of ${total} rides done${nx ? `, now in week ${nx.week}` : ', plan complete'}</div></div>
    <div>${plan.weeks.map((wk, wi) => `<div class="pweek ${nx && nx.week === wi + 1 ? 'cur' : ''}"><span class="wk">Week ${wi + 1}</span><div class="pchips">${wk.map((c, si) => { const d = done[`${wi + 1}:${si}`]; const isN = nx && nx.week === wi + 1 && nx.slot === si; const s = plan.sessions[c] || { name: c, min: 0 };
      return `<button class="pchip ${d ? 'done' : ''} ${isN ? 'next' : ''}" data-act="${d ? 'open-session' : 'ride-session'}" data-id="${d ? d.id : ''}" data-code="${esc(c)}" data-week="${wi + 1}" data-slot="${si}"><b>${esc(s.name.replace(/ ride$/i, '').replace('High cadence', 'Cadence'))}</b><span>${d ? 'Done ' + fmtDate(new Date(d.date), { day: 'numeric', month: 'short' }) : durTxt(s.min)}</span></button>`; }).join('')}</div></div>`).join('')}</div>
    ${zLegend}`;
}
function rideSessionSheet(code, week, slot) {
  const plan = activePlan(); const s = plan.sessions[code]; if (!s) return;
  openSheet(esc(s.name), `<div class="meta-line"><span>${durTxt(s.min)}</span>${week ? `<span>Week ${week}, ride ${+slot + 1}</span>` : ''}</div>
    ${zoneBar(plan, code, true)}${zLegend}
    <ul class="steps">${s.steps.map(st => `<li><span>${esc(st.k)}</span><span>${esc(stepTxt(st))}</span></li>`).join('')}</ul>
    <p class="small muted">Zones follow your Garmin heart-rate zones. Sweet spot sits between Z3 and Z4.</p>
    <button class="btn primary block" data-act="ride-start" data-week="${week || ''}" data-slot="${slot ?? ''}" data-code="${esc(code)}">${I.bike}Log this ride</button>`);
}
function startRide(opts = {}) {
  if (guardActive()) return;
  const plan = activePlan(); let ref = null, name = 'Ride', code = opts.code || null;
  if (plan && opts.week && opts.slot !== '' && opts.slot != null) { code = code || plan.weeks[opts.week - 1][opts.slot]; ref = { planId: plan.id, planName: plan.name, week: +opts.week, slot: +opts.slot, code }; name = plan.sessions[code].name; }
  else if (plan && code && plan.sessions[code]) name = plan.sessions[code].name;
  const g = opts.garminId ? garminById(opts.garminId) : null;
  db.active = { kind: 'ride', id: uid(), planRef: ref, code, name, indoor: g ? isIndoor(g) : false, rpe: null, notes: '', gm: 'idle', garminId: opts.garminId || null,
    date: g ? g.start : localISO(new Date(Date.now() - ((plan && code && plan.sessions[code] ? plan.sessions[code].min : 60) + 10) * 60000)) };
  saveActive(true); closeAllSheets(); openWorkout();
}
function renderRide() {
  const A = WA(); const ov = $('#wo'); if (!ov) return; const body = $('.ov-body', ov); const st = body ? body.scrollTop : 0; destroyCharts();
  const plan = activePlan(); const s = plan && A.code ? plan.sessions[A.code] : null; const nx = planNext(plan);
  ov.innerHTML = ovHead(esc(A.name), A.planRef ? `Plan week ${A.planRef.week}, ride ${A.planRef.slot + 1}` : 'Ride', `<button class="btn primary sm" data-act="ride-save">Save</button>`) + `<div class="ov-body"><div class="ov-inner">
    <div class="field"><label for="r-date">Date and time</label><input id="r-date" class="input" type="datetime-local" data-wdate="1" value="${esc(A.date)}"></div>
    ${s ? `<div class="pane"><h3>Planned, ${durTxt(s.min)}</h3>${zoneBar(plan, A.code, true)}<ul class="steps">${s.steps.map(x => `<li><span>${esc(x.k)}</span><span>${esc(stepTxt(x))}</span></li>`).join('')}</ul></div>`
      : plan && nx ? `<div class="pane"><h3>Count it towards your plan?</h3><p class="small muted" style="margin-top:0">Next in ${esc(plan.name)}: week ${nx.week}, ${esc(plan.sessions[nx.code].name)} ${durTxt(plan.sessions[nx.code].min)}.</p><button class="btn sm" data-act="ride-plan" data-week="${nx.week}" data-slot="${nx.slot}">Count as that ride</button></div>` : ''}
    <div class="seg full" style="margin-bottom:14px"><button data-act="ride-in" data-v="0" aria-pressed="${!A.indoor}">Outdoor</button><button data-act="ride-in" data-v="1" aria-pressed="${A.indoor}">Indoor</button></div>
    <div id="gm-pane">${garminPane(A)}</div>
    ${A.garminId && s && garminById(A.garminId) ? `<div class="pane"><h3>Planned and done</h3>${planVsDone(plan, A.code, garminById(A.garminId))}</div>` : ''}
    <div class="pane"><h3>Effort</h3><div class="rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button data-act="rpe" data-v="${n}" aria-pressed="${A.rpe === n}">${n}</button>`).join('')}</div><div class="rpe-cap"><span>Easy</span><span>All out</span></div></div>
    <div class="field"><label>Notes</label><textarea class="input" data-notes="1" placeholder="Wind, legs, nutrition, anything to remember">${esc(A.notes)}</textarea></div>
    <div style="text-align:center"><button class="btn ghost danger" data-act="wo-discard">Discard</button></div>
  </div></div>`;
  $('.ov-body', ov).scrollTop = st;
  afterGarminPane(ov);
}
function planVsDone(plan, code, g) {
  if (!g || !g.zones) return `<p class="small muted" style="margin:0">Zone times appear once Garmin’s heart-rate data is in.</p>`;
  const tl = planTimeline(plan, code); const pl = [0, 0, 0, 0, 0]; const map = { Z1: 0, Z2: 1, Z3: 2, SS: 3, Z4: 3, Z5: 4 }; tl.forEach(s => pl[map[s.z]] += s.min);
  const done = g.zones.map(z => z / 60);
  return `<div class="cmp"><span class="h">Zone</span><span class="h">Planned</span><span class="h">Done (heart rate)</span>${[0, 1, 2, 3, 4].map(i => `<span><i class="plate" style="--c:var(--z${i + 1});width:10px;height:10px"></i> Z${i + 1}</span><span>${pl[i] ? durTxt(pl[i]) : '–'}</span><span>${done[i] >= .5 ? durTxt(done[i]) : '–'}</span>`).join('')}</div>`;
}
function saveRide() {
  const A = WA(); const g = A.garminId ? garminById(A.garminId) : null;
  const sess = { id: A.id || uid(), kind: 'ride', date: A.date, planRef: A.planRef, code: A.code, name: A.name, indoor: A.indoor, rpe: A.rpe, notes: A.notes, garminId: A.garminId || null, duration: g ? Math.round(g.dur / 60) : null };
  const i = db.sessions.findIndex(x => x.id === sess.id); if (i >= 0) db.sessions[i] = sess; else db.sessions.push(sess);
  db.sessions.sort((a, b) => b.date.localeCompare(a.date));
  db.active = null; closeAllSheets(); minimizeWorkout();
  saveNow().then(() => { toast('Ride saved on this phone'); rerender(); openEntry({ s: sess }); });
}

/* ===== b4.js ===== */
/* =========================================================
   GARMIN in the app
   ========================================================= */
const gStatus = { data: null, at: 0 };
async function garminCall(body, timeout) { const cfg = await kvGet('backup'); if (!cfg) throw new Error('Connect your Google Sheet backup first'); return backupCall(cfg, body, timeout || 60000); }
async function refreshGarminStatus() {
  try { const j = await garminCall({ action: 'garminStatus' }, 20000); gStatus.data = j.garmin; gStatus.at = Date.now(); await kvSet('garminStatus', j.garmin); } catch (e) { }
  return gStatus.data;
}
/* ask the script to look for activities from the last 3 days right now, then pull and link */
async function garminCheckNow(quiet) {
  if (!sync.configured || !navigator.onLine) return 0;
  try {
    const j = await garminCall({ action: 'garminRecent' }, 45000);
    if (!j.ok && !quiet) toast(j.error || 'Garmin check failed');
    const n = await pullAndMerge(); const linked = autoLink();
    if (!quiet && (n || linked)) toast(linked ? `Linked ${linked} workout${linked > 1 ? 's' : ''} to Garmin` : 'Garmin activities updated');
    return n;
  } catch (e) { if (!quiet) toast(e.message); return 0; }
}

/* ---------- metrics card ---------- */
function garminMetrics(g) {
  const m = [['Time', clock(g.dur * 1000)]];
  if (g.dist) m.push(['Distance', nf(g.dist) + ' km']);
  if (g.avgHr) m.push(['Avg HR', g.avgHr + ' bpm']); if (g.maxHr) m.push(['Max HR', g.maxHr + ' bpm']);
  if (g.kcal) m.push(['Calories', g.kcal + ' kcal']); if (g.speed && g.dist) m.push(['Avg speed', nf(g.speed) + ' km/h']);
  if (g.elev) m.push(['Elevation', g.elev + ' m']); if (g.cad) m.push(['Cadence', g.cad + ' rpm']); if (g.power) m.push(['Avg power', g.power + ' W']);
  return m;
}
function garminBlock(g, opts = {}) {
  const tot = g.zones ? g.zones.reduce((a, b) => a + b, 0) : 0;
  return `<div class="gm" data-gid="${g.id}">
    <div class="gm-h"><span class="w">${I.watch}</span><div><b>${esc(g.name || entryTitle({ g }))}</b><small>Garmin, ${fmtDate(gDate(g), { weekday: 'short', day: 'numeric', month: 'short' })}, ${gDate(g).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small></div>${opts.unlink ? `<span class="spacer"></span><button class="btn sm ghost" data-act="gm-unlink">Unlink</button>` : ''}</div>
    <div class="metrics">${garminMetrics(g).map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
    <div class="gm-detail" id="gd-${opts.cid || 'g'}"><div class="searching" style="margin-top:12px"><span class="spin"></span>Loading heart rate${g.cls === 'ride' || g.dist ? ' and route' : ''}…</div></div>
    ${tot ? `<div class="lbl" style="margin-top:10px">Time in heart-rate zones</div><div class="zbar" style="margin-top:6px;height:14px">${g.zones.map((z, i) => z ? `<i style="flex:${z / tot};--zc:var(--z${i + 1})" title="Z${i + 1}: ${clock(z * 1000)}"></i>` : '').join('')}</div>
    <div class="zlegend">${g.zones.map((z, i) => `<span><i style="--zc:var(--z${i + 1})"></i>Z${i + 1} ${Math.round(z / tot * 100)}%</span>`).join('')}</div>` : ''}
  </div>`;
}
async function loadGarminDetail(g) {
  const key = 'gd:' + g.id; let d = await kvGet(key);
  if (!d) {
    if (!sync.configured || !navigator.onLine) return null;
    try { const j = await garminCall({ action: 'activityDetail', id: g.id }, 120000); if (!j.ok) throw new Error(j.error); d = j.detail; await kvSet(key, d); }
    catch (e) { return { error: e.message }; }
  }
  return d;
}
/* fill the chart and route of a garmin card once its detail arrives */
async function fillGarminDetail(root, g, cid, reg) {
  const box = $(`#gd-${cid}`, root); if (!box) return;
  const d = await loadGarminDetail(g);
  if (!box.isConnected) return;
  if (!d) { box.innerHTML = `<p class="small muted" style="margin:10px 0 0">Heart-rate curve and route load when you’re online.</p>`; return; }
  if (d.error) { box.innerHTML = `<p class="small muted" style="margin:10px 0 0">No detail yet: ${esc(d.error)}</p>`; return; }
  box.innerHTML = `${d.route && d.route.length > 2 ? routeSvg(d.route) : ''}${d.hr && d.hr.some(v => v != null) ? `<div class="chart-box sm" style="height:150px"><canvas></canvas></div>` : ''}`;
  const cv = $('canvas', box); if (!cv || !window.Chart) return;
  const labels = d.hr.map((_, i) => clock(i * (d.step || 10) * 1000));
  const ds = [{ label: 'Heart rate', data: d.hr, borderColor: cssVar('--z5'), borderWidth: 1.5, pointRadius: 0, tension: .3, yAxisID: 'y', spanGaps: true }];
  if (d.alt && d.alt.some(v => v != null)) ds.push({ label: 'Elevation', data: d.alt, borderColor: 'transparent', backgroundColor: cssVar('--raise'), fill: true, pointRadius: 0, tension: .3, yAxisID: 'y2', spanGaps: true });
  const ch = new Chart(cv, { type: 'line', data: { labels, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw == null ? null : ` ${c.dataset.label}: ${c.raw}${c.datasetIndex ? ' m' : ' bpm'}` } } }, scales: { x: { ticks: { maxTicksLimit: 5, color: cssVar('--muted') }, grid: { display: false } }, y: { ticks: { maxTicksLimit: 4, color: cssVar('--muted') }, grid: { color: cssVar('--line') } }, y2: { display: false } } } });
  (reg || charts).push(ch);
}
function routeSvg(pts) {
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length; const k = Math.cos(lat0 * Math.PI / 180);
  const xy = pts.map(p => [p[1] * k, -p[0]]); const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 340, H = 180, pad = 14; const sc = Math.min((W - 2 * pad) / ((x1 - x0) || 1e-9), (H - 2 * pad) / ((y1 - y0) || 1e-9));
  const ox = pad + ((W - 2 * pad) - (x1 - x0) * sc) / 2, oy = pad + ((H - 2 * pad) - (y1 - y0) * sc) / 2;
  const P = xy.map(([x, y]) => [ox + (x - x0) * sc, oy + (y - y0) * sc]);
  const d = 'M' + P.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
  return `<svg class="route" viewBox="0 0 ${W} ${H}" role="img" aria-label="Route"><path d="${d}" fill="none" stroke="var(--t-ride)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${P[0][0].toFixed(1)}" cy="${P[0][1].toFixed(1)}" r="5" fill="var(--bg)" stroke="var(--gold)" stroke-width="2.5"/></svg>`;
}

/* ---------- Garmin pane inside the WOD and ride log ---------- */
// A.gm: 'idle' | 'checking' | 'ready' ; A.garminId: linked id ; A.noGarmin
function garminPane(A) {
  const when = new Date(A.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (A.garminId) { const g = garminById(A.garminId); if (g) return garminBlock(g, { unlink: true, cid: 'live' }); }
  if (!sync.configured) return `<div class="gm"><div class="gm-h"><span class="w">${I.watch}</span><div><b>Garmin</b><small>Connect your Google Sheet backup in More to bring in Garmin data</small></div></div></div>`;
  if (A.gm === 'checking') return `<div class="gm"><div class="gm-h"><span class="w">${I.watch}</span><div><b>Garmin</b><small>Looking for an activity around ${when}</small></div></div><div class="searching"><span class="spin"></span>Checking Garmin Connect…</div></div>`;
  const sess = { kind: A.kind, date: A.date, duration: A.duration || 0 };
  const c = garminCandidates(sess); const day = garminCandidates(sess, { sameDay: true }).filter(g => !c.includes(g));
  const row = (g) => `<div class="gm-found"><div style="flex:1;min-width:0"><b>${esc(entryTitle({ g }))}</b><div class="small muted">${gDate(g).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, ${clock(g.dur * 1000)}${g.dist ? `, ${nf(g.dist)} km` : ''}${g.avgHr ? `, ${g.avgHr} bpm` : ''}${g.kcal ? `, ${g.kcal} kcal` : ''}</div></div><button class="btn sm primary" data-act="gm-link" data-gid="${g.id}">Link</button></div>`;
  return `<div class="gm"><div class="gm-h"><span class="w">${I.watch}</span><div><b>${c.length ? 'Garmin activity found' : 'Garmin'}</b><small>${c.length ? 'It started close to this workout' : 'Nothing found yet. It links by itself after your watch syncs.'}</small></div></div>
    ${c.slice(0, 2).map(row).join('')}
    ${day.length ? `<details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">Other activities that day (${day.length})</summary><div style="display:grid;gap:6px;margin-top:6px">${day.map(row).join('')}</div></details>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="gm-check">${I.watch}Check Garmin now</button></div></div>`;
}

/* ---------- history import (3 years) ---------- */
async function startGarminImport(years) {
  try { const j = await garminCall({ action: 'garminStart', years }, 30000); if (!j.ok) throw new Error(j.error); gStatus.data = j.garmin; await kvSet('garminStatus', j.garmin); db.settings.garminImportStarted = Date.now(); save(); toast('Garmin import started; it runs in your Google account'); rerender(); pollGarmin(); }
  catch (e) { toast(e.message); }
}
let pollT = null;
function pollGarmin() {
  clearTimeout(pollT);
  pollT = setTimeout(async () => {
    const st = await refreshGarminStatus();
    if (st && sync.configured) { await pullAndMerge().catch(() => { }); autoLink(); if (ui.view === 'today' && !$('#wo')) rerender(); }
    if (st && st.running) pollGarmin();
  }, 30000);
}
function garminImportCard() {
  const st = gStatus.data;
  if (!sync.configured) return '';
  if (st && !st.configured) return '';
  if (!db.settings.garminImportStarted && !(st && st.since)) {
    return `<div class="banner"><div><b>Bring in your Garmin history.</b> Three years of activities, with heart rate and routes, saved in your Drive.</div><button class="btn sm primary" data-act="gm-import">Start import</button></div>`;
  }
  if (st && st.running) {
    const pct = st.total ? Math.round(st.detailed / st.total * 100) : 0;
    return `<div class="banner"><div style="flex:1;min-width:200px"><b>Importing Garmin history</b><div class="small muted">${st.total} activities found${st.listedDone ? '' : ' so far'}, ${st.detailed} with heart rate and route. You can keep using the app.</div><div class="pbar" style="margin-top:8px"><i style="width:${pct}%"></i></div></div></div>`;
  }
  return '';
}
function garminSummary() {
  const by = {}; (db.garmin || []).forEach(g => { const k = entryTitle({ g }); by[k] = (by[k] || 0) + 1; });
  return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k === k.toUpperCase() ? k : k.toLowerCase()}${n > 1 && !/s$/.test(k) ? 's' : ''}`).join(', ');
}

/* ===== b5.js ===== */
/* =========================================================
   IMPORT: WODs, cycling plans, strength programs
   Adding never overwrites: an item that exists with different content arrives as a new version.
   ========================================================= */
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
function parseLine(l) {
  l = String(l).trim(); let pre = '';
  const m1 = /^((?:Minute \d+|Odd minutes|Even minutes|Block \d+|After each round|After every round|After every \d+ completed rounds|Within each interval|Interval \d+)):\s*(.*)$/i.exec(l);
  if (m1) { pre = m1[1]; l = m1[2]; }
  const m = /^(\d+(?:[-–]\d+)*(?:\.\.\.)?(?:\s?m)?)\s+(.*)$/.exec(l);
  return m ? { pre, reps: m[1], mv: m[2] } : { pre, reps: '', mv: l };
}
const bandOf = (max) => max <= 15 ? '10-15 min' : max <= 24 ? '16-24 min' : '25-40 min';
function parseSteps(s) { // same grammar as the sync script
  return String(s || '').split('|').map(x => x.trim()).filter(Boolean).map(x => {
    let m = /^(.+?)\s+(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s+(Z[1-5]|SS)(?:\s+rest\s+(\d+(?:[.,]\d+)?))?$/i.exec(x);
    if (m) { const reps = +m[2], on = parseNum(m[3]), rest = m[5] ? parseNum(m[5]) : 0, z = m[4].toUpperCase(); return { k: m[1], reps, on, onz: z, rest, min: reps * on + (reps - 1) * rest, txt: `${reps}× ${nf(on)} min @ ${z === 'SS' ? 'sweet spot' : z}${rest ? `, ${nf(rest)} min easy between` : ''}` }; }
    m = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(Z[1-5]|SS)\s+incl\s+(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s+(Z[1-5]|SS)$/i.exec(x);
    if (m) return { k: m[1], min: parseNum(m[2]), z: m[3].toUpperCase(), reps: +m[4], on: parseNum(m[5]), onz: m[6].toUpperCase(), txt: `${m[2]} min incl. ${m[4]}× ${m[5]} min @ ${m[6].toUpperCase()}` };
    m = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(Z[1-5]|SS)$/i.exec(x);
    if (m) return { k: m[1], min: parseNum(m[2]), z: m[3].toUpperCase() };
    return { k: x, min: 0, z: 'Z1' };
  });
}
/* ---------- turning tables into records ---------- */
function wodsFromRows(rows) { // template layout (same columns as the wod_library tab)
  return rows.filter(o => o.name && o.movements).map(o => {
    const lines = String(o.movements).split('|').map(s => s.trim()).filter(Boolean).map(parseLine);
    const loads = String(o.rx_loads_kg || '').split(/[;|]/).map(s => s.trim()).filter(Boolean).map(s => { const m = /^(.*?)[=:]?\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?$/i.exec(s); return m ? { mv: m[1].trim(), m: parseNum(m[2]), f: null, basis: '' } : null; }).filter(Boolean);
    const fmt = String(o.format || 'For Time'); const clockMin = Number(o.clock_min) || null, capMin = Number(o.cap_min) || null; const max = capMin || clockMin || 15;
    return { id: o.id ? String(o.id) : 'w-' + slug(o.name), name: String(o.name), format: fmt, structure: String(o.structure || ''), min: clockMin || capMin || 15, max, score: String(o.score || (fmt === 'AMRAP' ? 'Rounds + repetitions' : fmt === 'EMOM' ? 'Completed stations' : 'Time')),
      lines, loads, target: String(o.pacing || ''), scaling: String(o.scaling || ''), notes: String(o.notes || ''), band: bandOf(max), movements: lines.map(l => l.mv), equipment: [], own: true };
  });
}
function wodsFromWorkbook(wb) { // your WOD_Library.xlsx: Workout Library + Target Weights tabs
  const ws = wb.Sheets['Workout Library']; if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); const hi = rows.findIndex(r => r.includes('Workout Name')); if (hi < 0) return null;
  const H = rows[hi]; const c = (n) => H.indexOf(n);
  const loads = {}; const tw = wb.Sheets['Target Weights'];
  if (tw) { const tr = XLSX.utils.sheet_to_json(tw, { header: 1, defval: '' }); const th = tr.findIndex(r => r[0] === 'WOD #'); tr.slice(th + 1).forEach(r => { if (typeof r[0] === 'number') (loads[r[0]] = loads[r[0]] || []).push({ mv: String(r[2]), impl: String(r[3]), m: Number(r[4]) || null, f: Number(r[5]) || null, basis: String(r[6] || '') }); }); }
  return rows.slice(hi + 1).filter(r => r[c('Workout Name')]).map(r => {
    const no = Number(r[c('WOD #')]) || null; const name = String(r[c('Workout Name')]);
    const lines = String(r[c('Workout Prescription')] || '').split('\n').map(s => s.trim()).filter(Boolean).map(parseLine);
    const min = Number(r[c('Est. Min')]) || 15, max = Number(r[c('Est. Max')]) || min;
    return { id: 'w-' + slug(name), libNo: no, name, format: String(r[c('Format')]), band: String(r[c('Duration Band')] || bandOf(max)), min, max, structure: String(r[c('Structure')] || ''), lines,
      target: String(r[c('Target / Pacing')] || ''), score: String(r[c('Score')] || ''), focus: String(r[c('Primary Focus')] || ''), movements: String(r[c('Movements')] || '').split('|').map(s => s.trim()).filter(Boolean),
      equipment: String(r[c('Equipment')] || '').split(',').map(s => s.trim()).filter(Boolean), scaling: String(r[c('Scaling / Alternatives')] || ''), notes: String(r[c('Coaching Notes')] || ''), loads: loads[no] || [] };
  });
}
function planFromRows(rows) {
  const byPlan = {}; rows.forEach(o => { if (o.plan) (byPlan[o.plan] = byPlan[o.plan] || []).push(o); });
  return Object.keys(byPlan).map(name => {
    const sessions = {}, sig = {}, weeks = [];
    byPlan[name].forEach(o => {
      const key = [o.name, o.minutes, o.steps].join('|'); let code = sig[key];
      if (!code) { code = String.fromCharCode(65 + Object.keys(sig).length); sig[key] = code; sessions[code] = { code, name: String(o.name), min: Number(o.minutes) || 60, steps: parseSteps(o.steps) }; }
      const w = Number(o.week) || 1, s = Number(o.ride) || 1; (weeks[w - 1] = weeks[w - 1] || [])[s - 1] = code;
    });
    return { id: 'p-' + slug(name), name: String(name), weeks: weeks.map(w => (w || []).filter(Boolean)), sessions };
  });
}
function exerciseIdFor(name) {
  const n = String(name || '').trim(); if (!n) return 'accessory-other';
  const hit = db.exercises.find(e => e.name.toLowerCase() === n.toLowerCase() || e.id === slug(n)); if (hit) return hit.id;
  const e = { id: slug(n), name: cap(n), pattern: 'OT', primary: [], secondary: [], bw: false, custom: true }; db.exercises.push(e); return e.id;
}
function programsFromRows(rows) {
  const by = {}; rows.forEach(o => { if (o.program) (by[o.program] = by[o.program] || []).push(o); });
  return Object.keys(by).map(name => {
    const weeks = [];
    by[name].forEach(o => {
      const w = Number(o.week) || 1, d = Number(o.day) || 1;
      const wk = weeks[w - 1] = weeks[w - 1] || { name: 'Week ' + w, days: [] };
      const day = wk.days[d - 1] = wk.days[d - 1] || { name: String(o.day_name || 'Day ' + d), note: '', items: [] };
      day.items.push({ id: uid(), exerciseId: exerciseIdFor(o.exercise), note: String(o.note || ''), group: o.superset ? 'g' + o.superset : null, sets: parseScheme(String(o.reps || ''), String(o.rpe || '')) });
    });
    return { id: 'sp-' + slug(name), name: String(name), desc: 'Imported ' + fmtDate(new Date(), { day: 'numeric', month: 'short', year: 'numeric' }), weeks: weeks.filter(Boolean).map(w => ({ name: w.name, days: w.days.filter(Boolean) })) };
  });
}
/* records from the sync script arrive with exercise names; give them real exercise ids */
function normalizeProgram(p) {
  p.weeks.forEach(w => w.days.forEach(d => d.items.forEach(it => { if (it.exerciseName) { it.exerciseId = exerciseIdFor(it.exerciseName); delete it.exerciseName; } if (!it.id) it.id = uid(); })));
  return p;
}
const sameContent = (a, b) => { const strip = (o) => { const c = clone(o); delete c.id; delete c.superseded; delete c.version; return JSON.stringify(c); }; return strip(a) === strip(b); };
function addVersioned(list, item) {
  const old = list.find(x => x.id === item.id && !x.superseded) || list.find(x => x.id === item.id);
  if (!old) { list.push(item); return 'added'; }
  if (sameContent(old, item)) return 'same';
  const n = (old.version || 1) + 1; old.superseded = true; item.id = item.id.replace(/-v\d+$/, '') + '-v' + n; item.version = n; list.push(item); return 'version';
}
function mergeLibrary(kind, items) {
  const list = kind === 'wod' ? (db.wods = db.wods || []) : kind === 'plan' ? (db.plans = db.plans || []) : db.programs;
  const res = { added: 0, same: 0, version: 0 };
  items.forEach(it => res[addVersioned(list, it)]++);
  if (kind === 'plan' && !db.settings.activePlanId && db.plans.length) db.settings.activePlanId = db.plans.find(p => !p.superseded).id;
  return res;
}
/* ---------- reading files ---------- */
let xlsxLoading = null;
function loadXlsx() { if (window.XLSX) return Promise.resolve(); return xlsxLoading || (xlsxLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = res; s.onerror = () => { xlsxLoading = null; rej(new Error('Could not load the spreadsheet reader')); }; document.head.append(s); })); }
async function readTable(file) {
  await loadXlsx();
  const wb = /\.csv$/i.test(file.name) ? XLSX.read(await file.text(), { type: 'string', raw: true }) : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return wb;
}
function rowsOf(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const hi = rows.findIndex(r => r.some(c => String(c).trim())); if (hi < 0) return [];
  const H = rows[hi].map(h => String(h).trim().toLowerCase());
  return rows.slice(hi + 1).filter(r => r.some(c => String(c).trim())).map(r => Object.fromEntries(H.map((h, i) => [h, r[i]])));
}
async function importFile(kind, file) {
  const out = $('#imp-out'); if (out) out.innerHTML = `<div class="searching"><span class="spin"></span>Reading ${esc(file.name)}…</div>`;
  try {
    const wb = await readTable(file); let items = null;
    if (kind === 'wod') items = wodsFromWorkbook(wb) || wodsFromRows(rowsOf(wb));
    if (kind === 'plan') items = planFromRows(rowsOf(wb));
    if (kind === 'program') items = programsFromRows(rowsOf(wb));
    if (!items || !items.length) throw new Error(kind === 'plan' ? 'No plan rows found. Use the cycling plan template: plan, week, ride, name, minutes, steps.' : kind === 'program' ? 'No program rows found. Use the strength program template.' : 'No workouts found. Use your WOD_Library.xlsx or the WOD template.');
    const r = mergeLibrary(kind, items); await saveNow();
    const what = kind === 'wod' ? 'workouts' : kind === 'plan' ? 'plans' : 'programs';
    if (out) out.innerHTML = `<div class="gm"><b>${r.added} new ${what} added</b><div class="small muted">${r.same ? `${r.same} already in your library. ` : ''}${r.version ? `${r.version} arrived as a new version; the old ones are kept.` : ''}</div></div>`;
    toast(`${r.added + r.version} ${what} imported`);
  } catch (e) { if (out) out.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
/* ---------- paste a WOD ---------- */
function parseWodText(txt) {
  const L = String(txt || '').split(/\n/).map(s => s.trim()).filter(Boolean); if (!L.length) return null;
  const fmtRe = /amrap|emom|every|for time|rounds|chipper|\d+-\d+-\d+/i; let name = 'My WOD', i = 0;
  if (!fmtRe.test(L[0])) { name = L[0]; i = 1; }
  const structure = L[i] && fmtRe.test(L[i]) ? L[i++] : 'For time'; const s = structure.toLowerCase();
  const format = /amrap/.test(s) ? 'AMRAP' : /emom|every minute/.test(s) ? 'EMOM' : /every \d+/.test(s) ? 'Intervals' : /chipper/.test(s) ? 'Chipper' : 'For Time';
  const num = (re) => { const m = re.exec(s); return m ? +m[1] : null; };
  const clk = num(/(\d+)\s*-?\s*min(?:ute)?s?\s*(?:amrap|emom)/) ?? num(/(?:amrap|emom)\s*(\d+)/); const capMin = num(/cap\D*(\d+)/) ?? num(/(\d+)\s*min(?:ute)?s?\s*cap/);
  const rr = /^(\d+(?:-\d+)+)/.exec(structure);
  const lines = L.slice(i).map(l => { const m = /^(\d+(?:[-–]\d+)*)\s*(?:x\s*)?(.*)$/i.exec(l); return m ? { pre: '', reps: m[1], mv: m[2] } : { pre: '', reps: rr ? rr[1] : '', mv: l }; });
  const loads = []; lines.forEach(l => { const m = /(\d+(?:[.,]\d+)?)\s*kg/i.exec(l.mv); if (m) { l.mv = l.mv.replace(m[0], '').trim(); loads.push({ mv: l.mv, m: parseNum(m[1]), f: null, basis: 'from your text' }); } });
  const timed = format === 'AMRAP' || format === 'EMOM'; const min = timed ? (clk || 12) : 10, max = timed ? (clk || 12) : (capMin || 20);
  return { id: 'w-' + slug(name), name, format, structure, lines, loads, min, max, band: bandOf(max), score: format === 'AMRAP' ? 'Rounds + repetitions' : format === 'EMOM' ? 'Completed stations' : 'Time', target: '', movements: lines.map(l => l.mv), equipment: [], scaling: '', notes: '', own: true };
}
function pastePreview() {
  const w = parseWodText(ui.paste); if (!w) return '';
  return `<div class="gm" style="margin:12px 0 0"><div class="row"><span class="fmt">${esc(w.format)}</span><b style="font-size:17px;font-stretch:85%">${esc(w.name)}</b></div><div class="small muted" style="margin:4px 0 6px">${esc(w.structure)}${/\d+\s*min/i.test(w.structure) ? '' : FOR_TIME.includes(w.format) ? `, cap ${w.max} min` : `, ${w.max} min`}</div>
    <ul class="rx-lines" style="margin:0">${w.lines.map(l => `<li><span class="r">${esc(l.reps) || '–'}</span><span class="t">${esc(l.mv)}</span></li>`).join('')}</ul>
    ${w.loads.length ? `<p class="small" style="margin:8px 0 0">Rx load: ${w.loads.map(l => `${esc(l.mv)} ${nf(l.m)} kg`).join(', ')}</p>` : ''}
    <button class="btn primary block" style="margin-top:12px" data-act="paste-add">${I.plus}Add to my library</button></div>`;
}
/* ---------- the import sheet ---------- */
function importSheet(kind) { ui.impKind = kind || ui.impKind || 'wod'; ui.paste = ''; openSheet('Import', `<div id="imp">${importBody()}</div>`); }
function importBody() {
  const K = ui.impKind;
  const tab = K === 'wod' ? 'wod_library' : K === 'plan' ? 'cycling_plans' : 'strength_programs';
  return `<div class="seg full" style="margin-bottom:14px">${[['wod', 'WODs'], ['plan', 'Cycling plan'], ['program', 'Strength program']].map(([k, l]) => `<button data-act="imp-kind" data-v="${k}" aria-pressed="${K === k}">${l}</button>`).join('')}</div>
    ${K === 'wod' ? `<div class="pane"><h3>Paste a workout</h3><textarea class="input" rows="5" data-paste="1" placeholder="Garage Fran&#10;21-15-9 for time, 10 min cap&#10;Thrusters 40 kg&#10;Pull-ups"></textarea><p class="small muted" style="margin:6px 0 0">First line the name, second the format, then one movement per line.</p><div id="paste-prev"></div></div>` : ''}
    <div class="pane"><h3>From a file</h3><p class="small" style="margin-top:0">${K === 'wod' ? 'Your <b>WOD_Library.xlsx</b> as it is, or the WOD template (CSV or Excel).' : K === 'plan' ? 'The cycling plan template: one row per ride with plan, week, ride, name, minutes and steps.' : 'The strength program template: one row per exercise with program, week, day, exercise, reps and RPE.'}</p>
      <label class="btn primary">${I.upload}Choose file<input type="file" accept=".xlsx,.xls,.csv" data-impfile="${K}" hidden></label><div id="imp-out" style="margin-top:12px"></div></div>
    <div class="pane"><h3>From your laptop</h3><p class="small" style="margin:0">Add rows to the <b>${tab}</b> tab of your Plompgym data sheet, or drop a CSV or Google Sheet in Drive, Plompgym, Import. They reach this phone within 30 minutes. Excel files: import them here instead.</p></div>`;
}

/* ===== b6.js ===== */
/* =========================================================
   VIEWS: Today, History, Plans, Progress, entry details, More
   ========================================================= */
const GROUPS = ['Hinge', 'Legs', 'Pull', 'Push', 'Abs', 'Arms'];
function exGroup(id) {
  const e = exById(id); const p = e.pattern; const pr = e.primary || [];
  if (id === 'leg-curl') return 'Legs';
  if (p === 'HI') return 'Hinge'; if (p === 'SQ') return 'Legs'; if (p === 'HL' || p === 'VL') return 'Pull'; if (p === 'HP' || p === 'VP') return 'Push';
  if (pr.includes('core')) return 'Abs'; if (pr.includes('calves') || pr.includes('quads') || pr.includes('hamstrings') || pr.includes('glutes')) return 'Legs';
  if (id === 'lateral-raise' || id === 'cable-fly' || pr.includes('chest')) return 'Push'; if (id === 'rear-delt-fly' || pr.includes('back')) return 'Pull';
  return 'Arms';
}
Object.assign(ui, { hist: 'all', progTab: 'strength', plansTab: 'strength', libQ: '', libFmt: null, libBand: null, progWod: null, sGroup: 'Hinge', impKind: 'wod', paste: '' });

/* ---------- rows ---------- */
function entryRow(e) {
  const d = new Date(e.date); const g = e.g; const s = e.s; let right = '', sub = '';
  if (e.kind === 'strength') { if (s) { const st = sessionStats(s); right = `<b>${st.sets}</b>sets`; sub = st.tonnage ? ton(st.tonnage) : ''; } else { right = `<b>${hmin(g.dur / 60)}</b>watch`; } }
  if (e.kind === 'wod') { if (s) { right = `<b>${scoreText(s.score)}</b>${s.level === 'rx' ? 'Rx' : s.level}`; sub = s.format || ''; } else { right = `<b>${hmin(g.dur / 60)}</b>no score`; } }
  if (e.kind === 'ride') { const km = g && g.dist; right = km ? `<b>${nf(km)} km</b>${hmin(g.dur / 60)}` : g ? `<b>${hmin(g.dur / 60)}</b>indoor` : `<b>–</b>no Garmin`; sub = s && s.planRef ? `Plan week ${s.planRef.week}` : ''; }
  if (e.kind === 'other') { right = g.dist ? `<b>${nf(g.dist)} km</b>${hmin(g.dur / 60)}` : `<b>${hmin(g.dur / 60)}</b>`; }
  const hr = g && g.avgHr ? `<span>${I.heart.replace('<svg', '<svg width="12" height="12" style="vertical-align:-1px"')} ${g.avgHr}</span>` : '';
  const kc = g && g.kcal ? `<span>${g.kcal} kcal</span>` : '';
  const act = s ? `data-act="open-session" data-id="${s.id}"` : `data-act="open-garmin" data-id="${g.id}"`;
  return `<button class="srow" ${act}>
    <div class="date"><div class="dd">${d.getDate()}</div><div class="mm">${fmtDate(d, { month: 'short' })}</div></div>
    <div style="min-width:0;display:flex;gap:10px;align-items:center">${ticon(e.kind, true)}<div style="min-width:0"><div class="t">${esc(entryTitle(e))}</div><div class="m">${sub ? `<span>${esc(sub)}</span>` : ''}${hr}${kc}${e.garminOnly && (e.kind === 'wod' || e.kind === 'ride') ? '<span>from Garmin</span>' : ''}</div></div></div>
    <div class="hist-r">${right}</div></button>`;
}

/* ---------- TODAY ---------- */
function renderToday() {
  const now = new Date(); const mon = mondayOf(now); const ws = weekStats(mon); const tc = toComplete();
  const prog = progById(db.settings.activeProgramId); let strCard = '';
  if (prog) { const pos = db.settings.pos; const wk = prog.weeks[pos.week]; const day = wk?.days[pos.day];
    if (day) strCard = `<div class="ncard">${ticon('strength')}<div style="min-width:0"><div class="eb">${esc(prog.name)}, ${esc(wk.name)}, day ${pos.day + 1}</div><div class="tt">${esc(day.name)}</div><div class="sub">${day.items.map(it => `${esc(exShort(it.exerciseId))} ${esc(rxStr(it.sets))}`).join(', ')}</div></div>
      <div class="acts"><button class="btn primary" data-act="start-next">${I.play}Start</button><button class="btn" data-act="pick-day">Other day</button></div></div>`; }
  const plan = activePlan(); const nx = planNext(plan); const s = nx && plan.sessions[nx.code];
  const rideCard = s ? `<div class="ncard">${ticon('ride')}<div style="min-width:0"><div class="eb">${esc(plan.name)}, week ${nx.week}, ride ${nx.slot + 1} of ${plan.weeks[nx.week - 1].length}</div><div class="tt">${esc(s.name)} ${durTxt(s.min)}</div><div class="sub" style="margin-bottom:8px">${s.steps.map(stepTxt).map(esc).join(', ')}</div>${zoneBar(plan, nx.code)}</div>
      <div class="acts"><button class="btn primary" data-act="ride-start" data-week="${nx.week}" data-slot="${nx.slot}">${I.bike}Log this ride</button><button class="btn" data-act="ride-session" data-code="${esc(nx.code)}" data-week="${nx.week}" data-slot="${nx.slot}">Details</button></div></div>` : '';
  const lastW = db.sessions.find(x => x.kind === 'wod');
  const wodCard = `<div class="ncard">${ticon('wod')}<div><div class="eb">WOD library, ${(db.wods || []).filter(w => !w.superseded).length} workouts</div><div class="tt">Pick a WOD</div><div class="sub">${lastW ? `Last: ${esc(lastW.name)}, ${scoreText(lastW.score)}` : 'Import your WOD library in Plans to get started'}</div></div>
      <div class="acts"><button class="btn" data-act="goto-lib">Browse</button><button class="btn" data-act="wod-random">${I.shuffle}Random</button></div></div>`;
  const expires = gStatus.data && gStatus.data.keyExpires ? new Date(gStatus.data.keyExpires) : null;
  const keyWarn = expires && expires - Date.now() < 21 * 864e5 ? `<div class="banner bad"><div><b>Your Garmin key ${expires < new Date() ? 'has expired' : 'expires ' + fmtDate(expires, { day: 'numeric', month: 'long' })}.</b> Create a new one in Garmin Connect and replace GARMIN_API_KEY in the script settings.</div></div>` : '';
  const gErr = gStatus.data && gStatus.data.configured && gStatus.data.lastError ? `<div class="banner bad"><div><b>Garmin sync problem:</b> ${esc(gStatus.data.lastError)}</div></div>` : '';
  view().innerHTML = `
    <div class="brandline">${LOGO(34)}<span>Plompgym</span></div>
    <div class="page-head"><div><h1>${fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</h1><div class="sub">Week ${isoWeek(now).w}</div></div>${syncPill()}</div>
    ${backupBanner()}${keyWarn}${gErr}${garminImportCard()}
    ${tc.length ? `<section class="block"><div class="block-head"><h2>To complete</h2><span class="small muted">From your Garmin, last 14 days</span></div><div class="list">${tc.map(g => `<div class="srow tc-row" style="cursor:default"><div class="date"><div class="dd">${gDate(g).getDate()}</div><div class="mm">${fmtDate(gDate(g), { month: 'short' })}</div></div>
      <div style="min-width:0;display:flex;gap:10px;align-items:center">${ticon(g.cls, true)}<div style="min-width:0"><div class="t">${esc(entryTitle({ g }))}</div><div class="m"><span>${clock(g.dur * 1000)}</span>${g.dist ? `<span>${nf(g.dist)} km</span>` : ''}${g.avgHr ? `<span>${g.avgHr} bpm</span>` : ''}</div></div></div>
      <div class="tc-acts"><button class="btn sm primary" data-act="${g.cls === 'wod' ? 'tc-wod' : 'tc-ride'}" data-id="${g.id}">${g.cls === 'wod' ? 'Log score' : 'Log ride'}</button><button class="btn sm ghost" data-act="tc-keep" data-id="${g.id}">Keep as is</button></div></div>`).join('')}</div></section>` : ''}
    <h2 style="margin-bottom:12px">Up next</h2>
    <div class="next">${strCard}${rideCard}${wodCard}</div>
    <section class="block"><div class="block-head"><h2>This week</h2><a class="btn ghost sm" href="#progress">Progress</a></div>
      <div class="kpis4" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi"><div class="v">${ws.sets}</div><div class="l">Strength sets</div></div>
        <div class="kpi"><div class="v">${ws.wods}</div><div class="l">WODs, ${Math.round(ws.wodMin)} min</div></div>
        <div class="kpi"><div class="v">${nf(ws.km, 0)}<span style="font-size:16px"> km</span></div><div class="l">${ws.rides} ride${ws.rides === 1 ? '' : 's'}, ${hmin(ws.rideMin)}</div></div>
        <div class="kpi"><div class="v">${Math.round(ws.otherMin)}</div><div class="l">Other minutes</div></div>
      </div></section>
    <section class="block"><div class="block-head"><h2>Recent</h2><a class="btn ghost sm" href="#history">All history</a></div>
      <div class="list">${allEntries().slice(0, 5).map(entryRow).join('') || '<div class="empty">Your workouts show up here.</div>'}</div></section>`;
}

/* ---------- HISTORY ---------- */
function renderHistory() {
  const q = (ui.histQ || '').trim().toLowerCase();
  let list = allEntries().filter(e => ui.hist === 'all' || e.kind === ui.hist);
  if (q) list = list.filter(e => entryTitle(e).toLowerCase().includes(q) || (e.s && ((e.s.notes || '').toLowerCase().includes(q) || (e.s.items || []).some(i => (i.kind === 'lift' ? exName(i.exerciseId) : '').toLowerCase().includes(q)))));
  const groups = []; let cur = null;
  for (const e of list) { const w = isoWeek(new Date(e.date)); if (!cur || cur.key !== w.key) { cur = { key: w.key, w, items: [] }; groups.push(cur); } cur.items.push(e); }
  const shown = q ? groups.slice(0, 40) : groups.slice(0, ui.histLimit);
  view().innerHTML = `
    <div class="page-head"><div><h1>History</h1><div class="sub">${db.sessions.length} logged workouts, ${(db.garmin || []).length} Garmin activities</div></div><button class="btn sm" data-act="log-past">${I.plus}Log past strength</button></div>
    <div class="chips" style="margin-bottom:10px">${[['all', 'All'], ['strength', 'Strength'], ['wod', 'WOD'], ['ride', 'Ride'], ['other', 'Other']].map(([k, l]) => `<button class="chip" data-act="hist-f" data-v="${k}" aria-pressed="${ui.hist === k}">${k !== 'all' ? `<span class="ticon ${TYPE[k].cls}" style="display:inline-grid">${TYPE[k].icon.replace('<svg', '<svg style="width:18px;height:18px"')}</span>` : ''}${l}</button>`).join('')}</div>
    <input class="input" type="search" placeholder="Filter by name, exercise or note" value="${esc(ui.histQ || '')}" data-hf="q" aria-label="Filter history">
    <div class="list" style="margin-top:6px">${shown.map(g => `<div class="week-h"><h3>Week ${g.w.w}, ${g.w.y}</h3><span>${g.items.length} activit${g.items.length > 1 ? 'ies' : 'y'}</span></div>${g.items.map(entryRow).join('')}`).join('') || `<div class="empty" style="margin-top:14px">${q ? 'Nothing matches that filter.' : 'Nothing here yet.'}</div>`}</div>
    ${!q && groups.length > ui.histLimit ? `<div style="text-align:center;margin-top:18px"><button class="btn" data-act="hist-more">Show older weeks</button></div>` : ''}`;
}

/* ---------- entry details ---------- */
function openEntry(e) {
  const s = e.s; const g = e.g || (s && s.garminId ? garminById(s.garminId) : null);
  const kind = s ? kindOf(s) : (g.cls === 'strength' ? 'strength' : g.cls);
  if (s && kind === 'strength') {
    sessionDetail(s.id);
    if (g) { const rec = topSheet(); const acts = rec.sh.querySelector('.sh-body > .row.wrap:last-child'); (acts ? acts : rec.sh.querySelector('.sh-body').lastElementChild).insertAdjacentHTML(acts ? 'beforebegin' : 'afterend', garminBlock(g, { cid: 'd' })); fillGarminDetail(rec.sh, g, 'd', rec.charts); }
    return;
  }
  const when = fmtDate(new Date(e.date || s.date), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let body = '', title = esc(entryTitle({ s, g, kind }));
  if (s && kind === 'wod') {
    const w = wodById(s.wodId) || { lines: [], loads: [], format: s.format, structure: '' }; const best = bestOf(s.wodId, s.id); const all = wodLogs(s.wodId).filter(x => x.level !== 'modified');
    const isPR = s.level !== 'modified' && (!best || scoreVal(s) > scoreVal(best)) && all.length > 1;
    const prev = wodLogs(s.wodId).filter(x => x.date < s.date && x.level !== 'modified').pop();
    body = `<div class="meta-line"><span>${when}</span><span>${esc(s.format || '')}${w.structure ? ', ' + esc(w.structure) : ''}</span></div>
      <div class="row wrap" style="align-items:flex-end;gap:14px;margin:8px 0 6px"><span class="score-big">${scoreText(s.score)}</span><span class="badge ${s.level === 'rx' ? 'ink' : 'wod'}">${s.level === 'rx' ? 'Rx' : s.level === 'scaled' ? 'Scaled' : 'Modified'}</span>${isPR ? '<span class="badge pr">Best ever</span>' : ''}</div>
      <div class="vs">${s.level === 'modified' ? 'Modified version: kept separate from your Rx and scaled results.' : prev ? `Last time ${scoreText(prev.score)} (${fmtDate(new Date(prev.date), { day: 'numeric', month: 'short' })})${best && best !== prev ? `, best ${scoreText(best.score)}` : ''}` : 'First time logged'}</div>
      <ul class="rx-lines">${(s.lines || []).map((ln, i) => { const o = w.lines[i]; const ch = !o || o.reps !== ln.reps || o.mv !== ln.mv; return `<li class="${ch && w.lines.length ? 'chg' : ''}"><span class="r">${esc(ln.reps)}</span><span class="t">${ln.pre ? `<span class="p">${esc(ln.pre)}</span>` : ''}${esc(ln.mv)}</span></li>`; }).join('')}</ul>
      ${(s.changes || []).length ? `<p class="small" style="color:var(--t-wod);margin-top:-6px">Changes: ${s.changes.map(esc).join('; ')}</p>` : ''}
      ${(s.loads || []).length ? `<div class="pane"><h3>Loads</h3>${s.loads.map(x => `<div class="load-row" style="padding:6px 0"><span class="lm">${esc(x.mv)}${x.target ? `<small>Rx ${nf(x.target)} kg</small>` : ''}</span><b style="text-align:right;font-size:18px;font-stretch:75%">${nf(x.kg)} kg</b></div>`).join('')}</div>` : ''}
      <div class="meta-line">${s.rpe ? `<span>Effort <b>${s.rpe}/10</b></span>` : ''}${s.notes ? `<span>${esc(s.notes)}</span>` : ''}</div>
      ${g ? garminBlock(g, { cid: 'd' }) : `<p class="small muted">No Garmin activity linked.</p>`}
      <div class="row wrap"><button class="btn" data-act="wod-start" data-id="${esc(s.wodId)}">${I.play}Do it again</button><span class="spacer"></span><button class="btn ghost danger" data-act="sess-del" data-id="${s.id}">${I.trash}Delete</button></div>`;
  } else if (s && kind === 'ride') {
    const plan = s.planRef ? planById(s.planRef.planId) : null; const ps = plan && s.code ? plan.sessions[s.code] : null;
    body = `<div class="meta-line"><span>${when}</span>${s.planRef ? `<span>${esc(s.planRef.planName || '')} week ${s.planRef.week}, ride ${s.planRef.slot + 1}</span>` : '<span>Not from the plan</span>'}<span>${s.indoor ? 'Indoor' : 'Outdoor'}</span></div>
      ${ps ? `<div class="pane"><h3>Planned: ${esc(ps.name)}, ${durTxt(ps.min)}</h3>${zoneBar(plan, s.code)}${planVsDone(plan, s.code, g)}</div>` : ''}
      ${g ? garminBlock(g, { cid: 'd' }) : `<p class="small muted">No Garmin activity linked yet. It links by itself once your watch syncs.</p>`}
      <div class="meta-line">${s.rpe ? `<span>Effort <b>${s.rpe}/10</b></span>` : ''}${s.notes ? `<span>${esc(s.notes)}</span>` : ''}</div>
      <div class="row wrap"><span class="spacer"></span><button class="btn ghost danger" data-act="sess-del" data-id="${s.id}">${I.trash}Delete</button></div>`;
  } else {
    body = `<div class="meta-line"><span>${when}</span><span>Recorded on your Garmin</span></div>${garminBlock(g, { cid: 'd' })}
      ${g.cls === 'wod' ? `<button class="btn primary block" data-act="tc-wod" data-id="${g.id}">Log which WOD and your score</button>` : g.cls === 'ride' ? `<button class="btn primary block" data-act="tc-ride" data-id="${g.id}">Log as a ride${activePlan() ? ' in your plan' : ''}</button>` : ''}`;
  }
  const rec = openSheet(title, body);
  if (g) fillGarminDetail(rec.sh, g, 'd', rec.charts);
}
function wodPicker(onPick, title) {
  ui.pickWodCb = onPick; ui.pickWodQ = '';
  openSheet(title || 'Which WOD?', `<input class="input" type="search" placeholder="Search WODs" data-wpq="1" autofocus><div id="wpick" class="list" style="margin-top:8px">${wodPickList()}</div>`);
}
function wodPickList() { return libFilter(ui.pickWodQ).filter(w => !w.superseded).map(w => `<button class="lib-row" data-act="wpick" data-id="${esc(w.id)}"><span><span class="fmt">${esc(w.format)}</span><span class="n">${esc(w.name)}</span></span><span class="best"></span><span class="m">${esc(w.structure)}</span></button>`).join('') || '<div class="empty">Import your WOD library first.</div>'; }

/* ---------- PLANS ---------- */
function renderPrograms() {
  const tab = ui.plansTab;
  const seg = `<div class="seg full" style="margin-bottom:18px">${[['strength', 'Strength'], ['cycling', 'Cycling'], ['wod', 'WODs']].map(([k, l]) => `<button data-act="plans-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>`;
  const imp = `<button class="btn sm" data-act="import" data-v="${tab === 'cycling' ? 'plan' : tab === 'wod' ? 'wod' : 'program'}">${I.upload}Import</button>`;
  if (tab === 'strength') {
    renderStrengthPrograms();
    const ph = $('#view .page-head');
    if (ph && !ui.progSel) { ph.insertAdjacentHTML('afterend', seg); ph.insertAdjacentHTML('beforeend', imp); }
    return;
  }
  let body = '';
  if (tab === 'cycling') body = planView();
  else body = `<div class="row wrap" style="margin-bottom:10px"><input class="input" style="flex:1;min-width:200px" type="search" placeholder="Search name, movement or equipment" value="${esc(ui.libQ)}" data-lib="q"><button class="btn" data-act="wod-random">${I.shuffle}Random</button></div>
      <div class="chips scroll" style="margin-bottom:8px">${[null, 'AMRAP', 'For Time', 'EMOM', 'Intervals', 'Chipper', 'Mixed Blocks'].map(f => `<button class="chip" data-act="lib-fmt" data-v="${f || ''}" aria-pressed="${ui.libFmt === f}">${f || 'All formats'}</button>`).join('')}</div>
      <div class="chips scroll" style="margin-bottom:6px">${[null, '10-15 min', '16-24 min', '25-40 min'].map(f => `<button class="chip" data-act="lib-band" data-v="${f || ''}" aria-pressed="${ui.libBand === f}">${f ? f.replace('-', '–') : 'Any length'}</button>`).join('')}</div>
      <div class="list" id="lib-list">${libList(libFilter(ui.libQ, ui.libFmt, ui.libBand).filter(w => !w.superseded))}</div>`;
  view().innerHTML = `<div class="page-head"><div><h1>Plans</h1><div class="sub">Strength programs, your cycling plan and WOD library</div></div>${imp}</div>${seg}${body}`;
}

/* ---------- PROGRESS ---------- */
function progressSeg() { return `<div class="seg full" style="margin-bottom:18px">${[['strength', 'Strength'], ['wod', 'WOD'], ['ride', 'Cycling'], ['other', 'Other']].map(([k, l]) => `<button data-act="prog-tab" data-v="${k}" aria-pressed="${ui.progTab === k}">${l}</button>`).join('')}</div>`; }
function weeksBack(n) { const out = []; for (let i = n - 1; i >= 0; i--) { const m = mondayOf(new Date()); m.setDate(m.getDate() - 7 * i); const e = new Date(m); e.setDate(e.getDate() + 7); out.push({ mon: m, end: e }); } return out; }
function baseOpts2(stacked, fmt) {
  return { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } },
    scales: { x: { stacked, grid: { display: false }, ticks: { color: cssVar('--muted'), maxTicksLimit: 8 } }, y: { stacked, beginAtZero: true, grid: { color: cssVar('--line') }, border: { display: false }, ticks: { color: cssVar('--muted'), maxTicksLimit: 5, callback: fmt } } } };
}
function renderProgress() {
  if (ui.progTab === 'strength') { renderStrengthProgress(); const ph = $('#view .page-head'); if (ph) ph.insertAdjacentHTML('afterend', progressSeg()); return; }
  const head = `<div class="page-head"><div><h1>Progress</h1><div class="sub">Per activity type</div></div></div>${progressSeg()}`;
  if (ui.progTab === 'wod') {
    const wl = db.sessions.filter(l => l.kind === 'wod'); const d30 = Date.now() - 30 * 864e5; const last30 = wl.filter(l => new Date(l.date) > d30);
    const gm30 = (db.garmin || []).filter(g => g.cls === 'wod' && gDate(g) > d30);
    const rep = [...new Set(wl.map(l => l.wodId))].map(id => ({ id, n: wodLogs(id).length })).sort((a, b) => b.n - a.n);
    if (!ui.progWod || !rep.find(r => r.id === ui.progWod)) ui.progWod = rep[0] && rep[0].id;
    const sel = ui.progWod && wodById(ui.progWod); const sl = ui.progWod ? wodLogs(ui.progWod) : [];
    const hrs = gm30.filter(g => g.avgHr); const avgHr = hrs.length ? Math.round(hrs.reduce((a, g) => a + g.avgHr, 0) / hrs.length) : '–';
    view().innerHTML = head + `<div class="kpis4" style="margin-bottom:22px"><div class="kpi"><div class="v">${Math.max(last30.length, gm30.length)}</div><div class="l">WODs, last 30 days</div></div><div class="kpi"><div class="v">${Math.round(gm30.reduce((a, g) => a + g.dur / 60, 0))}</div><div class="l">Minutes (Garmin)</div></div><div class="kpi"><div class="v">${avgHr}</div><div class="l">Avg heart rate</div></div></div>
      ${rep.length ? `<section class="block panel"><div class="block-head"><h2>Workouts you’ve logged</h2><span class="small muted">Tap one for its trend</span></div>
        ${rep.map(r => { const b = bestOf(r.id); const w = wodById(r.id) || { name: r.id, format: '' }; return `<button class="wodp-row" data-act="prog-wod" data-id="${esc(r.id)}" aria-pressed="${r.id === ui.progWod}"><span><span class="fmt">${esc(w.format)}</span>${esc(w.name)}</span><span class="c">${r.n}×</span><b>${b ? scoreText(b.score) : scoreText(wodLogs(r.id).pop().score) + '*'}</b></button>`; }).join('')}
        ${rep.some(r => !bestOf(r.id)) ? '<p class="small muted" style="margin:8px 0 0">* only modified results so far</p>' : ''}</section>
      ${sel ? `<section class="block panel"><div class="block-head"><h2>${esc(sel.name)}</h2><span class="small muted">${scoreKind(sel) === 'time' ? 'Lower is better' : 'Higher is better'}</span></div><div class="chart-box" style="height:220px"><canvas id="c-wod"></canvas></div>
        <div class="tbl-wrap" style="margin-top:12px"><table class="extable"><thead><tr><th>Date</th><th>Score</th><th>How</th><th class="r">Avg HR</th></tr></thead><tbody>${sl.slice().reverse().map(l => { const g = l.garminId && garminById(l.garminId); return `<tr data-act="open-session" data-id="${l.id}"><td>${fmtDate(new Date(l.date), { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><b>${scoreText(l.score)}</b></td><td>${l.level === 'rx' ? 'Rx' : l.level === 'scaled' ? 'Scaled' : 'Modified'}</td><td class="r">${g && g.avgHr || '–'}</td></tr>`; }).join('')}</tbody></table></div></section>` : ''}`
      : `<div class="empty">Log a WOD score to see trends here.</div>`}`;
    if (sel && sl.length) {
      const k = scoreKind(sel); const val = (l) => l.score.kind === 'time' ? (l.score.capped ? null : l.score.time / 60) : scoreVal(l);
      const o = baseOpts2(false, v => k === 'time' ? clock(v * 60000) : nf(v, 1)); o.scales.y.beginAtZero = false; if (k === 'time') o.scales.y.reverse = true;
      o.plugins.tooltip = { callbacks: { label: (c) => ' ' + scoreText(sl[c.dataIndex].score) } };
      charts.push(new Chart($('#c-wod'), { type: 'line', data: { labels: sl.map(l => fmtDate(new Date(l.date), { day: 'numeric', month: 'short' })), datasets: [{ data: sl.map(val), borderColor: cssVar('--t-wod'), backgroundColor: sl.map(l => l.level === 'rx' ? cssVar('--t-wod') : cssVar('--surface')), pointBorderColor: cssVar('--t-wod'), pointRadius: 6, pointBorderWidth: 2, tension: .25 }] }, options: o }));
    }
    return;
  }
  if (ui.progTab === 'ride') {
    const rides = (db.garmin || []).filter(g => g.cls === 'ride'); const W = weeksBack(12);
    const wk = W.map(w => { const r = rides.filter(g => { const d = gDate(g); return d >= w.mon && d < w.end; }); const z = [0, 1, 2, 3, 4].map(i => r.reduce((a, g) => a + ((g.zones && g.zones[i]) || 0), 0) / 3600); const noHr = r.filter(g => !g.zones).reduce((a, g) => a + g.dur / 3600, 0); return { ...w, n: r.length, z, noHr, km: r.reduce((a, g) => a + (g.dist || 0), 0) }; });
    const cur = wk[wk.length - 1]; const plan = activePlan(); const nx = planNext(plan);
    const doneThis = plan && nx ? Object.keys(planDone(plan)).filter(k => +k.split(':')[0] === nx.week).length : 0;
    const eff = rides.filter(g => !isIndoor(g) && g.speed && g.avgHr && g.dur > 1800).slice(0, 40).reverse();
    view().innerHTML = head + `<div class="kpis4" style="margin-bottom:22px"><div class="kpi"><div class="v">${plan && nx ? `${doneThis}/${plan.weeks[nx.week - 1].length}` : '–'}</div><div class="l">${plan && nx ? `Plan rides, week ${nx.week}` : 'No active plan'}</div></div><div class="kpi"><div class="v">${hmin(cur.z.reduce((a, b) => a + b, 0) * 60 + cur.noHr * 60)}</div><div class="l">Riding this week</div></div><div class="kpi"><div class="v">${nf(cur.km, 0)}</div><div class="l">Km this week</div></div></div>
      <section class="block panel"><div class="block-head"><h2>Weekly riding time by zone</h2><span class="small muted">Last 12 weeks, from Garmin</span></div><div class="chart-box"><canvas id="c-ridez"></canvas></div>
        <div class="zlegend">${[1, 2, 3, 4, 5].map(i => `<span><i style="--zc:var(--z${i})"></i>Z${i}</span>`).join('')}<span><i style="--zc:var(--line-2)"></i>No heart rate</span></div></section>
      <section class="block panel"><div class="block-head"><h2>Aerobic efficiency</h2><span class="small muted">Outdoor rides over 30 min</span></div><p class="small muted" style="margin-top:0">Speed per heartbeat. Rising means you ride faster at the same heart rate.</p>${eff.length > 1 ? `<div class="chart-box sm"><canvas id="c-eff"></canvas></div>` : '<div class="empty">Needs a few outdoor rides with heart rate.</div>'}</section>`;
    charts.push(new Chart($('#c-ridez'), { type: 'bar', data: { labels: wk.map(w => fmtDate(w.mon, { day: 'numeric', month: 'short' })), datasets: [...[0, 1, 2, 3, 4].map(z => ({ label: 'Z' + (z + 1), data: wk.map(w => +w.z[z].toFixed(2)), backgroundColor: cssVar('--z' + (z + 1)), borderRadius: 2, maxBarThickness: 30 })), { label: 'No heart rate', data: wk.map(w => +w.noHr.toFixed(2)), backgroundColor: cssVar('--line-2'), borderRadius: 2, maxBarThickness: 30 }] }, options: baseOpts2(true, v => nf(v) + ' h') }));
    if (eff.length > 1) charts.push(new Chart($('#c-eff'), { type: 'line', data: { labels: eff.map(g => fmtDate(gDate(g), new Set(eff.map(x => x.start.slice(0, 4))).size > 1 ? { day: 'numeric', month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })), datasets: [{ label: 'Speed per heartbeat', data: eff.map(g => +(g.speed / g.avgHr * 100).toFixed(2)), borderColor: cssVar('--t-ride'), backgroundColor: cssVar('--t-ride'), pointRadius: 3, tension: .3 }] }, options: (() => { const o = baseOpts2(false, v => nf(v, 1)); o.scales.y.beginAtZero = false; return o; })() }));
    return;
  }
  // other activities
  const oth = (db.garmin || []).filter(g => g.cls === 'other'); const W = weeksBack(12);
  const types = [...new Set(oth.map(g => entryTitle({ g })))]; const pal = ['--steel', '--gold', '--green', '--copper', '--gold-soft', '--p-vl'];
  const tot = {}; oth.filter(g => gDate(g) > new Date(Date.now() - 365 * 864e5)).forEach(g => { const k = entryTitle({ g }); tot[k] = tot[k] || { n: 0, min: 0, km: 0 }; tot[k].n++; tot[k].min += g.dur / 60; tot[k].km += g.dist || 0; });
  view().innerHTML = head + `<section class="block panel"><div class="block-head"><h2>Walks, hikes and more</h2><span class="small muted">Minutes per week, from Garmin</span></div>${oth.length ? `<div class="chart-box"><canvas id="c-oth"></canvas></div><div class="legend">${types.map((t, i) => `<span><i class="plate" style="--c:var(${pal[i % pal.length]})"></i>${esc(t)}</span>`).join('')}</div>` : '<div class="empty">Activities like walks and hikes from your Garmin show up here.</div>'}</section>
    ${Object.keys(tot).length ? `<section class="block panel"><div class="block-head"><h2>Last 12 months</h2></div><table class="extable"><thead><tr><th>Activity</th><th class="r">Times</th><th class="r">Hours</th><th class="r">Km</th></tr></thead><tbody>${Object.entries(tot).sort((a, b) => b[1].min - a[1].min).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${v.n}</td><td class="r">${nf(v.min / 60, 1)}</td><td class="r">${v.km ? nf(v.km, 0) : '–'}</td></tr>`).join('')}</tbody></table></section>` : ''}`;
  if (oth.length) charts.push(new Chart($('#c-oth'), { type: 'bar', data: { labels: W.map(w => fmtDate(w.mon, { day: 'numeric', month: 'short' })), datasets: types.map((t, i) => ({ label: t, data: W.map(w => Math.round(oth.filter(g => entryTitle({ g }) === t && gDate(g) >= w.mon && gDate(g) < w.end).reduce((a, g) => a + g.dur / 60, 0))), backgroundColor: cssVar(pal[i % pal.length]), borderRadius: 2, maxBarThickness: 30 })) }, options: baseOpts2(true, v => v + ' min') }));
}

/* ---------- MORE ---------- */
function renderMore() {
  renderMoreBase();
  const st = gStatus.data; const anchor = $('#backup') || $('#view .page-head');
  const gm = !sync.configured ? `<p class="small muted" style="margin:0">Connect the Google Sheet backup first; Garmin runs through it.</p>`
    : !st ? `<p class="small muted" style="margin:0">Checking status…</p>`
    : !st.configured ? `<p class="small" style="margin:0">No Garmin key in your sync script yet. Add the script property <b>GARMIN_API_KEY</b> (see the guide, step 3).</p>`
    : `<div class="row wrap" style="gap:10px;margin-bottom:8px"><span class="sync-pill ${st.lastError ? 'bad' : 'ok'}"><i></i>${st.lastError ? 'Problem' : 'Connected'}</span><span class="small muted">${st.total} activities, ${st.detailed} with heart rate and route${st.lastOk ? `, last check ${ago(st.lastOk)}` : ''}</span></div>
       ${st.lastError ? `<p class="small" style="color:var(--danger);margin:0 0 8px">${esc(st.lastError)}</p>` : ''}
       ${st.keyExpires ? `<p class="small muted" style="margin:0 0 8px">Key expires ${fmtDate(new Date(st.keyExpires), { day: 'numeric', month: 'long', year: 'numeric' })}.</p>` : ''}
       <div class="row wrap"><button class="btn sm primary" data-act="gm-checknow">${I.watch}Check Garmin now</button>${!st.since ? `<button class="btn sm" data-act="gm-import">Import 3 years of history</button>` : ''}</div>
       ${db.garmin.length ? `<p class="small muted" style="margin:10px 0 0">${esc(garminSummary())}.</p>` : ''}`;
  anchor.insertAdjacentHTML('afterend', `<section class="block panel"><div class="block-head"><h2>Garmin</h2></div>${gm}</section>
    <section class="block"><div class="block-head"><h2>WODs, rides and look</h2></div><div class="settings-list">
      <div class="it"><div class="l">Rx targets<small>The WOD library lists men’s and women’s loads</small></div><div class="seg"><button data-act="set-rx" data-v="m" aria-pressed="${db.settings.rx !== 'f'}">Men</button><button data-act="set-rx" data-v="f" aria-pressed="${db.settings.rx === 'f'}">Women</button></div></div>
      <div class="it"><div class="l">Max heart rate<small>Used for zones on Garmin data</small></div><input class="input" inputmode="numeric" data-setting="maxHr" value="${db.settings.maxHr || 190}" aria-label="Max heart rate"><span class="muted small">bpm</span></div>
      <div class="it"><div class="l">Opener when the app starts</div><input type="checkbox" data-setting="opener" ${db.settings.opener !== false ? 'checked' : ''} aria-label="Opener"></div>
      <div class="it"><div class="l">See the opener</div><button class="btn sm" data-act="replay-opener">${I.play}Play</button></div>
    </div></section>`);
}

/* ---------- actions ---------- */
Object.assign(ACT, {
  'open-session': (el) => { const s = db.sessions.find(x => x.id === el.dataset.id); if (s) openEntry({ s, date: s.date }); },
  'open-garmin': (el) => { const g = garminById(el.dataset.id); if (g) openEntry({ g, date: g.start }); },
  'hist-f': (el) => { ui.hist = el.dataset.v; rerender(); },
  'plans-tab': (el) => { ui.plansTab = el.dataset.v; ui.progSel = null; rerender(); },
  'prog-tab': (el) => { ui.progTab = el.dataset.v; rerender(); },
  'prog-wod': (el) => { ui.progWod = el.dataset.id; rerender(); },
  's-group': (el) => { ui.sGroup = el.dataset.v; ui.sGroupSet = true; const c = db.exercises.filter(e => exGroup(e.id) === ui.sGroup).map(e => e.id); const f = derived().flat; const has = c.filter(id => f.some(x => x.ex === id && x.e1)); ui.prEx = has.sort((a, b) => exName(a).localeCompare(exName(b)))[0] || ui.prEx; rerender(); },
  's-all': () => { ui.sAll = !ui.sAll; rerender(); },
  'lib-fmt': (el) => { ui.libFmt = el.dataset.v || null; rerender(); },
  'lib-band': (el) => { ui.libBand = el.dataset.v || null; rerender(); },
  'goto-lib': () => { ui.plansTab = 'wod'; location.hash = '#programs'; if (ui.view === 'programs') rerender(); },
  'wod-random': () => { const l = (db.wods || []).filter(w => !w.superseded); if (!l.length) { toast('Import your WOD library first'); return; } wodSheet(l[Math.floor(Math.random() * l.length)].id); },
  'wod-open': (el) => wodSheet(el.dataset.id),
  'wod-start': (el) => startWod(el.dataset.id, 'setup'),
  'wod-modify': (el) => startWod(el.dataset.id, 'modify'),
  'wod-stage': (el) => { WA().stage = el.dataset.v; saveActive(); renderWod(); },
  'wl-del': (el) => { WA().lines.splice(+el.dataset.i, 1); saveActive(); renderWod(); },
  'wl-add': () => { WA().lines.push({ pre: '', reps: '10', mv: '' }); saveActive(); renderWod(); setTimeout(() => { const ins = $$('#wo [data-wl="mv"]'); ins[ins.length - 1]?.focus(); }, 30); },
  'wl-reset': () => { const A = WA(), w = wodById(A.wodId); A.lines = clone(w.lines); A.cap = w.max; A.dur = w.min; saveActive(); renderWod(); },
  'wod-go': () => { const A = WA(); A.stage = 'timer'; A.t = { start: Date.now(), elapsed: 0, running: true, rounds: 0 }; A.startedAt = Date.now(); A.date = localISO(new Date()); saveActive(true); renderWod(); },
  'wod-skip': () => prepScore(),
  'wod-finish': () => finishTimer(),
  't-round': () => { const A = WA(); A.t.rounds++; $('#t-rounds').textContent = A.t.rounds; saveActive(); try { navigator.vibrate && navigator.vibrate(40); } catch (e) { } },
  't-undo': () => { const A = WA(); A.t.rounds = Math.max(0, A.t.rounds - 1); $('#t-rounds').textContent = A.t.rounds; saveActive(); },
  't-pause': () => { const A = WA(); if (A.t.running) { A.t.elapsed += (Date.now() - A.t.start) / 1000; A.t.running = false; } else { A.t.start = Date.now(); A.t.running = true; } saveActive(true); renderWod(); },
  'wod-level': (el) => { WA().level = el.dataset.v; saveActive(); renderWod(); },
  rpe: (el) => { WA().rpe = +el.dataset.v; saveActive(); $$('#wo [data-act="rpe"]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === WA().rpe))); },
  'wod-save': () => saveWod(),
  'gm-link': (el) => { const A = WA(); A.garminId = el.dataset.gid; const g = garminById(A.garminId); if (A.kind === 'ride' && g) A.indoor = isIndoor(g); saveActive(true); A.kind === 'wod' ? renderWod() : renderRide(); toast('Garmin data linked'); },
  'gm-unlink': () => { const A = WA(); if (!A) return; A.garminId = null; A.gm = 'ready'; saveActive(true); A.kind === 'wod' ? renderWod() : renderRide(); },
  'gm-check': () => { const A = WA(); A.gm = 'idle'; afterGarminPane($('#wo')); },
  'gm-checknow': () => garminCheckNow(false).then(() => refreshGarminStatus()).then(() => rerender()),
  'gm-import': () => confirmSheet('Import 3 years of Garmin history?', 'Your sync script works through it in batches in your Google account, saving each original file in Drive. That can take a while; you can keep using the app.', 'Start import', () => startGarminImport(3)),
  'ride-session': (el) => rideSessionSheet(el.dataset.code, el.dataset.week, el.dataset.slot),
  'ride-start': (el) => startRide({ code: el.dataset.code || null, week: el.dataset.week ? +el.dataset.week : null, slot: el.dataset.slot !== '' && el.dataset.slot != null ? +el.dataset.slot : null }),
  'ride-plan': (el) => { const A = WA(); const plan = activePlan(); const w = +el.dataset.week, s = +el.dataset.slot; const code = plan.weeks[w - 1][s]; A.planRef = { planId: plan.id, planName: plan.name, week: w, slot: s, code }; A.code = code; A.name = plan.sessions[code].name; saveActive(true); renderRide(); },
  'ride-in': (el) => { WA().indoor = el.dataset.v === '1'; saveActive(); renderRide(); },
  'ride-save': () => saveRide(),
  'plan-pick': (el) => { db.settings.activePlanId = el.dataset.id; save(); rerender(); },
  'tc-wod': (el) => { const g = garminById(el.dataset.id); closeAllSheets(); wodPicker((id) => startWod(id, 'score', { date: g.start, garminId: g.id }), 'Which WOD was it?'); },
  'tc-ride': (el) => { const g = garminById(el.dataset.id); closeAllSheets(); const plan = activePlan(); const nx = planNext(plan); startRide({ garminId: g.id, week: nx ? nx.week : null, slot: nx ? nx.slot : null }); },
  'tc-keep': (el) => { db.settings.reviewed = db.settings.reviewed || {}; db.settings.reviewed[el.dataset.id] = 1; save(); rerender(); },
  wpick: (el) => { const cb = ui.pickWodCb; closeSheet(); cb && cb(el.dataset.id); },
  import: (el) => importSheet(el.dataset.v),
  'imp-kind': (el) => { ui.impKind = el.dataset.v; $('#imp').innerHTML = importBody(); },
  'paste-add': () => { const w = parseWodText(ui.paste); if (!w) return; const r = mergeLibrary('wod', [w]); saveNow(); closeAllSheets(); ui.plansTab = 'wod'; rerender(); toast(r.same ? 'That WOD is already in your library' : `“${w.name}” added to your library`); },
  'set-rx': (el) => { db.settings.rx = el.dataset.v; save(); rerender(); },
  'replay-opener': () => showOpener(),
  'ss-toggle': (el) => {
    const a = db.active; const k = +el.dataset.k; const x = a.items[k], y = a.items[k + 1]; if (!x || !y) return;
    if (x.group && x.group === y.group) { const g = x.group; const ng = 'g' + uid(); for (let n = k + 1; a.items[n] && a.items[n].group === g; n++) a.items[n].group = ng; }
    else { const g = x.group || y.group || 'g' + uid(); const old = y.group; a.items.forEach(z => { if (old && z.group === old) z.group = g; }); x.group = g; y.group = g; }
    normalizeGroups(a.items); saveActive(true); renderWorkout();
  },
});
document.addEventListener('input', (e) => {
  const t = e.target, d = t.dataset;
  if (d.lib) { ui.libQ = t.value; const l = $('#lib-list'); if (l) l.innerHTML = libList(libFilter(ui.libQ, ui.libFmt, ui.libBand).filter(w => !w.superseded)); return; }
  if (d.wpq) { ui.pickWodQ = t.value; $('#wpick').innerHTML = wodPickList(); return; }
  if (d.paste) { ui.paste = t.value; const p = $('#paste-prev'); if (p) p.innerHTML = pastePreview(); return; }
  const A = db.active; if (!A || (A.kind !== 'wod' && A.kind !== 'ride')) return;
  if (d.wl) { A.lines[+d.i][d.wl] = t.value; saveActive(); return; }
  if (d.wload != null) { A.loads[+d.wload].kg = t.value; saveActive(); return; }
  if (d.sc) { A.score[d.sc] = t.value; saveActive(); return; }
  if (d.sp) { A.score.parts[+d.i][d.sp] = t.value; saveActive(); return; }
  if (d.notes) { A.notes = t.value; saveActive(); return; }
  if (d.wdate) { if (t.value) { A.date = t.value; saveActive(); } return; }
});
document.addEventListener('change', (e) => {
  const t = e.target, d = t.dataset;
  if (d.impfile && t.files[0]) { const f = t.files[0]; t.value = ''; importFile(d.impfile, f); return; }
  if (d.setting === 'opener') { db.settings.opener = t.checked; save(); return; }
  if (d.setting === 'maxHr') { const v = parseInt(t.value); if (v > 120 && v < 230) { db.settings.maxHr = v; save(); } return; }
  const A = db.active; if (!A || A.kind !== 'wod') return;
  if (d.wl || d.wclock) { if (d.wclock) { const v = parseInt(t.value) || 1; if (FOR_TIME.includes(wodById(A.wodId).format)) A.cap = v; else A.dur = v; } saveActive(); renderWod(); }
  if (d.chk === 'capped') { A.score = t.checked ? { capped: true } : {}; saveActive(); renderWod(); }
  if (d.wdate) { renderWod(); }
});

/* ---------- one button to log anything ---------- */
Object.assign(ACT, {
  'log-fab': () => openSheet('What are you logging?', `<div class="choose">
      <button data-act="choose" data-v="strength">${ticon('strength')}<span><b>Strength</b><span class="s">Sets, reps and RPE, from your program</span></span></button>
      <button data-act="choose" data-v="wod">${ticon('wod')}<span><b>WOD</b><span class="s">From your library, with a timer, or just the score</span></span></button>
      <button data-act="choose" data-v="ride">${ticon('ride')}<span><b>Ride</b><span class="s">Next ride in your plan, or a free ride</span></span></button></div>`),
  choose: (el) => { const v = el.dataset.v; closeAllSheets();
    if (v === 'strength') { const p = progById(db.settings.activeProgramId); if (p) ACT['start-next'](); else startEmpty(false); }
    if (v === 'wod') wodPicker((id) => startWod(id, 'setup'), 'Which WOD?');
    if (v === 'ride') { const plan = activePlan(); const nx = planNext(plan); startRide(nx ? { week: nx.week, slot: nx.slot } : {}); } },
});
(() => { const fab = document.createElement('button'); fab.className = 'log-fab'; fab.dataset.act = 'log-fab'; fab.innerHTML = `${I.plus}Log activity`; document.body.append(fab); })();

/* ===== a5.js ===== */
/* =========================================================
   PERSISTENCE (on this phone)
   ========================================================= */
const APP_VERSION = '2.0.0';
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
  (db.wods || []).forEach(w => m.set('wod:' + w.id, w));
  (db.plans || []).forEach(p => m.set('plan:' + p.id, p));
  (db.garmin || []).forEach(g => m.set('garmin:' + g.id, g));
  Object.entries(db.extra || {}).forEach(([k, v]) => m.set(k, v));
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
/* the workout in progress is copied to localStorage right away (synchronous), so a tap is never lost when the app is killed */
function saveActive(now) {
  if (db.active) db.active._v = Date.now();
  try { localStorage.setItem('chalk.active', db.active ? JSON.stringify(db.active) : ''); } catch (e) { }
  if (now) return persistNow(); if (!persistTimer) persistTimer = setTimeout(persistNow, 300);
}
function saveNow(tsOverride) { invalidate(); wantRecords = true; return persistNow(tsOverride); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { persistNow(); requestSync(0); } });
window.addEventListener('pagehide', () => persistNow());

function loadFromRecords(recs) {
  const d = defaultData(); d.sessions = []; d.trash = []; d.wods = []; d.plans = []; d.garmin = []; d.extra = {};
  const ex = [], progs = [];
  for (const r of recs) {
    const [type] = r.k.split(':');
    if (type === 'session') d.sessions.push(r.data);
    else if (type === 'trash') d.trash.push(r.data);
    else if (type === 'program') progs.push(r.data);
    else if (type === 'exercise') ex.push(r.data);
    else if (type === 'wod') d.wods.push(r.data);
    else if (type === 'plan') d.plans.push(r.data);
    else if (type === 'garmin') d.garmin.push(r.data);
    else if (type === 'settings') d.settings = { ...clone(DEFAULT_SETTINGS), ...r.data };
    else d.extra[r.k] = r.data; // unknown record types travel along untouched
  }
  if (ex.length) { const have = new Set(ex.map(e => e.id)); d.exercises = [...ex, ...d.exercises.filter(e => !have.has(e.id))]; } // new built-ins appear automatically
  if (recs.some(r => r.k.startsWith('program:')) || recs.some(r => r.k === 'settings:main')) d.programs = progs;
  d.garmin.sort((a, b) => b.start.localeCompare(a.start));
  d.sessions.sort((a, b) => b.date.localeCompare(a.date));
  d.trash.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  return d;
}
/* after records change: give imported programs real exercise ids */
function afterReload() { let n = false; db.programs.forEach(p => { if (JSON.stringify(p).includes('exerciseName')) { normalizeProgram(p); n = true; } }); if (n) save(); }
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
  cfg.sheet = info.name || 'Plompgym data'; cfg.connectedAt = Date.now();
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
  if (changes.length) { await persistChain; await writeChanges(changes, device); await reloadFromDevice(); afterReload(); }
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
  if (!d || typeof d !== 'object') throw new Error('Not a Plompgym file');
  const remap = (id) => ID_REMAP[id] || id;
  const fixSession = (s) => { delete s.readiness; delete s.sleep; (s.items || []).forEach(i => { if (i.exerciseId) i.exerciseId = remap(i.exerciseId); }); return s; };
  const valid = (s) => s && typeof s.id === 'string' && typeof s.date === 'string' && (Array.isArray(s.items) || s.kind === 'wod' || s.kind === 'ride');
  if (d.format === 'chalk-history') return { base: true, sessions: (d.sessions || []).filter(valid).map(fixSession), exercises: [], programs: [], trash: [], wods: [], plans: [], garmin: [] };
  if (Array.isArray(d.sessions)) return {
    base: false, sessions: d.sessions.filter(valid).map(fixSession), trash: (d.trash || []).filter(valid).map(fixSession),
    wods: (d.wods || []).filter(w => w && w.id && Array.isArray(w.lines)), plans: (d.plans || []).filter(p => p && p.id && Array.isArray(p.weeks)), garmin: (d.garmin || []).filter(g => g && g.id && g.start),
    exercises: (d.exercises || []).filter(e => e && e.id && e.name), programs: (d.programs || []).filter(p => p && p.id && Array.isArray(p.weeks)).map(p => { p.weeks.forEach(w => w.days.forEach(x => x.items.forEach(i => i.exerciseId = remap(i.exerciseId)))); return p; })
  };
  throw new Error('Not a Plompgym file');
}
function mergeImport(n) {
  const have = (arr) => new Set(arr.map(x => x.id));
  const hs = have(db.sessions), ht = have(db.trash || []), he = have(db.exercises), hp = have(db.programs);
  const add = { sessions: 0, exercises: 0, programs: 0 };
  n.exercises.forEach(e => { if (!he.has(e.id)) { db.exercises.push(e); add.exercises++; } });
  n.sessions.forEach(s => { if (!hs.has(s.id) && !ht.has(s.id)) { db.sessions.push(s); add.sessions++; } });
  n.trash.forEach(s => { if (!hs.has(s.id) && !ht.has(s.id)) { db.trash.push(s); } });
  n.programs.forEach(p => { if (!hp.has(p.id)) { db.programs.push(p); add.programs++; } });
  const hw = have(db.wods || []), hpl = have(db.plans || []), hg = have(db.garmin || []);
  (n.wods || []).forEach(w => { if (!hw.has(w.id)) { db.wods.push(w); add.wods = (add.wods || 0) + 1; } });
  (n.plans || []).forEach(p => { if (!hpl.has(p.id)) { db.plans.push(p); } });
  (n.garmin || []).forEach(g => { if (!hg.has(g.id)) { db.garmin.push(g); } });
  db.sessions.sort((a, b) => b.date.localeCompare(a.date));
  return add;
}
function importFromFile(file, after) {
  const r = new FileReader();
  r.onload = async () => {
    let n; try { n = normalizeImport(JSON.parse(r.result)); } catch (e) { toast('That file isn’t a Plompgym history, backup or snapshot file'); return; }
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
      <div class="brand-big">${LOGO(44)}Plompgym</div>
      <h1 class="onb-h">Your training log, on this phone</h1>
      <p class="muted" style="max-width:52ch">Everything you log is saved on the phone first and works without signal. A copy goes to a Google Sheet in your Drive whenever you’re online.</p>
      <div class="onb-cards">
        <div class="onb-card ${onbMode === 'restore' ? 'open' : ''}">
          <button class="onb-t" data-act="onb-mode" data-v="restore"><b>Restore from my Google Sheet</b><span>For a new phone, or after reinstalling</span></button>
          ${onbMode === 'restore' ? `<div class="onb-b">${backupForm('restore')}</div>` : ''}
        </div>
        <div class="onb-card ${onbMode === 'file' ? 'open' : ''}">
          <button class="onb-t" data-act="onb-mode" data-v="file"><b>Import my history file</b><span>Your history file from the package, or a backup or snapshot file</span></button>
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
  b.innerHTML = `<span>A new version of Plompgym is ready.</span><button class="btn sm primary" id="upd-go">Reload</button>`;
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
    let active = await kvGet('active'); let lsActive = null;
    try { const ls = localStorage.getItem('chalk.active'); if (ls) lsActive = JSON.parse(ls); } catch (e) { }
    if (lsActive && (!active || (lsActive._v || 0) > (active._v || 0))) active = lsActive; // whichever copy is newest
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
    afterReload();
    route(); renderResume();
    if (!db.active && db.settings.opener !== false) showOpener();
    requestSync(800);
    gStatus.data = await kvGet('garminStatus'); if (sync.configured) refreshGarminStatus().then(st => { if (st && st.running) pollGarmin(); if (ui.view === 'today') rerender(); });
    const lastPull = await kvGet('lastPull');
    if (sync.configured && navigator.onLine && (!lastPull || Date.now() - lastPull > 10 * 60000)) pullAndMerge().then(n => { autoLink(); if (n && !$('#wo')) rerender(); }).catch(() => { });
  } catch (err) {
    console.error(err);
    view().innerHTML = `<div class="empty" style="margin-top:40px"><b>Plompgym couldn’t open its storage on this phone.</b><br>${esc(err.message || err)}<br><br>Your backup in Google Sheets is not affected. Try closing and reopening the app.</div>`;
  }
}
boot();


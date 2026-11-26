// Application store: data loading, derived wireless indexes, annotations sync,
// hash router, and user prefs. Plain mutable state + a version counter that
// React subscribes to via useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import {
  cmp, isAdsb, keyOf, macRe, normalizeTrackLog, normTag, renameTags, secsSince, uniq, isNew,
} from './format.js';

const ANNOT_KEYS = ['notes', 'watch', 'tags', 'track', 'trackLog'];
export const api = p => new URL(p, document.baseURI).href;

const ls = (k, d) => { try { return JSON.parse(localStorage.getItem('sd.' + k) || d); } catch { return JSON.parse(d); } };

export const S = {
  ready: false,
  error: null,
  sum: null, jobs: null, job: null, sweep: null, inc: null, wifi: null, ham: null,
  dev: {},
  route: { path: [], q: {} },
  prefs: ls('prefs', '{}'),
  notes: ls('notes', '{}'),
  watch: ls('watch', '{}'),
  tags: renameTags(ls('tags', '{}')),
  track: ls('track', '{}'),
  trackLog: normalizeTrackLog(ls('trackLog', '[]')),
  sorts: ls('sorts', '{}'),
  annot: { rev: 0, online: null, dirty: false },
  live: { state: 'off', events: [] },
};

let version = 0;
const listeners = new Set();
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const notify = () => { version++; listeners.forEach(fn => fn()); };
export const getVersion = () => version;
export const useStore = () => useSyncExternalStore(subscribe, getVersion, getVersion);

// ---------- persistence ----------
export function save(k) {
  localStorage.setItem('sd.' + k, JSON.stringify(S[k]));
  if (ANNOT_KEYS.includes(k)) annotQueue();
}
export function setPref(k, v) { S.prefs[k] = v; save('prefs'); notify(); }

// ---------- annotations relay (notes / watch / tags / presence log) ----------
function annotQueue() { S.annot.dirty = true; clearTimeout(S.annot._t); S.annot._t = setTimeout(annotPush, 800); }
function annotDoc() { const d = {}; for (const k of ANNOT_KEYS) d[k] = S[k]; d.base_rev = S.annot.rev || undefined; return d; }
function annotMerge(d, union) {
  const uniqLog = log => { const seen = new Set(); return normalizeTrackLog(log).filter(e => { const k = e.key + '|' + e.to + '|' + String(e.t).slice(0, 16); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => cmp(a.t, b.t)).slice(-300); };
  if (!union) {
    for (const k of ANNOT_KEYS) if (d[k] != null) S[k] = k === 'tags' ? renameTags(d[k]) : d[k];
    S.trackLog = normalizeTrackLog(S.trackLog);
  } else {
    S.notes = { ...(d.notes || {}), ...Object.fromEntries(Object.entries(S.notes).filter(([k, v]) => v && !(d.notes || {})[k])) };
    S.watch = { ...(d.watch || {}), ...S.watch };
    const tg = renameTags(d.tags || {}); for (const k in S.tags) tg[k] = uniq([...(tg[k] || []), ...renameTags({ [k]: S.tags[k] })[k]]); S.tags = tg;
    S.track = { ...(d.track || {}), ...S.track };
    S.trackLog = uniqLog([...(d.trackLog || []), ...S.trackLog]);
  }
  for (const k of ANNOT_KEYS) localStorage.setItem('sd.' + k, JSON.stringify(S[k]));
}
export async function annotPull() {
  try {
    const r = await fetch(api('annotations?_=' + Date.now()), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
    const d = await r.json(); const first = S.annot.online === null; S.annot.online = true;
    if (S.annot.dirty) return;
    if (first) { const hadLocal = ANNOT_KEYS.some(k => Object.keys(S[k]).length); annotMerge(d, true); S.annot.rev = d.rev || 0; if (hadLocal) annotQueue(); }
    else if ((d.rev || 0) !== S.annot.rev) { annotMerge(d, false); S.annot.rev = d.rev || 0; }
  } catch { if (S.annot.online === null) S.annot.online = false; }
}
async function annotPush(retry) {
  if (S.annot.online === false) { S.annot.dirty = false; return; }
  try {
    const r = await fetch(api('annotations'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(annotDoc()) });
    if (r.status === 409 && !retry) { const cur = (await r.json()).current || {}; annotMerge(cur, true); S.annot.rev = cur.rev || 0; return annotPush(true); }
    if (!r.ok) throw new Error(r.status);
    S.annot.rev = (await r.json()).rev; S.annot.dirty = false; S.annot.online = true;
  } catch { S.annot.dirty = false; S.annot.online = S.annot.online === true; }
}

// ---------- data ----------
async function j(u, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(api(u + '?_=' + Date.now()), { cache: 'no-store' });
      if (!r.ok) throw Object.assign(new Error(u + ' ' + r.status), { http: true });
      const t = await r.text();
      try { return JSON.parse(t); }
      catch { return JSON.parse(t.replace(/(?<=[:,\[])\s*-?(NaN|Infinity)(?=\s*[,\]}])/g, 'null')); }
    } catch (e) {
      last = e;
      // a real 404/500 will not get better by retrying; a dropped connection might.
      if (e.http) throw e;
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw last;
}
export async function loadAll() {
  const [sum, jobs, job, inc, wifi, ham] = await Promise.allSettled([
    j('summary.json'), j('jobs.json'), j('jobs/status'), j('incidents.json'), j('wifi.json'), j('ham.json'),
  ]);
  if (sum.status === 'fulfilled') S.sum = sum.value; else if (!S.sum) throw sum.reason;
  S.jobs = jobs.status === 'fulfilled' ? jobs.value : S.jobs;
  S.job = job.status === 'fulfilled' ? job.value : S.job;
  S.inc = inc.status === 'fulfilled' ? inc.value : S.inc;
  S.wifi = wifi.status === 'fulfilled' ? wifi.value : S.wifi;
  S.ham = ham.status === 'fulfilled' ? ham.value : S.ham;
  indexWifi();
}

export function indexWifi() {
  const W = S.wifi; if (!W) return;
  W._apByMac = new Map((W.aps || []).map(a => [a.mac, a]));
  W._clByMac = new Map((W.clients || []).map(c => [c.mac, c]));
  W._bleByMac = new Map((W.ble || []).map(b => [b.mac, b]));
  W._entById = new Map((W.entities || []).map(e => [e.id, e]));
  W._clientsOfAp = new Map();
  for (const c of W.clients || []) {
    const bs = Array.isArray(c.client_of) ? c.client_of : (c.bssid && !/^00:00/.test(c.bssid) ? [c.bssid] : []);
    for (const b of bs) { if (!W._clientsOfAp.has(b)) W._clientsOfAp.set(b, []); W._clientsOfAp.get(b).push(c); }
  }
  W._addrsOfEnt = new Map();
  for (const b of W.ble || []) { if (b.entity_id == null) continue; if (!W._addrsOfEnt.has(b.entity_id)) W._addrsOfEnt.set(b.entity_id, []); W._addrsOfEnt.get(b.entity_id).push(b); }
  for (const a of W.alerts || []) { a._macs = uniq((a.message.match(macRe) || []).map(m => m.toUpperCase())); a._mac = a.actor?.mac || a._macs[0] || null; }
  W._ourSsids = new Set(W.known?.ssids || []);
  W._ourBssids = new Set(Object.keys(W.known?.bssids || {}).map(x => x.toUpperCase()));
  W._bssidLabel = mac => W.known?.bssids?.[String(mac).toLowerCase()];
  const firsts = [...(W.aps || []), ...(W.clients || []), ...(W.ble || [])].map(x => +new Date(x.first_seen)).filter(Boolean);
  W._baseline = firsts.length ? Math.min(...firsts) + 3600e3 : 0;
}
export const isNewW = x => isNew(x.first_seen) && +new Date(x.first_seen) > (S.wifi?._baseline || 0);

export function groupAlerts(alerts) {
  const m = new Map();
  for (const a of alerts) { const k = a.type + '|' + (a._mac || a.message); if (!m.has(k)) m.set(k, { ...a, _n: 0, _first: a.at }); const g = m.get(k); g._n++; if (a.at < g._first) g._first = a.at; }
  return [...m.values()];
}

// ---------- navigation ----------
export function parseHash() {
  const h = (location.hash || '#/').slice(1);
  const [p, qs] = h.split('?');
  const path = p.split('/').filter(Boolean).map(decodeURIComponent);
  const q = {};
  if (qs) for (const kv of qs.split('&')) { const [k, v] = kv.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); }
  return { path, q };
}
export const href = (path, q) => {
  const qs = Object.entries(q || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  return '#/' + path.map(encodeURIComponent).join('/') + (qs ? '?' + qs : '');
};
export const go = (path, q) => { location.hash = href(path, q); };
export const setQ = patch => { const q = { ...S.route.q, ...patch }; for (const k in q) if (q[k] === '' || q[k] == null) delete q[k]; location.hash = href(S.route.path, q); };

// ---------- derived: hrefs, tracked set, notes ----------
export const devHref = d => href(['device', d.slug || d.key]);
export const apHref = a => href(['wireless', 'ap', a.mac]);
export const clHref = c => href(['wireless', 'client', c.mac]);
export const entHref = e => href(['wireless', 'ble', String(e.id)]);
export const addrHref = b => href(['wireless', 'addr', b.mac]);
export function macHref(mac) {
  const W = S.wifi; if (!W || !mac) return null;
  mac = String(mac).toUpperCase();
  if (W._apByMac.has(mac)) return apHref({ mac });
  if (W._clByMac.has(mac)) return clHref({ mac });
  if (W._bleByMac.has(mac)) return addrHref({ mac });
  return null;
}
export const noteOf = k => S.notes[k] || '';
export const isWatched = k => !!S.watch[k];
export const tagsOf = k => S.tags[k] || [];
export const isTracked = k => !!(S.watch[k] || S.notes[k] || (S.tags[k] || []).length);
export function setTags(k, arr) { arr = uniq(arr.map(normTag).filter(Boolean)); if (arr.length) S.tags[k] = arr; else delete S.tags[k]; save('tags'); }
export function toggleWatch(k) { if (S.watch[k]) delete S.watch[k]; else S.watch[k] = Date.now(); save('watch'); }
export function setNote(k, v) { if (v && v.trim()) S.notes[k] = v; else delete S.notes[k]; save('notes'); }
export function allTags() { const m = new Map(); for (const k in S.tags) for (const t of S.tags[k]) m.set(t, (m.get(t) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])); }
export const trackedKeys = () => uniq([...Object.keys(S.watch), ...Object.keys(S.notes).filter(k => S.notes[k]), ...Object.keys(S.tags)]);

export function resolveKey(k) {
  const W = S.wifi; const i = k.indexOf('|'); const t = k.slice(0, i), id = k.slice(i + 1);
  const recent = (age, s) => age != null && age < s;
  if (t === 'rf') { const d = S.sum?.devices.find(x => x.key === id || x.slug === id); return d && { kind: 'RF device', name: dname2(d), href: devHref(d), present: d.present === true || (d.present == null && recent(d.age_seconds, 600)), signal: d.last_snr, last: d.last_seen, age: d.age_seconds }; }
  if (!W) return null;
  if (t === 'ap') { const a = W._apByMac.get(id); return a && { kind: 'AP', name: apName2(a), href: apHref(a), present: recent(a.age_seconds, 600), signal: a.signal, last: a.last_seen, age: a.age_seconds }; }
  if (t === 'client') { const c = W._clByMac.get(id); return c && { kind: 'Wi-Fi client', name: c.mac + (c.label ? ' · ' + c.label : c.manuf ? ' · ' + c.manuf : ''), href: clHref(c), present: recent(c.age_seconds, 600), signal: c.signal, last: c.last_seen, age: c.age_seconds }; }
  if (t === 'ble') { const b = W._bleByMac.get(id); return b && { kind: 'BLE address', name: b.mac + (b.label ? ' · ' + b.label : b.manuf ? ' · ' + b.manuf : ''), href: addrHref(b), present: recent(b.age_seconds, 120), signal: b.signal, last: b.last_seen, age: b.age_seconds }; }
  if (t === 'ent') { const e = W._entById.get(+id); return e && { kind: 'BLE entity', name: '#' + e.id + (e.manuf ? ' · ' + e.manuf : '') + (e.name ? ' ' + e.name : ''), href: entHref(e), present: !!e.present, signal: e.signal, last: e.last_seen, age: e.age_seconds }; }
  return null;
}
// local aliases to avoid a circular import with format.js helpers used above
const dname2 = d => d.known?.label || d.identity?.label || d.label;
const apName2 = a => (a.ssids && a.ssids.length ? a.ssids.join(', ') : '') || (a.hidden ? '‹hidden›' : (!(a.ssids && a.ssids.length) && !a.crypt && !a.hidden) ? '‹no beacon›' : a.name || '');

export function trackTick() {
  const now = new Date().toISOString(); let changed = false, events = 0;
  for (const k of trackedKeys()) {
    const r = resolveKey(k); if (!r || r.present == null) continue;
    const prev = S.track[k];
    if (!prev) { S.track[k] = { p: r.present, t: now }; changed = true; continue; }
    if (prev.p !== r.present) {
      S.track[k] = { p: r.present, t: now }; changed = true; events++;
      S.trackLog.push({ t: now, key: k, name: r.name, kind: r.kind, to: r.present ? 'present' : 'away' });
      if (S.trackLog.length > 300) S.trackLog.splice(0, S.trackLog.length - 300);
    }
  }
  if (changed) { localStorage.setItem('sd.track', JSON.stringify(S.track)); localStorage.setItem('sd.trackLog', JSON.stringify(S.trackLog)); if (events) annotQueue(); }
  return events;
}

// ---------- live feed (SSE from secops_live.py via Caddy /live) ----------
export function startLive() {
  if (!window.EventSource || S.live._es) return;
  S.live.state = 'connecting';
  let es;
  try { es = new EventSource(api('live')); } catch { S.live.state = 'n/a'; notify(); return; }
  S.live._es = es;
  es.onopen = () => { S.live.state = 'on'; notify(); };
  es.onerror = () => { S.live.state = 'off'; notify(); };
  es.onmessage = m => {
    try {
      const ev = JSON.parse(m.data);
      S.live.events = [ev, ...S.live.events].slice(0, 30);
      notify();
      if ((ev.severity || 0) >= 2) setTimeout(refresh, 250);
    } catch { /* ignore malformed frame */ }
  };
}

// ---------- boot ----------
export async function boot() {
  S.route = parseHash();
  startLive();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await Promise.all([loadAll(), annotPull()]);
      trackTick();
      S.error = null; S.ready = true;
      notify();
      return;
    } catch (e) {
      S.error = e.message;
      S.ready = true;
      notify();
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

export async function refresh() {
  if (document.hidden) return;
  try { await loadAll(); await annotPull(); trackTick(); notify(); } catch { /* keep last data */ }
}

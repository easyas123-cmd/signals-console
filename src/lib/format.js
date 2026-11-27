// Pure, dependency-free formatting and comparison helpers.
// No DOM, no state — safe to unit-reason about.

export const n0 = v => v ?? 0;
export const uniq = a => [...new Set(a)];
export const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export const cmp = (a, b) => a == null ? 1 : b == null ? -1 : a < b ? -1 : a > b ? 1 : 0;

export const fmtT = t => t ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '–';
export const fmtD = t => t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '–';
export const fmtDT = t => t ? fmtD(t) + ' ' + fmtT(t) : '–';
export const fmtWD = t => t ? new Date(t).toLocaleDateString(undefined, { weekday: 'short' }) : '';
export const ago = s => s == null ? '–' : s < 60 ? s + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 ? (s / 3600).toFixed(1) + ' h' : (s / 86400).toFixed(1) + ' d';
export const secsSince = t => t ? Math.max(0, Math.round((Date.now() - new Date(t)) / 1000)) : null;
export const isNew = (t, h = 24) => { const s = secsSince(t); return s != null && s < h * 3600; };
export const dtime = d => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export const macRe = /\b([0-9A-F]{2}(?::[0-9A-F]{2}){5})\b/gi;
export const isRandomMac = m => !!m && /^[0-9A-F][26AE]:/i.test(m);
export const bandOf = ch => { const c = parseInt(ch, 10); return isNaN(c) ? '?' : c <= 14 ? '2.4' : '5'; };

export const vend = x => (x?.manuf && x.manuf !== 'Unknown') ? x.manuf : '';
export const sigLevel = v => v == null ? 0 : [-85, -75, -65, -55].filter(x => v >= x).length;
export const prox = v => v == null ? null : v >= -55 ? { label: 'next to sensor', cls: 'bad' } : v >= -68 ? { label: 'same room', cls: 'warn' } : v >= -78 ? { label: 'in house', cls: '' } : { label: 'outside', cls: '' };
export const sigPct = v => v == null ? 0 : Math.max(4, Math.min(100, Math.round((v + 95) / 45 * 100)));

// tags
export const SUGGEST = ['mine', 'household', 'guest', 'neighbour', 'iot', 'vehicle', 'suspect', 'investigate'];
export const normTag = t => String(t || '').trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
export const LEGACY_TAGS = { chasity: 'person-a' };
export const tagText = t => t === 'person-a' ? 'Person A' : t;
export const renameTags = tags => Object.fromEntries(Object.entries(tags || {}).map(([k, values]) => [k, uniq((Array.isArray(values) ? values : []).map(t => LEGACY_TAGS[String(t).trim().toLowerCase()] || t))]));
export const tagHue = t => { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
export const normalizeTrackLog = v => Array.isArray(v) ? v : [];

// RF / wireless domain
export const isAdsb = d => d.type === 'aircraft' || d.model === 'ADSB' || String(d.key || '').startsWith('ADSB|');
export const dname = d => d.known?.label || d.identity?.label || d.label;
export const keyOf = r => r.key ? (r.key.includes('|') && /^(ap|client|ble|wifi|rf)\|/.test(r.key) ? r.key : 'rf|' + r.key) : (r.id != null && r.kind !== undefined ? 'ent|' + r.id : null);
export const DIR = { arriving: ['arrived · parked', 'ok'], leaving: ['drove away', 'warn'], passing: ['passed by', 'mut'], offline: ['went silent', 'bad'], unknown: ['moved nearby', 'mut'], parked: ['parked · no motion', 'mut'] };
export const dirTxt = m => { if (!m.closed) return { label: 'active now', cls: 'ok' }; const d = DIR[m.direction] || DIR.unknown; return { label: d[0], cls: d[1] }; };

export const KIND = {
  apple_nearby: ['iPhone / iPad / Watch / Mac in use', 'info'],
  apple_findmy_nearby: ['Apple device, Find My beacon (with owner)', ''],
  apple_findmy_separated: ['Apple Find My — separated (AirTag / lost device)', 'bad'],
  apple_other: ['Apple, other beacon', ''],
  tile: ['Tile tracker', 'bad'],
  samsung_smarttag: ['Samsung SmartTag', 'bad'],
  google_findmy: ['Google Find My Device beacon', 'bad'],
  hp_fastpair: ['Google Fast Pair (headphones etc.)', ''],
  ble_other: ['BLE, unclassified', ''],
};
export const kindText = k => { if (!k) return ''; const d = KIND[k]; return d ? d[0] : k.startsWith('vendor_') ? 'vendor ' + k.slice(7) : k; };
export const kindCls = k => (KIND[k] || ['', ''])[1];
export const kindShort = k => k ? k.replace(/^apple_/, '').replace(/^vendor_/, 'vendor ') : '';

export const FLAG = {
  rogue: 'advertises one of our SSIDs from an untrusted BSSID (WF-002)',
  open: 'our SSID seen open/WEP (WF-008)',
  probe: 'untrusted client probing for our SSID (WF-004)',
  assoc: 'untrusted client associated to our AP (WF-009)',
  recur: 'recurring unknown client (WF-005)',
  blerecur: 'untrusted BLE device seen on ≥3 days (WF-006)',
};
export const flagCls = f => (f === 'rogue' || f === 'open') ? 'bad' : (f === 'probe' || f === 'blerecur' || f === 'assoc' || f === 'recur') ? 'warn' : '';

export const noBeacon = a => !(a.ssids && a.ssids.length) && !a.crypt && !a.hidden;
export const apName = a => (a.ssids && a.ssids.length ? a.ssids.join(', ') : '') || (a.hidden ? '‹hidden›' : noBeacon(a) ? '‹no beacon›' : a.name || '');
export function secOf(a) {
  const c = a.crypt || '';
  if (!c) return noBeacon(a) ? ['unknown', 'no beacon captured yet — BSSID inferred from client frames', ''] : a.hidden ? ['?', 'hidden, no beacon crypt', ''] : ['open', 'no encryption', 'bad'];
  if (/WEP/.test(c)) return ['WEP', c, 'bad'];
  if (/WPA3/.test(c)) return [/WPA2/.test(c) ? 'WPA2/3' : 'WPA3', c, 'ok'];
  if (/WPA2/.test(c)) return [/TKIP/.test(c) ? 'WPA2+TKIP' : /EAP/.test(c) ? 'WPA2-EAP' : 'WPA2', c, /TKIP/.test(c) ? 'warn' : ''];
  if (/WPA/.test(c)) return ['WPA1', c, 'warn'];
  return [c.split(' ')[0], c, ''];
}

export function bandName(f) {
  if (f < 26.9) return 'HF top edge / low VHF';
  if (f < 28) return 'CB radio 27 MHz';
  if (f < 29.7) return '10 m ham';
  if (f < 50) return 'low VHF (land mobile)';
  if (f < 54) return '6 m ham';
  if (f < 88) return 'VHF low TV / business';
  if (f < 108) return 'FM broadcast';
  if (f < 118) return 'airband nav (VOR/ILS)';
  if (f < 137) return 'airband voice';
  if (f < 144) return '137 MHz weather sats';
  if (f < 148) return '2 m ham';
  if (f < 151.8) return 'VHF land mobile';
  if (f < 154.6) return 'MURS / VHF itinerant';
  if (f < 162) return 'marine VHF';
  if (f < 162.7) return 'NOAA weather radio';
  if (f < 174) return 'VHF land mobile / marine';
  if (f < 216) return 'VHF high TV';
  if (f < 300) return 'aero / land mobile';
  if (f < 320) return '315 MHz fobs/ISM';
  if (f < 450) return '433 ISM · fobs, TPMS, sensors';
  if (f < 470) return 'UHF business/FRS/GMRS';
  if (f < 608) return 'UHF TV';
  if (f < 652) return 'LTE band 71 downlink';
  if (f < 698) return 'LTE band 71 uplink';
  if (f < 806) return 'LTE 700 (12/13/14/17)';
  if (f < 902) return 'cellular 850 / public safety';
  if (f < 928) return '915 ISM · LoRa, meters, Z-Wave';
  if (f < 960) return 'paging / GSM-900';
  if (f < 1080) return 'aero nav (DME/TACAN)';
  if (f < 1100) return 'ADS-B / Mode-S 1090';
  if (f < 1240) return 'aero / 23 cm ham';
  if (f < 1300) return '23 cm ham / GNSS L2';
  if (f < 1427) return 'radio astronomy (quiet)';
  if (f < 1560) return 'satcom downlink';
  if (f < 1610) return 'GNSS L1 (GPS 1575)';
  if (f < 1627) return 'Iridium uplink';
  if (f < 1710) return 'meteorological sats';
  return '';
}

export function csvOf(rows, cols) {
  const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [
    cols.map(c => q(String(c.l).replace(/<[^>]+>/g, ''))).join(','),
    ...rows.map(r => cols.map(c => q(c.csv ? c.csv(r) : (c.get ? c.get(r) : r[c.k]))).join(',')),
  ].join('\n');
}

// Optional external dashboard base (e.g. a Grafana/Kibana URL). Empty = feature hidden.
export const WZ = '';
export const wzq = q => !WZ ? '' : WZ + '/app/discover#/?_g=(time:(from:now-30d,to:now))&_a=(query:(language:kuery,query:\'' + encodeURIComponent(q).replace(/'/g, '%27') + '\'))';
export const trustCmd = (mac, label) => `sudo signals-wifi trust ${mac} --label '${label || '…'}'`;

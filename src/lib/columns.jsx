// Shared table column definitions (ported from the previous console).
import { S, macHref, devHref, apHref, clHref, entHref, addrHref, noteOf, isTracked, isWatched, isNewW } from './store.js';
import { Icon, rfIcon, bleIcon } from '../components/icons.jsx';
import { Chip, Star, Tag, Empty } from '../components/ui.jsx';
import {
  ago, apName, bandOf, clip, dname, flagCls, FLAG, fmtDT, isRandomMac, kindCls, kindShort, kindText,
  noBeacon, prox, secOf, tagHue, tagText, trustCmd, vend,
} from './format.js';

const flags = x => (
  <>
    {(x.flags || []).map(f => <Chip key={f} cls={flagCls(f)} sm title={FLAG[f] || f}>{f}</Chip>)}
    {x.trusted && <Chip cls="ok" sm>{x.label || 'trusted'}</Chip>}
    {x.ours && <Chip cls="acc" sm>ours</Chip>}
    {isNewW(x) && <span className="new">new</span>}
  </>
);
const tagChips = k => (S.tags[k] || []).map(t => <span key={t} className="tag" style={{ '--h': tagHue(t) }}>{tagText(t)}</span>);
const noteChip = k => noteOf(k) ? <Chip cls="vio" sm title={noteOf(k)}>✎ {clip(noteOf(k), 28)}</Chip> : null;
const secChip = a => { const [l, t, cls] = secOf(a); return <Chip cls={cls} sm title={t}>{l}</Chip>; };
const dstate = d => {
  if ((d.known?.kind === 'car') || d.identity?.kind === 'vehicle') return d.present === true ? <><span className="dot ok" />home</> : d.present === false ? <><span className="dot warn" />away</> : <><span className="dot" />unknown</>;
  if (!d.transient) return d.present === false ? <><span className="dot bad" />off air</> : <><span className="dot ok" />on air</>;
  return <span className="mut">–</span>;
};

export const RF_COLS = compact => [
  { k: 'name', l: 'Device', get: d => dname(d) || d.key, csv: d => dname(d) || d.key, r: d => <><b>{dname(d) || d.key}</b> {dchips(d)}</> },
  { k: 'state', l: 'State', get: d => d.present, nw: true, r: dstate },
  ...(compact ? [] : [{ k: 'visits', l: 'Visits', num: true }, { k: 'days_seen', l: 'Days', num: true }]),
  { k: 'count', l: 'Decodes', num: true },
  { k: 'max_snr', l: 'Max SNR', num: true, r: d => d.max_snr != null ? d.max_snr.toFixed(1) : '–' },
  { k: 'last_seen', l: 'Last seen', get: d => d.last_seen, csv: d => d.last_seen, r: d => <span className="nw">{ago(d.age_seconds)} ago</span> },
  ...(compact ? [] : [{ k: 'freq_mhz', l: 'MHz', num: true }, { k: 'last', l: 'Last reading', sort: false, r: d => <small className="mono mut">{Object.entries(d.last_decode || {}).filter(([k]) => k !== 'type').map(([k, v]) => k + '=' + v).join(' ')}</small> }]),
];
export function dchips(d) {
  return (
    <>
      {d.known ? <Chip cls="ok" sm>{d.known.kind || 'known'}</Chip>
        : d.identity ? <Chip cls="acc" sm title="automatic grouping; confirm manually">{d.identity.label} · provisional</Chip>
          : d.transient ? <Chip sm>vehicle</Chip> : <Chip cls="acc" sm>untagged</Chip>}
      {d.recurring && <Chip cls="bad" sm>recurring</Chip>}
      {d.silent && <Chip cls="bad" sm>silent</Chip>}
      {tagChips('rf|' + d.key)}
      {noteChip('rf|' + d.key)}
    </>
  );
}

export const AP_COLS = [
  { k: 'ssid', l: 'SSID', get: apName, r: a => <><b className={noBeacon(a) || a.hidden ? 'mut' : ''}>{apName(a)}</b>{a.ssids && a.ssids.length > 1 ? <span className="l2">{a.ssids.length} SSIDs</span> : null}</> },
  { k: 'mac', l: 'BSSID', nw: true, r: a => <><span className="mac">{a.mac}</span> <span className="chips">{flags(a)}</span><span className="l2">{vend(a)}</span></> },
  { k: 'sec', l: 'Security', get: a => secOf(a)[0], csv: a => a.crypt, r: a => <>{secChip(a)}{a.mfp_required ? <Chip cls="ok" sm title="802.11w management-frame protection required — deauth attacks fail">MFP</Chip> : null}{a.wps === 2 ? <Chip cls="bad" sm title="WPS pairing window open">WPS open</Chip> : a.wps ? <Chip sm title="WPS IE present, state configured (benign)">WPS</Chip> : null}</> },
  { k: 'ch', l: 'Ch', num: true, get: a => parseInt(a.channel, 10) || 0, r: a => <><span className="num">{a.channel || '?'}</span><span className="l2">{bandOf(a.channel)} GHz</span></> },
  { k: 'signal', l: 'Signal', num: true, nw: true, get: a => a.signal || null, csv: a => a.signal, r: a => a.signal == null ? <span className="mut">–</span> : <><span className="num">{a.signal}</span>{a.max_signal != null && a.max_signal !== a.signal ? <span className="mut num"> / {a.max_signal}</span> : null}</> },
  { k: 'clients', l: 'Clients', num: true, r: a => { const n = (S.wifi._clientsOfAp.get(a.mac) || []).length; return <>{a.clients ?? 0}{n ? <span className="l2">{n} in table</span> : null}</>; } },
  { k: 'days_seen', l: 'Days', num: true },
  { k: 'first_seen', l: 'First seen', nw: true, r: a => fmtDT(a.first_seen) },
  { k: 'last_seen', l: 'Last seen', nw: true, csv: a => a.last_seen, r: a => ago(a.age_seconds) + ' ago' },
];

export const CL_COLS = [
  {
    k: 'mac', l: 'Client', nw: true, r: c => (
      <>
        <span className="mac">{c.mac}</span>
        {isRandomMac(c.mac) ? <Chip sm title="locally-administered (randomised) address — phones rotate these per network">random</Chip> : null}
        {' '}<span className="chips">{flags(c)}</span>
        <span className="l2">{vend(c) || (isRandomMac(c.mac) ? '' : 'unknown vendor')}{c.name && c.name !== c.mac ? ' · ' + c.name : ''}</span>
      </>
    ),
  },
  {
    k: 'ap', l: 'Associated to', csv: c => c.bssid, get: c => c.on_ours ? 'a' : c.bssid ? 'b' + c.bssid : 'z', r: c => {
      if (!c.bssid || /^00:00/.test(c.bssid)) return <span className="mut">–</span>;
      const ap = S.wifi._apByMac.get(c.bssid); const lbl = S.wifi._bssidLabel(c.bssid);
      const probeOnly = Array.isArray(c.client_of) && !c.client_of.includes(c.bssid);
      return <><a href={apHref({ mac: c.bssid })} className={probeOnly ? 'mut' : ''}>{lbl || (ap ? apName(ap) : c.bssid)}</a>{c.on_ours ? <Chip cls="acc" sm>ours</Chip> : probeOnly ? <Chip sm title="only a probe request/response exchange with this BSSID — never joined it">probe only</Chip> : null}</>;
    },
  },
  { k: 'probed', l: 'Probed for', sort: false, csv: c => (c.probed || []).join('|'), r: c => (c.probed || []).map(s => <Chip key={s} cls={S.wifi._ourSsids.has(s) ? 'warn' : ''} sm>{s}</Chip>) },
  { k: 'signal', l: 'Signal', num: true, nw: true, csv: c => c.signal, r: c => c.signal == null ? '–' : c.signal },
  { k: 'ch', l: 'Ch', num: true, get: c => parseInt(c.channel, 10) || 0, r: c => c.channel || '?' },
  { k: 'packets', l: 'Pkts', num: true },
  { k: 'days_seen', l: 'Days', num: true },
  { k: 'first_seen', l: 'First seen', nw: true, r: c => fmtDT(c.first_seen) },
  { k: 'last_seen', l: 'Last seen', nw: true, csv: c => c.last_seen, r: c => ago(c.age_seconds) + ' ago' },
];

export const ENT_COLS = [
  { k: 'id', l: '#', num: true, r: e => <span className="mono">{e.id}</span> },
  { k: 'present', l: '', nw: true, get: e => e.present ? 1 : 0, r: e => <span className={'dot ' + (e.present ? 'ok' : '')} title={e.present ? 'advert in the last 2 min' : 'not present'} /> },
  { k: 'kind', l: 'Kind', r: e => <>{kindChip(e)} {e.tracker ? <Chip cls="bad" sm>tracker-class</Chip> : null}{e.phone_class ? <Chip cls="info" sm>phone</Chip> : null} {tagChips('ent|' + e.id)}{noteChip('ent|' + e.id)}{isWatched('ent|' + e.id) ? <span className="warn"> ★</span> : null}</> },
  { k: 'manuf', l: 'Vendor / name', get: e => vend(e) || e.name, r: e => <>{vend(e) || '?'}{e.name ? <> · <b>{e.name}</b></> : null}</> },
  { k: 'signal', l: 'Signal', num: true, nw: true, csv: e => e.signal, r: e => e.signal == null ? '–' : e.signal },
  { k: 'prox', l: 'Where', sort: false, get: e => e.signal, r: e => { const p = prox(e.present ? e.signal : e.max_signal); return p ? <Chip cls={p.cls} sm>{p.label}</Chip> : null; } },
  { k: 'minutes_present', l: 'Span', num: true, title: 'first → last advert of this entity', r: e => ago(e.minutes_present * 60) },
  { k: 'addrs', l: 'Addrs', num: true, title: 'rotating addresses chained into this entity' },
  { k: 'current_addr', l: 'Current address', nw: true, r: e => <span className="mac">{e.current_addr}</span> },
  { k: 'last_seen', l: 'Last seen', nw: true, csv: e => e.last_seen, r: e => ago(e.age_seconds) + ' ago' },
];
const kindChip = e => { const k = e.kind; if (!k) return null; return <Chip cls={kindCls(k)} sm title={kindText(k)}>{kindShort(k)}</Chip>; };
export { kindChip };

export const BLE_COLS = [
  {
    k: 'mac', l: 'Address', nw: true, r: b => (
      <>
        <span className="mac">{b.mac}</span> <Chip sm title={addrKindTitle(b.addr_kind)}>{b.addr_kind || ''}</Chip>
        {b.classic ? <Chip sm>classic</Chip> : null} <span className="chips">{flags(b)}</span>
      </>
    ),
  },
  { k: 'kind', l: 'Kind', r: b => <>{kindChip(b)}{b.entity_id != null ? <a className="chip sm" href={entHref({ id: b.entity_id })}>#{b.entity_id}</a> : null}</> },
  { k: 'manuf', l: 'Vendor / name', get: b => vend(b) || b.name, r: b => <>{vend(b) || '?'}{b.name ? <> · <b>{b.name}</b></> : null}</> },
  { k: 'signal', l: 'Signal', num: true, nw: true, csv: b => b.signal, r: b => b.signal == null ? '–' : b.signal },
  { k: 'prox', l: 'Where', sort: false, get: b => b.max_signal, r: b => { const p = prox(b.max_signal); return p ? <Chip cls={p.cls} sm>{p.label}</Chip> : null; } },
  { k: 'packets', l: 'Adverts', num: true },
  { k: 'days_seen', l: 'Days', num: true },
  { k: 'first_seen', l: 'First seen', nw: true, r: b => fmtDT(b.first_seen) },
  { k: 'last_seen', l: 'Last seen', nw: true, csv: b => b.last_seen, r: b => ago(b.age_seconds) + ' ago' },
];
const addrKindTitle = k => k === 'rpa' ? 'resolvable private address — rotates ~15 min' : k === 'nrpa' ? 'non-resolvable private address' : k === 'static' ? 'static random address — stable until reboot/reset' : 'public (IEEE) address — permanent';

export const AL_COLS = [
  { k: 'at', l: 'Latest', nw: true, r: a => <span className="nw">{fmtDT(a.at)}</span> },
  { k: 'severity', l: 'Sev', num: true, r: a => <span className={'sev' + (a.severity >= 3 ? ' s3' : a.severity >= 2 ? ' s2' : '')}>{a.severity}</span> },
  { k: 'type', l: 'Type', nw: true, r: a => <span className="mono">{a.type.replace(/^wifi_/, '')}</span> },
  { k: 'n', l: '×', num: true, title: 'repeats of the same type for the same device in this feed', r: a => a._n > 1 ? <b>{a._n}</b> : null },
  { k: 'message', l: 'Message', r: a => linkifyMacs(a.message) },
];

// Linkify MACs inside already-plain text (React-safe: builds elements, no HTML).
export function linkifyMacs(text) {
  const parts = String(text ?? '').split(/(\b[0-9A-F]{2}(?::[0-9A-F]{2}){5}\b)/gi);
  return parts.map((p, i) => {
    if (/^\b[0-9A-F]{2}(?::[0-9A-F]{2}){5}\b$/i.test(p)) {
      const h = macHref(p);
      return h ? <a key={i} className="mac" href={h}>{p}</a> : <span key={i} className="mac">{p}</span>;
    }
    return p;
  });
}

export { flags, tagChips, noteChip, secChip, Empty };

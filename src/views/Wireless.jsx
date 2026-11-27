import { S, useStore, apHref, clHref, entHref, href, macHref, isNewW } from '../lib/store.js';
import { Panel, DataTable, Stat, Chip, Empty, Filters, applyFilter, quick, QuickBox, Tools, ToggleDense, CsvButton, ChannelChart, SignalBar, Metric } from '../components/ui.jsx';
import { AP_COLS, CL_COLS, ENT_COLS, BLE_COLS, AL_COLS, secChip, flags } from '../lib/columns.jsx';
import { ago, apName, bandOf, clip, kindCls, kindShort, n0, noBeacon, prox, secOf, uniq, vend } from '../lib/format.js';

const TABS = [['overview', 'Overview'], ['aps', 'Access points'], ['clients', 'Clients'], ['ble', 'Bluetooth'], ['alerts', 'Alerts']];

export default function Wireless({ tab }) {
  useStore();
  const W = S.wifi;
  if (!W) return <Panel><Empty>No wireless data yet — this section reads <code>wifi.json</code> written by <code>collect_wifi.py</code>. Install the Wi-Fi/BLE sensor (<code>wifi_install.sh</code>).</Empty></Panel>;
  const c = W.counts || {};
  const nav = (
    <div className="subnav">
      {TABS.map(([k, l]) => (
        <a key={k} className={tab === k ? 'on' : ''} href={'#/wireless' + (k === 'overview' ? '' : '/' + k)}>
          {l}<span className="n">{
            k === 'aps' ? c.aps : k === 'clients' ? c.clients : k === 'ble' ? c.ble : k === 'alerts' ? (W.alerts || []).length : null
          }</span>
        </a>
      ))}
    </div>
  );
  return (
    <>
      {nav}
      {tab === 'overview' && <Overview />}
      {tab === 'aps' && <Aps />}
      {tab === 'clients' && <Clients />}
      {tab === 'ble' && <Ble />}
      {tab === 'alerts' && <Alerts />}
    </>
  );
}

function Overview() {
  const W = S.wifi, c = W.counts || {}, sen = W.sensor || {}, bs = W.ble_sensor || {};
  const aps = W.aps || [], cls = W.clients || [], ents = W.entities || [];
  const ours = aps.filter(a => a.ours || W._ourBssids.has(a.mac));
  const nb = aps.filter(a => !ours.includes(a));
  const weak = nb.filter(a => ['open', 'WEP', 'WPA1', 'WPA2+TKIP'].includes(secOf(a)[0]));
  const here = ents.filter(e => e.present).sort((a, b) => (b.signal || -999) - (a.signal || -999));
  const newAps = aps.filter(isNewW);
  const newCl = cls.filter(x => isNewW(x) && (x.on_ours || (x.flags || []).length));
  const newBle = ents.filter(e => isNewW(e) && (e.tracker || e.phone_class));
  const activeCl = cls.filter(x => x.on_ours && (x.age_seconds ?? 1e9) < 600);
  const alerts = (W.alerts || []).slice(0, 8);

  return (
    <>
      <div className="metrics">
        <Metric label="Wi-Fi sensor" value={sen.status || '?'} cls={sen.status === 'running' ? 'ok' : 'bad'} dot={sen.status === 'running' ? 'ok' : 'bad'} sub={`Kismet on wlp2s0 · log ${ago(sen.log_age_seconds)} old`} />
        <Metric label="BLE sensor" value={bs.status || '?'} cls={bs.status === 'running' ? 'ok' : 'bad'} dot={bs.status === 'running' ? 'ok' : 'bad'} sub={`${bs.scan_state || ''} · ${n0(bs.reports).toLocaleString()} reports`} />
        <Metric label="Clients on our APs" value={activeCl.length} sub={`last 10 min · ${n0(c.clients_on_ours)} in 24 h`} />
        <Metric label="Open flags" value={n0(c.flagged)} cls={c.flagged ? 'warn' : ''} sub={`${(W.alerts || []).length} alert events`} />
      </div>
      <div className="grid2">
        <Panel title="Here now" sub="BLE entities · advert in the last 2 min" flush>
          <div className="rowlist">
            {here.slice(0, 12).map(e => (
              <div key={e.id}>
                <Chip cls={kindCls(e.kind)} sm>{kindShort(e.kind)}</Chip>
                <a href={entHref(e)}><b>{e.name || e.manuf || 'device'}</b></a>
                <span className="mut mono" style={{ fontSize: 11.5 }}>#{e.id}</span>
                <span className="mut" style={{ marginLeft: 'auto' }}>{e.tracker ? 'tracker' : e.phone_class ? 'phone' : ''}</span>
                <SignalBar v={e.signal} />
              </div>
            ))}
            {!here.length && <Empty>Nothing advertising within the last 2 minutes.</Empty>}
          </div>
        </Panel>
        <Panel title="Our radios" count={`${ours.length} BSSIDs · ${(W.known?.ssids || []).length} SSIDs declared`} flush
          right={<a href="#/wireless/aps?f=ours" className="panel-count">details →</a>}>
          <div className="rowlist">
            {ours.map(a => (
              <div key={a.mac}>
                <a href={apHref(a)}><b>{apName(a)}</b></a>
                <span className="mut">ch {a.channel} · {bandOf(a.channel)} GHz</span>
                {secChip(a)}
                {a.mfp_required ? <Chip cls="ok" sm>MFP</Chip> : <Chip cls="warn" sm title="no 802.11w — deauth floods work against this BSSID">no MFP</Chip>}
                <span className="mut num" style={{ marginLeft: 'auto' }}>{n0(a.clients)} clients</span>
              </div>
            ))}
            {!ours.length && <Empty>No SSIDs declared yet — <code>sudo signals-wifi ssid add "…"</code></Empty>}
          </div>
        </Panel>
      </div>
      <div className="grid2">
        <Panel title="Neighbourhood">
          <div className="rowlist">
            <div><span>{nb.length} neighbour APs</span><span className="mut" style={{ marginLeft: 'auto' }}>{uniq(nb.flatMap(a => a.ssids || [])).length} distinct SSIDs</span></div>
            <div>
              <span>{weak.length ? <span className="warn">{weak.length}</span> : '0'} weak / open</span>
              <span className="mut" style={{ marginLeft: 'auto' }}>
                {weak.slice(0, 4).map(a => <a key={a.mac} href={apHref(a)} style={{ marginRight: 6 }}>{clip(apName(a), 22)}</a>)}
              </span>
            </div>
            <div><span>{nb.filter(a => a.hidden).length} hidden</span>
              <span className="mut" style={{ marginLeft: 'auto' }}>
                {nb.filter(a => a.ssids && a.ssids.some(s => W._ourSsids.has(s))).length
                  ? <span className="bad">{nb.filter(a => a.ssids && a.ssids.some(s => W._ourSsids.has(s))).length} advertise OUR SSID from an untrusted BSSID</span>
                  : 'no one is advertising our SSIDs'}
              </span>
            </div>
          </div>
        </Panel>
        <Panel title="Channel occupancy" count="APs per channel · all seen"><ChannelChart aps={aps} /></Panel>
      </div>
      <Panel title="New in the last 24 h" flush>
        {(newAps.length + newCl.length + newBle.length) ? (
          <div className="rowlist">
            {newAps.slice(0, 12).map(a => <div key={'a' + a.mac}><Chip sm>AP</Chip><a href={apHref(a)}>{apName(a)}</a><span className="mut mono">{a.mac}</span><span className="mut" style={{ marginLeft: 'auto' }}>{a.first_seen?.slice(0, 10)}</span></div>)}
            {newCl.slice(0, 12).map(x => <div key={'c' + x.mac}><Chip sm>client</Chip><a href={clHref(x)} className="mono">{x.mac}</a><span className="mut">{vend(x)}</span><span className="mut" style={{ marginLeft: 'auto' }}>{x.first_seen?.slice(0, 10)}</span></div>)}
            {newBle.slice(0, 12).map(e => <div key={'e' + e.id}><Chip sm>BLE</Chip><a href={entHref(e)}>#{e.id}</a><span className="mut">{e.manuf}</span><span className="mut" style={{ marginLeft: 'auto' }}>{e.first_seen?.slice(0, 10)}</span></div>)}
          </div>
        ) : <Empty>Nothing new — no new APs, flagged clients, or phone/tracker entities.</Empty>}
        <p className="note" style={{ padding: '10px 14px 14px' }}>
          Only flagged clients (on our APs or probing our SSIDs) and phone/tracker entities are listed.
          Everything first seen in the sensor's first hour counts as baseline, not new.
        </p>
      </Panel>
      <Panel title="Latest alerts" count={`${alerts.length} shown`} right={<a href="#/wireless/alerts" className="panel-count">all →</a>} flush>
        {alerts.length ? <DataTable id="w-al-ov" rows={alerts} cols={AL_COLS} defaultSort="-at" limit={8} /> : <Empty>Quiet.</Empty>}
      </Panel>
    </>
  );
}

function Aps() {
  const W = S.wifi, all = W.aps || [];
  const F = [
    ['all', 'All'], ['active', 'Active 10 min', a => (a.age_seconds ?? 1e9) < 600],
    ['ours', 'Ours', a => a.ours || W._ourBssids.has(a.mac)],
    ['nb', 'Neighbours', a => !(a.ours || W._ourBssids.has(a.mac))],
    ['24', '2.4 GHz', a => bandOf(a.channel) === '2.4'], ['5', '5 GHz', a => bandOf(a.channel) === '5'],
    ['weak', 'Weak / open', a => ['open', 'WEP', 'WPA1', 'WPA2+TKIP'].includes(secOf(a)[0])],
    ['hidden', 'Hidden', a => a.hidden], ['nobeacon', 'No beacon', noBeacon],
    ['flag', 'Flagged', a => (a.flags || []).length], ['new', 'New 24 h', isNewW],
  ];
  const f = S.route.q.f || 'all';
  const rows = quick(applyFilter(F, all, f), ['mac', 'manuf', 'crypt', 'channel', a => (a.ssids || []).join(' '), 'label']);
  return (
    <Panel flush>
      <Tools><Filters defs={F} rows={all} cur={f} /><QuickBox ph="SSID, BSSID, vendor, channel…" /><ToggleDense /><CsvButton name="access-points" rows={rows} cols={AP_COLS} /></Tools>
      <DataTable id="aps" rows={rows} cols={AP_COLS} href={apHref} defaultSort="-signal" limit={200}
        rowCls={a => (a.age_seconds ?? 1e9) > 86400 ? 'stale' : ''} />
      <p className="note" style={{ padding: '10px 14px 14px' }}>
        <b>‹no beacon›</b> rows are BSSIDs Kismet inferred from client frames only — security and signal are unknown, not open.
        Declare your SSIDs with <code>sudo signals-wifi ssid add "…"</code> and trust your BSSIDs with <code>sudo signals-wifi trust &lt;bssid&gt; --label …</code>.
      </p>
    </Panel>
  );
}

function Clients() {
  const W = S.wifi, all = W.clients || [];
  const F = [
    ['all', 'All'], ['active', 'Active 10 min', c => (c.age_seconds ?? 1e9) < 600], ['onours', 'On our APs', c => c.on_ours],
    ['probing', 'Probing our SSIDs', c => (c.probed || []).some(s => W._ourSsids.has(s))], ['probes', 'Any probes', c => (c.probed || []).length],
    ['assoc', 'Associated anywhere', c => Array.isArray(c.client_of) ? c.client_of.length > 0 : (c.bssid && !/^00:00/.test(c.bssid))],
    ['fixed', 'Fixed MAC', c => !/^[0-9A-F][26AE]:/i.test(c.mac)], ['random', 'Random MAC', c => /^[0-9A-F][26AE]:/i.test(c.mac)],
    ['trusted', 'Trusted', c => c.trusted], ['flag', 'Flagged', c => (c.flags || []).length], ['new', 'New 24 h', isNewW],
  ];
  const f = S.route.q.f || 'all';
  const rows = quick(applyFilter(F, all, f), ['mac', 'manuf', 'name', 'label', c => (c.probed || []).join(' '), c => W._bssidLabel(c.bssid)]);
  return (
    <Panel flush>
      <Tools><Filters defs={F} rows={all} cur={f} /><QuickBox ph="MAC, vendor, SSID probed, AP…" /><ToggleDense /><CsvButton name="wifi-clients" rows={rows} cols={CL_COLS} /></Tools>
      <DataTable id="clients" rows={rows} cols={CL_COLS} href={clHref} defaultSort="-last_seen" limit={200}
        rowCls={c => (c.age_seconds ?? 1e9) > 86400 ? 'stale' : ''} />
      <p className="note" style={{ padding: '10px 14px 14px' }}>
        <b>Random MAC</b> (second hex digit 2/6/A/E) is normal for phones since iOS 14 / Android 10 — one phone can be dozens of rows.
        Identify a device on your AP by its vendor + timing, then <code>sudo signals-wifi trust &lt;mac&gt; --label …</code>.
      </p>
    </Panel>
  );
}

function Ble() {
  const W = S.wifi;
  const lens = S.route.q.v === 'addr' ? 'addr' : 'ent';
  const ents = W.entities || [], addrs = W.ble || [];
  const FE = [['all', 'All'], ['present', 'Present now', e => e.present], ['phones', 'Phones', e => e.phone_class], ['trackers', 'Tracker-class', e => e.tracker], ['multi', 'Rotated ≥2 addrs', e => e.addrs >= 2], ['long', 'Here ≥ 1 h', e => e.minutes_present >= 60], ['new', 'New 24 h', isNewW]];
  const FA = [['all', 'All'], ['present', 'Present now', b => (b.age_seconds ?? 1e9) < 120], ['fixed', 'Fixed address', b => b.addr_kind === 'public' || b.addr_kind === 'static'], ['rpa', 'Rotating (RPA)', b => b.addr_kind === 'rpa'], ['trackers', 'Tracker-class', b => b.tracker], ['named', 'Has a name', b => b.name], ['trusted', 'Trusted', b => b.trusted], ['flag', 'Flagged', b => (b.flags || []).length], ['new', 'New 24 h', isNewW]];
  const f = S.route.q.f || 'all';
  const sw = (
    <span className="seg">
      <a className={lens === 'ent' ? 'on' : ''} href={href(S.route.path, { ...S.route.q, v: '', f: '', all: '' })}>Entities</a>
      <a className={lens === 'addr' ? 'on' : ''} href={href(S.route.path, { ...S.route.q, v: 'addr', f: '', all: '' })}>Addresses</a>
    </span>
  );
  if (lens === 'ent') {
    const rows = quick(applyFilter(FE, ents, f), ['manuf', 'name', 'kind', 'current_addr', e => '#' + e.id]);
    return (
      <Panel flush>
        <Tools>{sw}<Filters defs={FE} rows={ents} cur={f} /><QuickBox ph="vendor, name, kind, address…" /><ToggleDense /><CsvButton name="ble-entities" rows={rows} cols={ENT_COLS} /></Tools>
        <DataTable id="ents" rows={rows} cols={ENT_COLS} href={entHref} defaultSort="-last_seen" limit={200}
          rowCls={e => e.present ? '' : ((e.age_seconds ?? 1e9) > 86400 ? 'stale' : '')} />
        <p className="note" style={{ padding: '10px 14px 14px' }}>
          <b>Entities</b> chain the rotating addresses of one device by advert signature and timing.
          <b> findmy_separated</b>, <b>tile</b>, <b>smarttag</b>, <b>google_findmy</b> = tracker-class — the question is whether it moves with <i>you</i>.
        </p>
      </Panel>
    );
  }
  const rows = quick(applyFilter(FA, addrs, f), ['mac', 'manuf', 'name', 'kind', 'label', 'addr_kind']);
  return (
    <Panel flush>
      <Tools>{sw}<Filters defs={FA} rows={addrs} cur={f} /><QuickBox ph="address, vendor, name, kind…" /><ToggleDense /><CsvButton name="ble-addresses" rows={rows} cols={BLE_COLS} /></Tools>
      <DataTable id="addrs" rows={rows} cols={BLE_COLS} href={a => href(['wireless', 'addr', a.mac])} defaultSort="-last_seen" limit={200}
        rowCls={b => (b.age_seconds ?? 1e9) > 86400 ? 'stale' : ''} />
    </Panel>
  );
}

function Alerts() {
  const W = S.wifi;
  const all = groupAlertsLocal(W.alerts || []);
  const types = uniq(all.map(a => a.type)).sort();
  const F = [['all', 'All'], ['s2', 'Sev ≥ 2', a => a.severity >= 2], ['s3', 'Sev ≥ 3', a => a.severity >= 3], ...types.map(t => [t, t.replace(/^wifi_/, ''), a => a.type === t])];
  const f = S.route.q.f || 'all';
  const rows = quick(applyFilter(F, all, f), ['message', 'type']);
  return (
    <Panel flush>
      <Tools><Filters defs={F} rows={all} cur={f} /><QuickBox ph="text or MAC…" /><CsvButton name="wifi-alerts" rows={rows} cols={AL_COLS} /></Tools>
      <DataTable id="alerts" rows={rows} cols={AL_COLS} defaultSort="-at" limit={200}
        href={a => a._mac ? macHref(a._mac) : null} />
      <p className="note" style={{ padding: '10px 14px 14px' }}>
        Rule map: WF-001 Kismet alert · WF-002 rogue AP · WF-003 new AP · WF-004 probe for our SSID · WF-005 recurring unknown client ·
        WF-006 untrusted BLE ≥3 days · WF-007 sensor down · WF-008 our SSID open/WEP · WF-009 client on our AP · WF-010 tracker episode.
        Sev ≥ 2 opens an incident.
      </p>
    </Panel>
  );
}

function groupAlertsLocal(alerts) {
  const m = new Map();
  for (const a of alerts) { const k = a.type + '|' + (a._mac || a.message); if (!m.has(k)) m.set(k, { ...a, _n: 0, _first: a.at }); const g = m.get(k); g._n++; if (a.at < g._first) g._first = a.at; }
  return [...m.values()];
}

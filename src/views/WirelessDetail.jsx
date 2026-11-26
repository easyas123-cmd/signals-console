import { S, useStore, apHref, clHref, entHref, addrHref, href } from '../lib/store.js';
import { Panel, DataTable, Stat, Chip, Empty, Star, Cmd, NotesCard, SignalBar, Strip, Days, Hours, DashboardLink } from '../components/ui.jsx';
import { AP_COLS, CL_COLS, ENT_COLS, BLE_COLS, AL_COLS, secChip, flags, kindChip, linkifyMacs } from '../lib/columns.jsx';
import { ago, apName, bandOf, clip, fmtD, fmtDT, isRandomMac, kindShort, n0, noBeacon, prox, secOf, trustCmd, vend } from '../lib/format.js';

export default function WirelessDetail({ kind, id }) {
  useStore();
  const W = S.wifi;
  if (!W) return <Panel><Empty>No wireless data yet.</Empty></Panel>;
  if (kind === 'ap') return <Ap mac={id} />;
  if (kind === 'client') return <Client mac={id} />;
  if (kind === 'entity') return <Entity id={id} />;
  return <Addr mac={id} />;
}

const alertsFor = mac => { const m = String(mac).toUpperCase(); return (S.wifi.alerts || []).filter(a => (a._macs || []).includes(m)); };
function groupAlerts(alerts) {
  const m = new Map();
  for (const a of alerts) { const k = a.type + '|' + (a._mac || a.message); if (!m.has(k)) m.set(k, { ...a, _n: 0 }); const g = m.get(k); g._n++; }
  return [...m.values()];
}
function AlertsPanel({ mac }) {
  const al = groupAlerts(alertsFor(mac));
  return (
    <Panel title="Alerts mentioning this device" flush right={<DashboardLink q={`"${mac}"`} label="history" />}>
      {al.length ? <DataTable id={'al-' + mac} rows={al} cols={AL_COLS} defaultSort="-at" /> : <Empty>None in the current feed.</Empty>}
    </Panel>
  );
}
function ActivityPanel({ x }) {
  if (!x?.hours && !(x?.days && x.days.length) && !(x?.timeline && x.timeline.length)) return null;
  return (
    <Panel title="Activity" count="collector minutes with traffic">
      {x.timeline?.length ? <><div className="panel-sub" style={{ marginBottom: 6 }}>Presence · last 48 h</div><Strip tl={x.timeline} /></> : null}
      {x.hours ? <><div className="panel-sub" style={{ margin: '10px 0 6px' }}>Hour of day</div><Hours hrs={x.hours} /></> : null}
      {x.days?.length ? <><div className="panel-sub" style={{ margin: '10px 0 6px' }}>Days seen</div><Days days={x.days} /></> : null}
    </Panel>
  );
}

function Ap({ mac }) {
  const W = S.wifi, a = W._apByMac.get(mac);
  if (!a) return <Panel><Empty>{mac} is not in the current inventory.</Empty></Panel>;
  const cl = W._clientsOfAp.get(mac) || [];
  const lbl = W._bssidLabel(mac);
  const [sec, secT] = secOf(a);
  const key = 'ap|' + a.mac;
  return (
    <>
      <div className="page-title"><span className="crumb"><a href="#/wireless">Wireless</a> / <a href="#/wireless/aps">Access points</a> / <span className="mono">{a.mac}</span></span><div className="right"><Star k={key} /></div></div>
      <h1 style={{ fontSize: 23, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>{apName(a)} {secChip(a)}</h1>
      <div className="stats">
        <Stat value={<>{a.signal ?? '–'}<small> dBm</small></>} label={'signal · max ' + (a.max_signal ?? '–')} />
        <Stat value={<>{a.channel || '?'}<small> · {bandOf(a.channel)} GHz</small></>} label="channel" />
        <Stat value={n0(a.clients)} label={`clients (Kismet) · ${cl.length} in table`} />
        <Stat value={a.days_seen} label={'days seen · since ' + fmtD(a.first_seen)} />
        <Stat value={ago(a.age_seconds)} label={'since last beacon · ' + fmtDT(a.last_seen)} />
      </div>
      <div className="grid2">
        <Panel title="Identity">
          <dl className="kv">
            <dt>BSSID</dt><dd><span className="mac">{a.mac}</span> {lbl ? <Chip cls="ok" sm>{lbl}</Chip> : null}{a.ours ? <Chip cls="acc" sm>ours</Chip> : null}</dd>
            <dt>Vendor</dt><dd>{a.manuf || '?'}</dd>
            <dt>SSIDs</dt><dd>{(a.ssids || []).length ? a.ssids.map(s => <Chip key={s} cls={W._ourSsids.has(s) ? 'acc' : ''} sm>{s}</Chip>) : <span className="mut">none</span>}{a.hidden ? <Chip sm>hidden SSID</Chip> : null}</dd>
            <dt>Security</dt><dd>{secChip(a)} <span className="mono mut">{secT}</span></dd>
            <dt>802.11w</dt><dd>{a.mfp_required ? <span className="ok">MFP required</span> : <span className="warn">not required</span>}</dd>
            <dt>WPS</dt><dd>{a.wps === 2 ? <span className="bad">state 2 — pairing window OPEN</span> : a.wps ? 'state ' + a.wps : <span className="mut">no WPS IE</span>}</dd>
            <dt>Packets</dt><dd>{n0(a.packets).toLocaleString()}</dd>
            <dt>Flags</dt><dd>{flags(a)}</dd>
          </dl>
        </Panel>
        <NotesCard k={key} label={apName(a)} />
      </div>
      <Panel title="Clients associated to this BSSID" count={`${cl.length} in table · Kismet counts ${n0(a.clients)}`} flush>
        {cl.length ? <DataTable id="ap-cl" rows={cl} cols={CL_COLS.filter(c => c.k !== 'ap')} href={clHref} defaultSort="-last_seen" /> : <Empty>No clients in the current table.</Empty>}
      </Panel>
      <div className="grid2">
        <ActivityPanel x={a} />
        <AlertsPanel mac={mac} />
        {a.ours || lbl
          ? <Cmd cmd={`sudo secops-wifi untrust ${a.mac}`} note="Only if this radio is not yours after all." />
          : <Cmd cmd={trustCmd(a.mac, apName(a))} note="Only for radios you own. A neighbour's AP stays untrusted — trusting it would hide a real evil twin." />}
      </div>
    </>
  );
}

function Client({ mac }) {
  const W = S.wifi, c = W._clByMac.get(mac);
  if (!c) return <Panel><Empty>{mac} is not in the current table.</Empty></Panel>;
  const ap = c.bssid ? W._apByMac.get(c.bssid) : null;
  const lbl = c.bssid ? W._bssidLabel(c.bssid) : null;
  const rnd = isRandomMac(c.mac);
  const key = 'client|' + c.mac;
  return (
    <>
      <div className="page-title"><span className="crumb"><a href="#/wireless">Wireless</a> / <a href="#/wireless/clients">Clients</a> / <span className="mono">{c.mac}</span></span><div className="right"><Star k={key} /></div></div>
      <h1 style={{ fontSize: 23, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mono">{c.mac}</span> {c.trusted ? <Chip cls="ok" sm>{c.label || 'trusted'}</Chip> : null}
      </h1>
      <div className="stats">
        <Stat value={<>{c.signal ?? '–'}<small> dBm</small></>} label={'signal · max ' + (c.max_signal ?? '–')} />
        <Stat value={ap || lbl ? clip(lbl || apName(ap), 22) : '–'} label={c.on_ours ? 'associated to OUR AP' : c.bssid && !/^00:00/.test(c.bssid) ? 'associated to' : 'not associated'} />
        <Stat value={c.days_seen} label={'days seen · since ' + fmtD(c.first_seen)} />
        <Stat value={n0(c.packets).toLocaleString()} label="packets" />
        <Stat value={ago(c.age_seconds)} label={'since last frame · ' + fmtDT(c.last_seen)} />
      </div>
      <div className="grid2">
        <Panel title="Identity">
          <dl className="kv">
            <dt>MAC</dt><dd><span className="mac">{c.mac}</span> {rnd ? <Chip sm>random / locally administered</Chip> : <Chip cls="ok" sm>fixed (burned-in)</Chip>}</dd>
            <dt>Vendor</dt><dd>{vend(c) || (rnd ? '— (randomised addresses carry no vendor)' : 'unknown')}</dd>
            {c.name && c.name !== c.mac ? <><dt>Name</dt><dd>{c.name}</dd></> : null}
            <dt>Channel</dt><dd>{c.channel || '?'} · {bandOf(c.channel)} GHz</dd>
            <dt>Probed for</dt><dd>{(c.probed || []).length ? c.probed.map(s => <Chip key={s} cls={W._ourSsids.has(s) ? 'warn' : ''} sm>{s}</Chip>) : <span className="mut">no directed probes seen</span>}</dd>
            <dt>Flags</dt><dd>{flags(c)}</dd>
          </dl>
          <p className="note" style={{ marginTop: 10 }}>
            {rnd ? 'A randomised MAC is re-generated per SSID, so the same phone appears as a new client each time. Identify it by what it probes for and which AP it joins.'
              : 'A burned-in MAC is a stable identity: the vendor prefix + days seen usually tells you what it is.'}
          </p>
        </Panel>
        <NotesCard k={key} label={c.mac} />
      </div>
      <div className="grid2">
        <ActivityPanel x={c} />
        <AlertsPanel mac={mac} />
        {c.trusted
          ? <Cmd cmd={`sudo secops-wifi untrust ${c.mac}`} />
          : <Cmd cmd={trustCmd(c.mac, c.manuf || '')} note="Only once you know what it is. Trusted clients stop raising WF-004/005/009." />}
      </div>
    </>
  );
}

function Entity({ id }) {
  const W = S.wifi, e = W._entById.get(id);
  if (!e) return <Panel><Empty>Entity #{id} is not in the current file (entities are pruned when silent for days).</Empty></Panel>;
  const addrs = (W._addrsOfEnt.get(id) || []).sort((a, b) => (b.last_seen || '').localeCompare(a.last_seen || ''));
  const fixed = addrs.find(b => b.addr_kind === 'public' || b.addr_kind === 'static');
  const key = 'ent|' + id;
  return (
    <>
      <div className="page-title"><span className="crumb"><a href="#/wireless">Wireless</a> / <a href="#/wireless/ble">Bluetooth</a> / #{id}</span><div className="right"><Star k={key} /></div></div>
      <h1 style={{ fontSize: 23, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        {kindChip(e)} {e.name || e.manuf || 'entity'}
        {e.tracker ? <Chip cls="bad" sm>tracker-class</Chip> : null}{e.phone_class ? <Chip cls="info" sm>phone</Chip> : null}
      </h1>
      <div className="stats">
        <Stat value={e.present ? 'present' : 'away'} cls={e.present ? 'ok' : ''} label={e.present ? 'advert in the last 2 min' : 'last advert ' + ago(e.age_seconds) + ' ago'} />
        <Stat value={<>{e.signal ?? '–'}<small> dBm</small></>} label={'signal · max ' + (e.max_signal ?? '–')} />
        <Stat value={ago(e.minutes_present * 60)} label="span first → last advert" />
        <Stat value={e.addrs} label="addresses chained" />
        <Stat value={fmtDT(e.first_seen)} label="first seen" />
      </div>
      <div className="grid2">
        <Panel title="What is it">
          <dl className="kv">
            <dt>Kind</dt><dd>{kindChip(e)} {kindShort(e.kind)}</dd>
            <dt>Vendor</dt><dd>{e.manuf || '?'}{e.name ? <> · <b>{e.name}</b></> : null}</dd>
            <dt>Class</dt><dd>{e.tracker ? <span className="bad">tracker-class beacon</span> : e.phone_class ? <span className="info">phone-class (in use)</span> : <span className="mut">other</span>}</dd>
            <dt>Current address</dt><dd><span className="mac">{e.current_addr}</span></dd>
          </dl>
          <p className="note" style={{ marginTop: 10 }}>
            {e.tracker ? 'Is it following you? A tracker that is yours or a household member\u2019s leaves with them. One that stays when everyone is out is the one to find.'
              : e.phone_class ? 'Nearby Info adverts mean the screen is on. Rotating addresses break chains when the device sleeps.'
                : 'Match the vendor and the RSSI pattern against what you own.'}
          </p>
        </Panel>
        <NotesCard k={key} label={(e.manuf || 'entity') + ' #' + id} />
      </div>
      {activityCard(e) ? <div className="grid2">{activityCard(e)}<Panel title="Reading the presence strip"><p className="note">Each cell is 10 minutes; filled = at least one advert, green = strong (≥ −65 dBm).</p></Panel></div> : null}
      <Panel title="Addresses in this entity" count={`${addrs.length} · newest first`} flush>
        {addrs.length ? <DataTable id="ent-addrs" rows={addrs} cols={BLE_COLS.filter(c => c.k !== 'kind')} href={addrHref} defaultSort="-last_seen" /> : <Empty>The addresses are no longer in the file.</Empty>}
      </Panel>
      <div className="grid2">
        <Panel title="Alerts mentioning any of its addresses" flush>
          {groupAlerts((W.alerts || []).filter(a => (a._macs || []).some(m => addrs.some(b => b.mac === m)))).length
            ? <DataTable id="ent-al" rows={groupAlerts((W.alerts || []).filter(a => (a._macs || []).some(m => addrs.some(b => b.mac === m))))} cols={AL_COLS} defaultSort="-at" />
            : <Empty>None in the current feed.</Empty>}
        </Panel>
        {fixed
          ? <Cmd cmd={trustCmd(fixed.mac, e.name || e.manuf || '')} note="Static/public addresses are stable; this makes the whole device known." />
          : <Panel title="Trusting"><p className="note">This entity only uses rotating (RPA) addresses — there is nothing stable to trust. Keep a research note instead.</p></Panel>}
      </div>
    </>
  );
}
const activityCard = x => (x?.hours || (x?.days && x.days.length) || (x?.timeline && x.timeline.length)) ? <ActivityPanel x={x} /> : null;

function Addr({ mac }) {
  const W = S.wifi, b = W._bleByMac.get(mac);
  if (!b) return <Panel><Empty>{mac} is not in the current file.</Empty></Panel>;
  const e = b.entity_id != null ? W._entById.get(b.entity_id) : null;
  const fixed = b.addr_kind === 'public' || b.addr_kind === 'static';
  const key = 'ble|' + b.mac;
  return (
    <>
      <div className="page-title"><span className="crumb"><a href="#/wireless">Wireless</a> / <a href="#/wireless/ble?v=addr">Bluetooth</a> / <span className="mono">{b.mac}</span></span><div className="right"><Star k={key} /></div></div>
      <h1 style={{ fontSize: 23, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}><span className="mono">{b.mac}</span> {kindChip(b)}</h1>
      <div className="stats">
        <Stat value={<>{b.signal ?? '–'}<small> dBm</small></>} label={'signal · max ' + (b.max_signal ?? '–')} />
        <Stat value={n0(b.packets).toLocaleString()} label="adverts" />
        <Stat value={b.days_seen} label={'days seen · since ' + fmtD(b.first_seen)} />
        <Stat value={ago(b.age_seconds)} label={'since last advert · ' + fmtDT(b.last_seen)} />
        {e ? <Stat value={'#' + e.id} label={'entity · ' + e.addrs + ' addresses chained'} href={entHref(e)} /> : <Stat value="–" label="not chained to an entity" />}
      </div>
      <div className="grid2">
        <Panel title="Identity">
          <dl className="kv">
            <dt>Address</dt><dd><span className="mac">{b.mac}</span> <Chip sm>{b.addr_kind}</Chip>{b.classic ? <Chip sm>classic BR/EDR</Chip> : null}</dd>
            <dt>Kind</dt><dd>{kindChip(b)} {kindShort(b.kind)}</dd>
            <dt>Vendor</dt><dd>{b.manuf || '?'}{b.name ? <> · <b>{b.name}</b></> : null}</dd>
            {b.findmy_mode ? <><dt>Find My</dt><dd>{b.findmy_mode}</dd></> : null}
            {b.tx_power != null ? <><dt>TX power</dt><dd>{b.tx_power} dBm (advertised)</dd></> : null}
            <dt>In house</dt><dd>{b.in_house ? <span className="ok">yes</span> : <span className="mut">no / unknown</span>}</dd>
            <dt>Flags</dt><dd>{flags(b)}</dd>
          </dl>
        </Panel>
        <NotesCard k={key} label={b.mac} />
      </div>
      <div className="grid2">
        <ActivityPanel x={b} />
        <AlertsPanel mac={mac} />
        {b.trusted ? <Cmd cmd={`sudo secops-wifi untrust ${b.mac}`} />
          : fixed ? <Cmd cmd={trustCmd(b.mac, b.name || b.manuf || '')} note="Static/public addresses are stable." />
            : <Panel title="Trusting"><p className="note">Rotating address — trusting it is pointless (it changes in ~15 min). Research the <a href={e ? entHref(e) : '#/wireless/ble'}>entity</a> instead.</p></Panel>}
      </div>
    </>
  );
}

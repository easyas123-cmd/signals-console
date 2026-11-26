import { S, useStore, devHref, apHref, clHref, entHref, addrHref, macHref, noteOf } from '../lib/store.js';
import { Panel, DataTable, Empty, DashboardLink, Chip } from '../components/ui.jsx';
import { AP_COLS, CL_COLS, ENT_COLS, BLE_COLS, AL_COLS, RF_COLS, linkifyMacs } from '../lib/columns.jsx';
import { ago, dname, dirTxt, fmtDT, fmtT, fmtWD, isAdsb } from '../lib/format.js';

export default function Search() {
  useStore();
  const raw = (S.route.q.q || '').trim();
  const q = raw.toLowerCase();
  const W = S.wifi;
  const hit = (...f) => f.filter(Boolean).join(' ').toLowerCase().includes(q);
  if (!q) {
    return (
      <Panel title="Search" sub="MACs, SSIDs, vendors, RF ids, models, alert text, incident uids, notes">
        <Empty>Type in the box above. Tip: a partial MAC like <code>4C:43</code> or an OUI vendor like <code>Wyze</code> works.</Empty>
      </Panel>
    );
  }
  const sec = [];

  const rf = (S.sum?.devices || []).filter(d => hit(d.key, dname(d), d.model, d.type, d.known?.owner, noteOf('rf|' + d.key)));
  if (rf.length) sec.push(
    <Panel key="rf" title="RF devices" count={rf.length} flush>
      <DataTable id="s-rf" rows={rf.slice(0, 30)} cols={RF_COLS(true)} href={devHref} defaultSort="-last_seen" />
    </Panel>);

  if (W) {
    const aps = (W.aps || []).filter(a => hit(a.mac, a.manuf, a.crypt, (a.ssids || []).join(' '), a.label, noteOf(a.key)));
    if (aps.length) sec.push(<Panel key="ap" title="Access points" count={aps.length} flush><DataTable id="s-ap" rows={aps.slice(0, 30)} cols={AP_COLS} href={apHref} defaultSort="-last_seen" /></Panel>);
    const cl = (W.clients || []).filter(c => hit(c.mac, c.manuf, c.name, c.label, (c.probed || []).join(' '), noteOf(c.key)));
    if (cl.length) sec.push(<Panel key="cl" title="Wi-Fi clients" count={cl.length} flush><DataTable id="s-cl" rows={cl.slice(0, 30)} cols={CL_COLS} href={clHref} defaultSort="-last_seen" /></Panel>);
    const en = (W.entities || []).filter(e => hit('#' + e.id, e.manuf, e.name, e.kind, e.current_addr, noteOf('ent|' + e.id)));
    if (en.length) sec.push(<Panel key="en" title="BLE entities" count={en.length} flush><DataTable id="s-en" rows={en.slice(0, 30)} cols={ENT_COLS} href={entHref} defaultSort="-last_seen" /></Panel>);
    const bl = (W.ble || []).filter(b => hit(b.mac, b.manuf, b.name, b.kind, b.label, noteOf(b.key)));
    if (bl.length) sec.push(<Panel key="bl" title="BLE addresses" count={bl.length} flush><DataTable id="s-bl" rows={bl.slice(0, 30)} cols={BLE_COLS} href={addrHref} defaultSort="-last_seen" /></Panel>);
    const al = groupAlerts((W.alerts || []).filter(a => hit(a.message, a.type)));
    if (al.length) sec.push(<Panel key="al" title="Wireless alerts" count={al.length} flush><DataTable id="s-al" rows={al.slice(0, 30)} cols={AL_COLS} defaultSort="-at" href={a => a._mac ? macHref(a._mac) : null} /></Panel>);
  }

  const inc = [...(S.inc?.open || []), ...(S.inc?.recent_closed || [])].filter(i => hit(i.uid, i.summary, i.classification, (i.events || []).map(e => e.message).join(' ')));
  if (inc.length) sec.push(
    <Panel key="inc" title="Incidents" count={inc.length}>
      <div className="rowlist">
        {inc.slice(0, 10).map(i => (
          <div key={i.uid}>
            <Chip cls={i.severity === 'high' || i.severity === 'critical' ? 'bad' : i.severity === 'medium' ? 'warn' : ''} sm>{i.severity}</Chip>
            <a href="#/incidents?f=all"><b>{i.summary}</b></a>
            <span className="mut mono" style={{ fontSize: 11.5 }}>{i.uid}</span>
          </div>
        ))}
      </div>
    </Panel>);

  const mv = (S.sum?.movements || []).filter(m => hit(m.name, m.device));
  if (mv.length) sec.push(
    <Panel key="mv" title="Movements" count={mv.length}>
      <div className="rowlist">
        {mv.slice(0, 20).map((m, i) => {
          const d = dirTxt(m);
          return <div key={i}><b>{m.name}</b><Chip cls={d.cls === 'ok' ? 'ok' : d.cls === 'warn' ? 'warn' : ''} sm>{d.label}</Chip><span className="mut" style={{ marginLeft: 'auto' }}>{fmtWD(m.start)} {fmtT(m.start)}</span></div>;
        })}
      </div>
    </Panel>);

  return (
    <>
      <div className="page-title">
        <h1 style={{ fontSize: 20 }}>Search: <span className="mono">{raw}</span></h1>
        <div className="right"><DashboardLink q={raw.replace(/"/g, '')} label="search history" /></div>
      </div>
      <p className="note">{sec.length ? sec.length + ' categories' : 'no matches'} · history beyond the current files lives in the archive.</p>
      {sec.length ? sec : <Panel><Empty>Nothing in the current data.</Empty></Panel>}
    </>
  );
}

function groupAlerts(alerts) {
  const m = new Map();
  for (const a of alerts) { const k = a.type + '|' + (a._mac || a.message); if (!m.has(k)) m.set(k, { ...a, _n: 0 }); const g = m.get(k); g._n++; }
  return [...m.values()];
}

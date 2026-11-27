import { useState } from 'react';
import { S, useStore, setQ, macHref, devHref } from '../lib/store.js';
import { Panel, Section, Filters, applyFilter, quick, QuickBox, Tools, Chip, Empty, Sev, DashboardLink } from '../components/ui.jsx';
import { ago, clip, fmtDT, secsSince } from '../lib/format.js';

export default function Incidents() {
  useStore();
  const I = S.inc;
  if (!I) return <Panel><Empty>No incident feed yet — <code>incidents.json</code> is written by the incident exporter.</Empty></Panel>;
  const all = [...(I.open || []).map(i => ({ ...i, _open: true })), ...(I.recent_closed || [])];
  const F = [
    ['open', 'Open', i => i._open],
    ['high', 'High / critical', i => i._open && (i.severity === 'high' || i.severity === 'critical')],
    ['closed', 'Recently closed', i => !i._open],
    ['all', 'All'],
  ];
  const f = S.route.q.f || 'open';
  const rows = quick(applyFilter(F, all, f), ['uid', 'summary', 'classification', i => (i.events || []).map(e => e.message).join(' ')]);

  return (
    <>
      <Section title="Incidents"
        sub={`${I.counts?.open || 0} open${I.counts?.open_high ? ` · ${I.counts.open_high} high/critical` : ''} · opened by the correlator from severity ≥ 2 events`}>
        <Tools><Filters defs={F} rows={all} cur={f} /><QuickBox ph="filter by uid, text, MAC…" /></Tools>
        {rows.map(i => <IncidentRow key={i.uid} i={i} />)}
        {!rows.length && <Panel><Empty>Nothing here. Good.</Empty></Panel>}
        <p className="note">Close or suppress with <code>sudo signals-incident</code>; the change propagates within a minute.</p>
      </Section>
    </>
  );
}

function IncidentRow({ i }) {
  const [open, setOpen] = useState(false);
  const sev = i.severity;
  const cls = (sev === 'critical' || sev === 'high') ? 'sev-bad' : sev === 'medium' ? '' : 'sev-none';
  const keys = [...new Set((i.events || []).map(e => e.device_key).filter(Boolean))];
  const macs = keys.filter(k => /^(ap|client|ble|wifi)\|/.test(k)).map(k => k.split('|')[1]);
  const rf = keys.filter(k => !/^(ap|client|ble|wifi)\|/.test(k));
  return (
    <article className={'inc ' + cls} style={{ alignItems: 'start' }}>
      <div className="inc-left">
        <span className="inc-sev">{sev}</span>
        <span className="inc-uid">{i.uid}</span>
      </div>
      <div className="inc-mid">
        <h3 className="inc-title clamp2" title={i.summary}>{i.summary}</h3>
        <p className="inc-body">
          opened {fmtDT(i.opened_at)} · updated {fmtDT(i.updated_at)}
          {i.classification ? ' · ' + i.classification.replace(/_/g, ' ') : ''}
          {i.confidence != null ? ` · conf ${(i.confidence * 100).toFixed(0)}%` : ''}
        </p>
        <p className="inc-body clamp3">
          {rf.map(k => { const d = S.sum?.devices.find(x => x.key === k); return d ? <a key={k} href={devHref(d)}>{dnameOf(d)}</a> : <span key={k} className="mono">{k}</span>; })
            .concat(macs.map(m => { const h = macHref(m); return <span key={m}>{h ? <a className="mac" href={h}>{m}</a> : <span className="mac">{m}</span>}</span>; }))
            .reduce((acc, el, idx) => idx ? [...acc, ' · ', el] : [el], [])}
        </p>
        {(i.findings || []).length > 0 && (
          <p className="inc-body clamp3">
            {i.findings.map((f, idx) => <span key={idx} style={{ marginRight: 10 }}><Chip sm>{f.type}</Chip> {f.summary}</span>)}
          </p>
        )}
        {open && (
          <div className="inc-detail">
            {(i.events || []).map((e, idx) => (
              <div className="ev" key={idx}>
                <span className="t">{fmtDT(e.at)}</span>
                <Sev level={e.severity} />
                <span><span className="mono mut" style={{ fontSize: 11.5 }}>{e.category}/{e.type}</span> {e.message}</span>
              </div>
            ))}
            {i.status === 'open' && (
              <pre className="cmd">sudo signals-incident close {i.id} --reason '…'
                <button type="button" className="btn sm" onClick={() => navigator.clipboard.writeText(`sudo signals-incident close ${i.id} --reason ''`)}>copy</button>
              </pre>
            )}
          </div>
        )}
      </div>
      <div className="inc-right">
        <span className="inc-meta">{i.status}<br />{i.events?.length || 0} events</span>
        <button type="button" className="btn accent" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Investigate'}</button>
        <DashboardLink q={`data.signals.uid:"${i.uid}"`} label="history" />
      </div>
    </article>
  );
}

const dnameOf = d => d.known?.label || d.identity?.label || d.label || d.key;

import { useEffect, useState } from 'react';
import { S, useStore, api, devHref, apHref } from '../lib/store.js';
import { Icon, rfIcon } from '../components/icons.jsx';
import { Panel, DataTable, Stat, Chip, Empty, Star, Cmd, NotesCard, Hours, LineChart, Chip as C, DashboardLink } from '../components/ui.jsx';
import { linkifyMacs } from '../lib/columns.jsx';
import { ago, dname, dirTxt, fmtD, fmtDT, fmtT, n0, trustCmd, isNew } from '../lib/format.js';

export default function DeviceDetail({ slug }) {
  useStore();
  const d = S.sum?.devices.find(x => (x.slug || x.key) === slug);
  const [D, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch(api('devices/' + encodeURIComponent(slug) + '.json'), { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const v = await r.json();
        if (live) setD(v);
      } catch (e) { if (live) setErr(e.message); }
    })();
    return () => { live = false; };
  }, [slug]);

  if (!d) return <Panel><Empty>Not in the current inventory.</Empty></Panel>;
  const t = d.known || {}; const identity = d.identity || {}; const key = 'rf|' + d.key;
  const tagCmd = `sudo signals-rf tag '${d.key}' --label '${t.label || '…'}' --kind ${t.kind || (d.transient ? 'car' : 'sensor')}${t.kind === 'car' || d.transient ? ' --present home' : ''}`;
  const visits = [...(D?.visits || [])].reverse();

  return (
    <>
      <div className="page-title">
        <span className="crumb"><a href="#/devices">Devices</a> / <span className="mono">{d.key}</span></span>
        <div className="right"><Star k={key} /></div>
      </div>
      <h1 style={{ fontSize: 23, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name={rfIcon(d)} size={20} />{dname(d)}
        {t.label ? <Chip cls="ok" sm>{t.kind}</Chip> : identity.label ? <Chip cls="acc" sm>{identity.label} · provisional</Chip> : <Chip cls="acc" sm>untagged</Chip>}
        {d.recurring ? <Chip cls="bad" sm>recurring</Chip> : null}
      </h1>

      <div className="stats">
        <Stat value={<>{d.present === true ? 'home' : d.present === false ? 'away' : d.transient ? '–' : 'on air'}</>} label="state" />
        <Stat value={ago(d.age_seconds)} label={'since last decode · ' + fmtDT(d.last_seen)} />
        <Stat value={<>{n0(d.visits)} <small>/ {n0(d.days_seen)} d</small></>} label={'visits / days seen · since ' + fmtD(d.first_seen)} />
        <Stat value={<>{d.max_snr != null ? d.max_snr.toFixed(1) : '–'}<small> dB</small></>} label={'max SNR · last ' + (d.last_snr != null ? d.last_snr.toFixed(1) : '–') + ' dB'} />
      </div>

      <div className="grid2">
        <Panel title="Last 7 days" count="00:00 → 24:00"><Timeline visits={D?.visits || []} /></Panel>
        <Panel title="Hour-of-day profile">
          <Hours hrs={D?.hours || d.hours} />
          <div className="panel-sub" style={{ margin: '10px 0 6px' }}>Signal · last {(D?.recent || []).length} decodes · RSSI / SNR</div>
          <LineChart vals={(D?.recent || []).map(r => r.rssi)} second={(D?.recent || []).map(r => r.snr)} min={-40} max={0} h={80} />
        </Panel>
      </div>

      <div className="grid2">
        <Panel title="Identity">
          <dl className="kv">
            <dt>Tag</dt><dd>{t.label ? <>{t.label} <Chip cls="ok" sm>{t.kind}</Chip>{t.owner ? ' · ' + t.owner : ''}</> : identity.label ? <>{identity.label} <Chip cls="acc" sm>provisional</Chip></> : <span className="mut">untagged</span>}</dd>
            <dt>Key</dt><dd className="mono">{d.key}</dd>
            <dt>Model</dt><dd>{d.model || ''}{d.type ? ' · ' + d.type : ''} · {d.freq_mhz ?? '?'} MHz {d.mod || ''}</dd>
            <dt>First seen</dt><dd>{fmtDT(d.first_seen)}</dd>
            <dt>Decodes</dt><dd>{d.count}</dd>
            <dt>Last reading</dt><dd className="mono">{Object.entries(d.last_decode || {}).map(([k, v]) => k + '=' + v).join(' · ') || '–'}</dd>
            {t.note ? <><dt>Note</dt><dd>{t.note}</dd></> : null}
          </dl>
          <div className="panel-sub" style={{ margin: '12px 0 6px' }}>{t.label ? 'Re-tag' : 'Tag it'}</div>
          <pre className="cmd">{tagCmd}<button type="button" className="btn sm" onClick={() => navigator.clipboard.writeText(tagCmd)}>copy</button></pre>
        </Panel>
        <NotesCard k={key} label={dname(d)} />
      </div>

      <div className="grid2">
        <Panel title="Seen together" count="visits overlapping ±2 min">
          {(D?.co_occurrence || []).length ? (
            <div className="rowlist">
              {D.co_occurrence.map(c => {
                const o = S.sum.devices.find(x => x.key === c.key);
                return <div key={c.key}><a href={o ? devHref(o) : '#'}>{o ? dname(o) : c.key}</a><span className="mut" style={{ marginLeft: 'auto' }}>{c.overlapping_visits} shared visit{c.overlapping_visits > 1 ? 's' : ''}</span></div>;
              })}
            </div>
          ) : <Empty>No overlapping activity yet.</Empty>}
        </Panel>
        <Panel title="Incidents" right={<DashboardLink q={`data.signals.meta.device_key:"${d.key}"`} label="history" />}>
          {(D?.incidents || []).length ? (
            <div className="rowlist">
              {D.incidents.map(i => (
                <div key={i.uid}>
                  <Chip cls={i.severity === 'high' || i.severity === 'critical' ? 'bad' : i.severity === 'medium' ? 'warn' : ''} sm>{i.severity}</Chip>
                  <span className="mono" style={{ fontSize: 11.5 }}>{i.uid}</span><span className="mut">{i.status}</span>
                  <span style={{ minWidth: 0 }}>{i.summary}</span>
                </div>
              ))}
            </div>
          ) : <Empty>None.</Empty>}
        </Panel>
      </div>

      <Panel title="Visits" count={`${visits.length}`} flush>
        {visits.length ? (
          <DataTable id="rf-visits" rows={visits.slice(0, 60)} defaultSort="-start" cols={[
            { k: 'start', l: 'Start', nw: true, r: v => fmtDT(v.start) },
            { k: 'end', l: 'End', nw: true, r: v => fmtT(v.end) },
            { k: 'count', l: 'Decodes', num: true },
            { k: 'max_snr', l: 'Max SNR', num: true, r: v => v.max_snr != null ? v.max_snr.toFixed(1) : '–' },
            { k: 'direction', l: 'Verdict', r: v => { const dd = dirTxt(v); return <Chip cls={dd.cls === 'ok' ? 'ok' : dd.cls === 'warn' ? 'warn' : ''} sm>{dd.label}</Chip>; } },
            { k: 'reason', l: 'Evidence', r: v => <small className="mut">{v.reason}</small> },
          ]} />
        ) : <Empty>No visits recorded yet (history starts when tracking was enabled).</Empty>}
      </Panel>

      <Panel title="Events" flush>
        {(D?.events || []).length ? (
          <DataTable id="rf-ev" rows={D.events} defaultSort="-at" cols={[
            { k: 'at', l: 'When', nw: true, r: e => fmtDT(e.at) },
            { k: 'severity', l: 'Sev', num: true, r: e => <span className={'sev' + (e.severity >= 3 ? ' s3' : e.severity >= 2 ? ' s2' : '')}>{e.severity}</span> },
            { k: 'rule', l: 'Rule', get: e => e.rule || e.type, r: e => <span className="mono">{e.rule || e.type || ''}</span> },
            { k: 'message', l: 'Message', r: e => linkifyMacs(e.message) },
          ]} />
        ) : <Empty>No events.</Empty>}
      </Panel>

      <Panel title="Raw · last decodes">
        <pre>{JSON.stringify((D?.recent || []).slice(-12).reverse(), null, 1)}</pre>
        {err && <p className="bad" style={{ marginTop: 8 }}>drill-down file unavailable: {err}</p>}
      </Panel>
    </>
  );
}

function Timeline({ visits }) {
  const days = [];
  for (let i = 6; i >= 0; i--) { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - i); days.push(x); }
  if (!visits.length) return <Empty>No visits recorded yet.</Empty>;
  return (
    <div className="tl">
      {days.map(day => {
        const end = new Date(day.getTime() + 864e5);
        const segs = visits.filter(v => new Date(v.end) >= day && new Date(v.start) < end).map((v, i) => {
          const a = Math.max(0, (new Date(v.start) - day) / 864e5 * 100), b = Math.min(100, (new Date(v.end) - day) / 864e5 * 100);
          const col = v.direction === 'arriving' ? 'var(--ok)' : v.direction === 'leaving' ? 'var(--warn)' : v.direction === 'offline' ? 'var(--bad)' : v.closed ? 'var(--mut)' : 'var(--info)';
          return <span key={i} title={`${v.direction || 'open'} ${fmtT(v.start)}–${fmtT(v.end)} · ${v.count} decodes`} style={{ left: a + '%', width: Math.max(.6, b - a) + '%', background: col }} />;
        });
        return (
          <div key={day.toISOString()} style={{ display: 'contents' }}>
            <div>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</div>
            <div className="bar">{segs}</div>
          </div>
        );
      })}
      <div className="legend" style={{ gridColumn: '1/-1' }}>
        <span><i style={{ background: 'var(--ok)' }} />arrived</span>
        <span><i style={{ background: 'var(--warn)' }} />left</span>
        <span><i style={{ background: 'var(--mut)' }} />passed / unknown</span>
        <span><i style={{ background: 'var(--bad)' }} />offline</span>
        <span><i style={{ background: 'var(--info)' }} />open</span>
      </div>
    </div>
  );
}

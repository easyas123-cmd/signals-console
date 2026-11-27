import { S, useStore, devHref, trackedKeys, resolveKey, href } from '../lib/store.js';
import { Icon, bleIcon, rfIcon } from '../components/icons.jsx';
import { Metric, Panel, Section, Stat, Chip, Empty, SignalBar, Hours, LineChart, Bars, Tag, toast } from '../components/ui.jsx';
import { ago, clip, cmp, dirTxt, dname, fmtDT, fmtT, isAdsb, n0, prox, secsSince, sigPct, tagText } from '../lib/format.js';

const BANDS = [
  { label: 'Next to sensor', range: '≥ −55 dBm', test: v => v >= -55 },
  { label: 'Same room', range: '−55 to −68', test: v => v < -55 && v >= -68 },
  { label: 'In house', range: '−68 to −78', test: v => v < -68 && v >= -78 },
  { label: 'Outside', range: '< −78 dBm', test: v => v < -78 },
];

export default function Overview() {
  useStore();
  const s = S.sum, n = s.noise || {}, w = s.weather, W = S.wifi, c = W?.counts || {}, H = S.ham;
  const recent = s.devices.filter(d => !isAdsb(d)).sort((a, b) => cmp(b.last_seen, a.last_seen)).slice(0, 8);
  const here = (W?.entities || []).filter(e => e.present).sort((a, b) => cmp(b.signal, a.signal));
  const ks = trackedKeys();
  const trackedHere = ks.filter(k => resolveKey(k)?.present).length;
  const cars = s.devices.filter(d => (d.known?.kind === 'car') || d.identity?.kind === 'vehicle');
  const carsHome = cars.filter(d => d.present === true).length;

  return (
    <div className="now-layout">
      <div className="now-main">
        <Readouts sum={s} W={W} H={H} noise={n} />
        <NeedsAttention />
        <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)' }}>
          <OnAirNow here={here} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Panel title="Here now" sub="advert in the last 2 min" count={<a href="#/wireless/ble?f=present">Tracked →</a>}>
              <div className="stats" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                <Stat value={n0(c.phones_present)} label="phones & wearables" />
                <Stat value={n0(c.trackers_present)} label="tracker-class beacon" cls={c.trackers_present ? 'bad' : ''} />
                <Stat value={<>{trackedHere}<small> / {ks.length}</small></>} label="tracked items here" />
                <Stat value={<>{carsHome}<small> / {cars.length}</small></>} label="vehicles home" />
              </div>
            </Panel>
            <ComingsAndGoings />
          </div>
        </div>
        <div className="grid2">
          <Panel title="Most recent RF transmitters" count={<a href="#/devices">all {s.devices_total} →</a>}>
            <div className="rowlist">
              {recent.map(d => (
                <div key={d.key}>
                  <Icon name={rfIcon(d)} />
                  <a href={devHref(d)}><b>{dname(d)}</b></a>
                  <Chip cls={d.active ? 'ok' : ''} sm>{d.active ? 'on air' : ago(d.age_seconds) + ' ago'}</Chip>
                  <span className="mut" style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12 }}>{d.count} decodes</span>
                </div>
              ))}
              {!recent.length && <Empty>No RF devices yet.</Empty>}
            </div>
          </Panel>
          <Panel title="Noise floor" sub={`last ${(n.recent || []).length * 10 / 60 | 0} min · 433.92 MHz`}>
            <LineChart vals={(n.recent || []).map(x => x[1])} min={-40} max={0} base={n.baseline_db} h={90} fill />
            <div className="panel-sub" style={{ margin: '10px 0 6px' }}>Hourly mean · 7 d</div>
            <Bars vals={Object.keys(n.hourly || {}).sort().slice(-168).map(k => n.hourly[k])} h={56} />
          </Panel>
        </div>
      </div>
      <LiveColumn />
    </div>
  );
}

function Readouts({ sum: s, W, H, noise: n }) {
  const rx = s.receiver || {};
  const rxAge = secsSince(s.generated_at);
  const sen = W?.sensor || {}, bs = W?.ble_sensor || {};
  const hasBase = n.baseline_db != null;
  const d = (n.current_db != null && hasBase) ? n.current_db - n.baseline_db : null;
  const sv = H?.survey?.latest, h = sv?.health;
  const J = S.jobs, w = s.weather;

  const cells = [
    <Metric key="rf" label="RF · 433.92" value={rx.status || 'unknown'} cls={rx.status === 'running' ? 'ok' : 'bad'}
      dot={rx.status === 'running' ? 'ok' : 'bad'} sub={`rtl_433 · ${ago(rxAge)} ago`} />,
    <Metric key="noise" label="Noise floor" value={n.current_db != null ? `${n.current_db.toFixed(1)} dB` : '–'}
      sub={d != null ? <><span className={d >= 6 ? 'down' : 'up'}>{d >= 0 ? '+' : ''}{d.toFixed(1)}</span> vs 7-day base</>
        : hasBase ? <>no reading · base {n.baseline_db.toFixed(1)}</> : 'no baseline'} />,
  ];
  if (W) {
    cells.push(
      <Metric key="wifi" label="Wi-Fi" value={sen.status || '?'} cls={sen.status === 'running' ? 'ok' : 'bad'}
        dot={sen.status === 'running' ? 'ok' : 'bad'} sub={`Kismet · ${ago(sen.log_age_seconds)} ago`} />,
      <Metric key="ble" label="Bluetooth" value={bs.status || '?'} cls={bs.status === 'running' ? 'ok' : 'bad'}
        dot={bs.status === 'running' ? 'ok' : 'bad'} sub={`${n0(bs.reports).toLocaleString()} reports · ${ago(bs.flush_age_seconds)}`} />,
    );
  } else {
    cells.push(
      <Metric key="wifi" label="Wi-Fi" value="no data" cls="bad" sub="install the Wi-Fi/BLE sensor" />,
      <Metric key="ble" label="Bluetooth" value="no data" cls="bad" sub="wifi_install.sh" />,
    );
  }
  cells.push(
    <Metric key="survey" label="Band survey" value={h == null ? '–' : h.noaa_heard ? 'NOAA heard' : (h.miss_streak || 1) >= 2 ? 'deaf?' : 'weak'}
      cls={h == null ? '' : h.noaa_heard ? 'ok' : 'warn'}
      sub={sv ? `${Object.values(sv.bands || {}).reduce((a, b) => a + (b.carriers || []).length, 0)} carriers · ${fmtT(sv.start)}` : 'no survey yet'} />,
    <Metric key="dongle" label="Dongle" value={J?.current ? 'lent' : 'free'} sub={J ? `${J.schedule.length} scheduled · ${J.current ? J.current.job : 'idle'}` : 'no jobs.json'} />,
  );
  if (w) {
    cells.push(
      <Metric key="weather" label="Outdoor" value={w.temp_f != null ? `${w.temp_f.toFixed(0)}°F` : '–'}
        cls={w.stale || w.status === 'stale' ? 'warn' : ''}
        sub={`${w.label || 'thermometer'}${w.stale || w.status === 'stale' ? ' · stale' : ''}`} />,
    );
  }
  return <section className="metrics" aria-label="Sensor readouts">{cells}</section>;
}

function NeedsAttention() {
  const I = S.inc;
  if (!I) return null;
  const open = I.open || [];
  return (
    <Section title="Needs attention" id="att-h"
      sub={`${I.counts?.open || 0} open incidents · opened by the correlator from severity ≥ 2 events`}
      link={open.length ? { href: '#/incidents', label: 'All incidents →' } : null}>
      {open.slice(0, 3).map(i => <IncidentCard key={i.uid} i={i} />)}
      {!open.length && <Panel><Empty>Nothing needs you. Good.</Empty></Panel>}
    </Section>
  );
}

function IncidentCard({ i }) {
  const sev = i.severity;
  const cls = (sev === 'critical' || sev === 'high') ? 'sev-bad' : sev === 'medium' ? '' : 'sev-none';
  const opened = i.opened_at ? `open ${ago(secsSince(i.opened_at))}` : '';
  const detail = (i.findings || []).map(f => f.summary).join(' · ');
  return (
    <article className={'inc ' + cls}>
      <div className="inc-left">
        <span className="inc-sev">{sev}</span>
        <span className="inc-uid">{i.uid?.replace(/^inc-standalone-/, 'inc-')}</span>
      </div>
      <div className="inc-mid">
        <h3 className="inc-title clamp2" title={i.summary}>{i.summary}</h3>
        <p className="inc-body clamp2" title={detail}>{detail || (i.classification ? i.classification.replace(/_/g, ' ') : '')}</p>
      </div>
      <div className="inc-right">
        <span className="inc-meta">{opened}<br />{i.uid}</span>
        <a className="btn accent" href={'#/incidents?f=open'}>Investigate</a>
      </div>
    </article>
  );
}

function OnAirNow({ here }) {
  const groups = BANDS.map(b => ({ ...b, rows: here.filter(e => b.test(e.signal ?? e.max_signal)) }));
  const total = here.length;
  return (
    <Panel title="On air now" sub="heard in the last 2 min · grouped by signal strength"
      count={total ? `${here.filter(e => e.phone_class).length} phones · ${here.filter(e => e.tracker).length} tracker${here.filter(e => e.tracker).length === 1 ? '' : 's'} · ${total} total` : null} flush>
      <div style={{ padding: '4px 0 10px' }}>
        {groups.map(g => g.rows.length > 0 && (
          <div key={g.label}>
            <div className="band">
              <span className="band-label">{g.label}</span>
              <span className="band-range">{g.range}</span>
              <span className="band-rule" />
            </div>
            {g.rows.map(e => <SigRow key={e.id} e={e} />)}
          </div>
        ))}
        {!total && <Empty>Nothing advertising in the last 2 minutes.</Empty>}
      </div>
    </Panel>
  );
}

function SigRow({ e }) {
  const v = e.signal ?? e.max_signal;
  const tags = S.tags['ent|' + e.id] || [];
  return (
    <div className="sigrow">
      <Icon name={bleIcon(e)} />
      <span className="who">
        <b>{e.name || (e.manuf || 'device')}</b>
        <span className="id">#{e.id}</span>
        {tags.map(t => <span key={t} className="tag" style={{ '--h': (t.charCodeAt(0) * 31) % 360 }}>{tagText(t)}</span>)}
      </span>
      <span className="src">{e.tracker ? 'tracker-class' : e.phone_class ? 'in use' : e.manuf || ''}</span>
      <SignalBar v={v} />
    </div>
  );
}

function ComingsAndGoings() {
  const mv = (S.sum?.movements || []).slice(0, 6);
  return (
    <Panel title="Comings & goings" sub="last 48 h" count={<a href="#/movements">Timeline →</a>}>
      {mv.length ? (
        <div className="rowlist">
          {mv.map((m, i) => {
            const d = dirTxt(m);
            const dev = S.sum.devices.find(x => x.key === m.device);
            const dur = Math.max(0, (new Date(m.end) - new Date(m.start)) / 60000);
            return (
              <div key={i}>
                <Icon name={d.cls === 'ok' ? 'car' : 'car'} />
                <span style={{ minWidth: 0 }}>
                  <b>{m.name}</b>
                  {dev ? <> <span className="mut mono" style={{ fontSize: 11.5 }}>{dev.key.split('|').slice(-1)[0]}</span></> : null}
                </span>
                <Chip cls={d.cls === 'ok' ? 'ok' : d.cls === 'warn' ? 'warn' : ''} sm>{d.label}</Chip>
                <span className="mut" style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                  {fmtT(m.start)}{dur >= 1 ? ' · ' + Math.round(dur) + 'm' : ''}
                </span>
              </div>
            );
          })}
        </div>
      ) : <Empty>No visits in the window.</Empty>}
    </Panel>
  );
}

function LiveColumn() {
  const { state, events } = S.live;
  const label = state === 'on' ? 'connected' : state === 'snapshot' ? 'snapshot' : state === 'n/a' ? 'n/a' : 'reconnecting';
  return (
    <aside className="live-col">
      <div className="live-head">
        <span className={'dot ' + (state === 'on' ? 'ok' : state === 'off' ? 'bad' : '')} />
        Live
        <span className="st">{label}</span>
      </div>
      <Panel flush>
        <div className="live-feed">
          {events.map((ev, i) => {
            const type = (ev.event_type || '').replace(/^wifi_alert_/, '').replace(/_/g, ' ');
            const msg = (ev.message || '').replace(/^[A-Z0-9_]{4,}:\s*/, '');
            const t = ev.observed_at ? fmtT(ev.observed_at) : '';
            return (
              <div key={i} className={'live-ev s' + (ev.severity || 0)} style={{ padding: '7px 14px' }}>
                <span className="t">{t}<span>{ev.source || ''}</span></span>
                <span className="m"><b>{type}</b>{msg ? ' · ' + clip(msg, 110) : ''}</span>
              </div>
            );
          })}
          {!events.length && <Empty>No live events yet.</Empty>}
        </div>
      </Panel>
    </aside>
  );
}

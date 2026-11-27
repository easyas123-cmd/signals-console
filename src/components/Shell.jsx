import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { S, useStore, href, trackedKeys, resolveKey } from '../lib/store.js';
import { fmtT, secsSince, dtime, ago } from '../lib/format.js';

const TITLES = {
  '': 'Now', incidents: 'Incidents', movements: 'Timeline', wireless: 'Wireless',
  devices: 'Devices', device: 'Device', tracked: 'Tracked', spectrum: 'Spectrum & sky',
  jobs: 'Sensors & jobs', search: 'Search',
};

function RailLink({ to, icon, label, count, countCls = '', on }) {
  return (
    <a className={'rail-link' + (on ? ' on' : '')} href={to}>
      <Icon name={icon} />
      <span className="lbl">{label}</span>
      {count != null && <span className={'rail-count ' + countCls}>{count}</span>}
    </a>
  );
}

export function Rail({ section, onNavigate }) {
  useStore();
  const W = S.wifi, inc = S.inc?.counts || {}, c = W?.counts || {};
  const ks = trackedKeys();
  const here = ks.filter(k => resolveKey(k)?.present).length;
  const jobState = S.job?.state;
  const jobsOk = !jobState || jobState === 'idle' || jobState === 'succeeded';

  return (
    <nav className="rail" aria-label="Sections">
      <a className="rail-brand" href="#/" onClick={onNavigate}>
        <span className="rail-mark"><Icon name="wireless" size={18} /></span>
        <span className="rail-wordmark"><b>SIGNALS DEFENSE</b><span>RF &amp; Wi-Fi monitor</span></span>
      </a>

      <div className="rail-group">
        <span className="rail-label">Watch</span>
        <RailLink to="#/" icon="now" label="Now" on={section === ''} />
        <RailLink to="#/incidents" icon="incidents" label="Incidents" on={section === 'incidents'}
          count={inc.open || null} countCls={inc.open_high ? 'bad' : ''} />
        <RailLink to="#/movements" icon="timeline" label="Timeline" on={section === 'movements'} />
      </div>

      <div className="rail-group">
        <span className="rail-label">Investigate</span>
        <RailLink to="#/wireless" icon="wireless" label="Wireless" on={section === 'wireless'}
          count={c.trackers_present ? c.trackers_present + ' tracker' : null} countCls="bad" />
        <RailLink to="#/devices" icon="devices" label="Devices" on={section === 'devices' || section === 'device'} />
        <RailLink to="#/tracked" icon="tracked" label="Tracked" on={section === 'tracked'}
          count={ks.length ? (here ? here + '/' : '') + ks.length : null} countCls="ok" />
        <RailLink to="#/spectrum" icon="spectrum" label="Spectrum & sky" on={section === 'spectrum'} />
      </div>

      <div className="rail-group">
        <span className="rail-label">System</span>
        <RailLink to="#/jobs" icon="sensors" label="Sensors & jobs" on={section === 'jobs'}
          count={jobsOk ? 'ok' : jobState} countCls={jobsOk ? 'ok' : ''} />
      </div>

      <div className="rail-spacer" />
      <div className="rail-foot">
        <span className="row">
          <span className={'dot ' + (S.annot.online ? 'ok' : '')} />
          {S.annot.online ? 'Notes & tags synced' : 'This browser only'}
          <span className="rev">rev {S.annot.rev || 0}</span>
        </span>
      </div>
    </nav>
  );
}

export function Shell({ section, onSearch, children }) {
  useStore();
  const [clock, setClock] = useState(() => new Date());
  const [navOpen, setNavOpen] = useState(false);
  const [q, setQ] = useState(S.route.q.q || '');
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setQ(S.route.q.q || ''); }, [S.route.q.q]);
  useEffect(() => { setNavOpen(false); }, [section]);

  const age = secsSince(S.sum?.generated_at);
  const title = TITLES[section] ?? 'Signals Defense';

  return (
    <div className={'app' + (navOpen ? ' nav-open' : '')}>
      <Rail section={section} onNavigate={() => setNavOpen(false)} />
      <div className="main">
        <header className="hdr">
          <button type="button" className="btn sm rail-toggle" aria-label="Sections" onClick={() => setNavOpen(o => !o)}>
            <Icon name="menu" size={16} />
          </button>
          <div className="hdr-titles">
            <h1>{title}</h1>
            <span className="hdr-meta">{dtime(clock)} · {fmtT(clock)} · data {age == null ? '–' : ago(age)} old</span>
          </div>
          <div className="hdr-spacer" />
          <span className="hdr-meta" title="live event feed">
            <span className={'dot ' + (S.live.state === 'on' ? 'ok' : S.live.state === 'off' ? 'bad' : '')} />
            {S.live.state === 'on' ? 'live' : S.live.state === 'snapshot' ? 'snapshot' : S.live.state === 'n/a' ? 'live n/a' : 'live · reconnecting'}
          </span>
          <form className="search" onSubmit={e => { e.preventDefault(); onSearch(q); }}>
            <Icon name="search" />
            <input type="search" value={q} placeholder="Search devices, MACs, SSIDs, notes, incidents…"
              onChange={e => setQ(e.target.value)} aria-label="Search everything" />
            <kbd>/</kbd>
          </form>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function LiveStrip() {
  return null;
}

import { useEffect } from 'react';
import { S, useStore, boot, refresh, parseHash, notify, go } from './lib/store.js';
import { Shell } from './components/Shell.jsx';
import { Toaster, Empty } from './components/ui.jsx';
import Overview from './views/Overview.jsx';
import Incidents from './views/Incidents.jsx';
import Movements from './views/Movements.jsx';
import Jobs from './views/Jobs.jsx';
import Tracked from './views/Tracked.jsx';
import Search from './views/Search.jsx';
import Devices from './views/Devices.jsx';
import DeviceDetail from './views/DeviceDetail.jsx';
import Wireless from './views/Wireless.jsx';
import WirelessDetail from './views/WirelessDetail.jsx';
import Spectrum from './views/Spectrum.jsx';

export default function App() {
  useStore();
  useEffect(() => {
    boot();
    const onHash = () => { S.route = parseHash(); notify(); };
    window.addEventListener('hashchange', onHash);
    const t = setInterval(refresh, 60000);
    return () => { window.removeEventListener('hashchange', onHash); clearInterval(t); };
  }, []);
  useEffect(() => {
    const onKey = e => {
      if (e.key === '/' && !/input|textarea|select/i.test(e.target.tagName)) {
        e.preventDefault();
        const i = document.querySelector('.search input'); if (i) { i.focus(); i.select(); }
      }
      if (e.key === 'Escape' && e.target.classList?.contains('search-input')) e.target.blur();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [a, b, c] = S.route.path;
  const section = a || '';
  const body = render(a, b, c);
  return (
    <>
      <Shell section={section} onSearch={q => go(['search'], { q })}>{body}</Shell>
      <Toaster />
    </>
  );
}

function render(a, b, c) {
  if (!S.ready) return <Empty>Loading…</Empty>;
  if (S.error && !S.sum) return <div className="panel"><div className="panel-body"><span className="bad">Could not load data — {S.error}</span></div></div>;
  switch (a) {
    case undefined: return <Overview />;
    case 'incidents': return <Incidents />;
    case 'movements': return <Movements />;
    case 'jobs': return <Jobs />;
    case 'tracked':
    case 'watchlist': return <Tracked />;
    case 'search': return <Search />;
    case 'devices': return <Devices />;
    case 'device': return b ? <DeviceDetail slug={b} /> : <Devices />;
    case 'spectrum': return <Spectrum view={S.route.q.v === 'sky' ? 'sky' : 'spectrum'} />;
    case 'wireless':
      if (b === 'ap' && c) return <WirelessDetail kind="ap" id={c.toUpperCase()} />;
      if (b === 'client' && c) return <WirelessDetail kind="client" id={c.toUpperCase()} />;
      if (b === 'ble' && c) return <WirelessDetail kind="entity" id={+c} />;
      if (b === 'addr' && c) return <WirelessDetail kind="addr" id={c.toUpperCase()} />;
      return <Wireless tab={b || 'overview'} />;
    default: return <div className="panel"><div className="panel-body">No such page.</div></div>;
  }
}

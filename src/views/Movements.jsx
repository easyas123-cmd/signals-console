import { S, useStore, devHref } from '../lib/store.js';
import { Panel, DataTable, Tools, QuickBox, Chip, Empty } from '../components/ui.jsx';
import { dirTxt, fmtT, fmtWD } from '../lib/format.js';

export default function Movements() {
  useStore();
  const mv = S.sum?.movements || [];
  const q = (S.route.q.q || '').toLowerCase().trim();
  const rows = q ? mv.filter(m => (m.name + ' ' + m.device).toLowerCase().includes(q)) : mv;

  const cols = [
    {
      k: 'start', l: 'When', nw: true, r: m => {
        const st = new Date(m.start), en = new Date(m.end);
        return <span className="nw">{fmtWD(m.start)} {fmtT(m.start)}{en - st > 60000 ? '–' + fmtT(m.end) : ''}</span>;
      },
    },
    {
      k: 'name', l: 'Who', r: m => {
        const d = S.sum.devices.find(x => x.key === m.device);
        return <>{m.known ? <b>{m.name}</b> : m.name}{d ? <> <span className="mut mono" style={{ fontSize: 11.5 }}>{d.key.split('|').slice(-1)[0]}</span></> : null}</>;
      },
    },
    {
      k: 'direction', l: 'What', r: m => { const d = dirTxt(m); return <Chip cls={d.cls === 'ok' ? 'ok' : d.cls === 'warn' ? 'warn' : ''} sm>{d.label}</Chip>; },
    },
    {
      k: 'count', l: 'Evidence', r: m => {
        const sp = Math.max(0, (new Date(m.end) - new Date(m.start)) / 1000);
        const spT = sp < 60 ? sp.toFixed(1) + 's' : sp < 3600 ? Math.round(sp / 60) + 'm' : (sp / 3600).toFixed(1) + 'h';
        return <small className="mut" title={m.reason || ''}>{m.count} decode{m.count === 1 ? '' : 's'} · {spT}{m.max_snr != null ? ` · peak ${Math.round(m.max_snr)}dB` : ''}</small>;
      },
    },
  ];

  return (
    <Panel title="Timeline" sub="arrivals, departures and pass-bys inferred from TPMS and key-fob decodes · last 48 h" flush
      count={`${rows.length} visits`}>
      <Tools><QuickBox ph="filter by name or id…" /></Tools>
      <DataTable id="mv" rows={rows} cols={cols} defaultSort="-start" limit={200} empty="No visits in the window." />
      <p className="note" style={{ padding: '10px 14px 14px' }}>
        A parked car is silent — “drove away” is inferred from a falling RSSI trend, never observed.
        Tag your own cars (<code>signals-rf tag</code>) to turn these into home/away state.
      </p>
    </Panel>
  );
}

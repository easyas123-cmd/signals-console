import { S, useStore, notify, api, loadAll } from '../lib/store.js';
import { Panel, DataTable, Chip, Empty, toast } from '../components/ui.jsx';
import { fmtDT, fmtT } from '../lib/format.js';

async function runJob(job) {
  if (!confirm(`Run ${job} now? Active schedule timers will pause and resume afterward.`)) return;
  try {
    const r = await fetch(api('jobs/trigger'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `request failed (${r.status})`);
    toast(`${job} started`);
    await loadAll(); notify();
  } catch (e) { toast('Could not run ' + job + ': ' + e.message); }
}

export default function Jobs() {
  useStore();
  const J = S.jobs;
  if (!J) return <Panel><Empty>jobs.json not available.</Empty></Panel>;
  const hist = [...(J.history || [])].reverse();
  const active = S.job && ['queued', 'running'].includes(S.job.state);
  const status = S.job && S.job.state !== 'idle' ? S.job : null;

  const schedCols = [
    { k: 'job', l: 'Job', r: s => <span className="mono">{s.job}</span> },
    { k: 'when', l: 'When', r: s => s.when },
    { k: 'minutes', l: 'Length', num: true, r: s => `${s.minutes} min` },
    { k: 'what', l: 'What', r: s => <small className="mut">{s.what}</small> },
    {
      k: 'last', l: 'Last run', r: s => {
        const l = hist.find(h => h.job === s.job);
        return l ? <>{fmtDT(l.ended)} <Chip cls={l.rc === 0 ? 'ok' : 'bad'} sm>rc {l.rc}</Chip></> : <span className="mut">never</span>;
      },
    },
    {
      k: 'run', l: '', sort: false, r: s => (
        <button type="button" className="btn sm" disabled={active} onClick={() => runJob(s.job)}>
          {active && S.job.job === s.job ? 'running…' : 'run now'}
        </button>
      ),
    },
  ];
  const histCols = [
    { k: 'job', l: 'Job', r: h => <span className="mono">{h.job}</span> },
    { k: 'started', l: 'Started', nw: true, r: h => fmtDT(h.started) },
    { k: 'ended', l: 'Ended', nw: true, r: h => fmtT(h.ended) },
    { k: 'rc', l: 'Result', num: true, r: h => <Chip cls={h.rc === 0 ? 'ok' : 'bad'} sm>rc {h.rc}</Chip> },
    { k: 'output', l: 'Output', r: h => <small className="mut mono">{h.output}</small> },
  ];

  return (
    <div className="grid2" style={{ gridTemplateColumns: '1fr' }}>
      <Panel title="Schedule" sub="scheduled dongle borrowers — run one manually; active schedule timers pause and resume afterward" flush>
        {status && (
          <p className={status.state === 'succeeded' ? 'ok' : status.state === 'failed' ? 'bad' : 'warn'} style={{ margin: '12px 14px 0' }}>
            Manual <b>{status.job}</b>: {status.state}{status.message ? ` — ${status.message}` : ''}
          </p>
        )}
        {J.current && (
          <p className={J.current.overdue ? 'bad' : 'warn'} style={{ margin: '8px 14px 0' }}>
            Dongle currently lent to <b>{J.current.job}</b> since {fmtT(J.current.started)}, expected back {fmtT(J.current.expected_end)}
            {J.current.overdue ? ' — OVERDUE, receiver will be flagged down' : ''}.
          </p>
        )}
        <DataTable id="sched" rows={J.schedule || []} cols={schedCols} empty="No schedule." />
      </Panel>
      <Panel title="History" count={`${hist.length} runs`} flush>
        <DataTable id="hist" rows={hist} cols={histCols} defaultSort="-started" empty="No runs yet." />
      </Panel>
    </div>
  );
}

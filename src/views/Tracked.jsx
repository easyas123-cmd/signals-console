import { S, useStore, href, setQ, save, notify, trackedKeys, resolveKey, allTags, tagsOf, noteOf, isWatched, setNote } from '../lib/store.js';
import { Panel, DataTable, Filters, applyFilter, quick, QuickBox, Tools, ToggleDense, CsvButton, Star, Chip, Empty, Tag, Cmd } from '../components/ui.jsx';
import { ago, clip, secsSince, tagText } from '../lib/format.js';

export default function Tracked() {
  useStore();
  const keys = trackedKeys();
  const curTag = S.route.q.tag || '';
  const rows = keys.map(k => {
    const r = resolveKey(k); const i = k.indexOf('|');
    return { key: k, tags: tagsOf(k), ...(r || { kind: k.slice(0, i), name: k.slice(i + 1), missing: true }) };
  });
  const F = [
    ['all', 'All'],
    ['present', 'Here now', r => r.present === true],
    ['away', 'Away', r => r.present === false],
    ['starred', '★ Starred', r => isWatched(r.key)],
    ['noted', '✎ Noted', r => !!noteOf(r.key)],
    ['missing', 'Not in current data', r => r.missing],
  ];
  const f = S.route.q.f || 'all';
  let list = applyFilter(F, rows, f);
  if (curTag) list = list.filter(r => r.tags.includes(curTag));
  list = quick(list, ['name', 'kind', r => r.tags.join(' '), r => noteOf(r.key)]);

  const log = [...S.trackLog].reverse().slice(0, 120);
  const sync = S.annot.online ? <><span className="ok">synced</span> across your browsers via the relay (rev {S.annot.rev})</>
    : S.annot.online === false ? <><span className="warn">this browser only</span> — the relay&rsquo;s /annotations store is not reachable</>
      : 'checking sync…';

  const cols = [
    { k: 'star', l: '', sort: false, nw: true, r: r => <Star k={r.key} /> },
    { k: 'kind', l: 'Kind', r: r => <Chip sm>{r.kind}</Chip> },
    {
      k: 'name', l: 'Entity', r: r => r.href
        ? <><a href={r.href}><b>{r.name}</b></a> {r.tags.map(t => <Tag key={t} t={t} />)}</>
        : <><span className="mut">{r.name} — not in the current data</span></>,
    },
    { k: 'present', l: 'Now', get: r => r.present == null ? -1 : r.present ? 1 : 0, nw: true, r: r => r.present == null ? <span className="mut">–</span> : r.present ? <><span className="dot ok" />here</> : <><span className="dot" />away</> },
    { k: 'signal', l: 'Signal', num: true, r: r => r.signal == null ? '–' : r.signal },
    { k: 'last', l: 'Last seen', r: r => r.last ? ago(r.age ?? secsSince(r.last)) + ' ago' : '–' },
    { k: 'since', l: 'Since', get: r => S.track[r.key]?.t, r: r => S.track[r.key]?.t ? <span className="nw">{ago(secsSince(S.track[r.key].t))}</span> : '–', title: 'how long it has been in its current here/away state' },
    { k: 'note', l: 'Note', get: r => noteOf(r.key), r: r => <span style={{ whiteSpace: 'pre-wrap' }}>{clip(noteOf(r.key), 140)}</span> },
  ];

  const tagBar = allTags().map(([t, n]) => (
    <a key={t} className={'fchip' + (curTag === t ? ' on' : '')} href={href(S.route.path, { ...S.route.q, tag: curTag === t ? '' : t, all: '' })}>
      {tagText(t)}<span className="n">{n}</span>
    </a>
  ));

  return (
    <>
      <Panel flush>
        <Tools>
          <Filters defs={F} rows={rows} cur={f} />
          {tagBar.length > 0 && <>{tagBar}{curTag && <a className="btn sm ghost" href={href(S.route.path, { ...S.route.q, tag: '' })}>× clear tag</a>}</>}
          <QuickBox ph="name, kind, #tag, note…" />
          <ToggleDense />
          <CsvButton name="tracked" rows={list} cols={cols.filter(c => c.k !== 'star')} />
        </Tools>
        <DataTable id="tracked" rows={list} cols={cols} defaultSort="-present" limit={200}
          empty={keys.length ? 'Nothing matches.' : 'Star (☆), tag or write a note on any device page and it shows up here with its live state.'} />
      </Panel>
      <div className="grid2">
        <Panel title="Presence log" count={`${S.trackLog.length} events`} flush
          right={S.trackLog.length ? <button type="button" className="btn sm" onClick={() => { S.trackLog = []; save('trackLog'); notify(); }}>clear</button> : null}>
          {log.length ? (
            <div className="tlog" style={{ padding: '6px 14px' }}>
              {log.map((e, i) => (
                <div key={i}>
                  <span className="t">{new Date(e.t).toLocaleDateString(undefined, { weekday: 'short' })} {new Date(e.t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={e.to === 'present' ? 'ok' : 'mut'}>{e.to === 'present' ? 'arrived' : 'left'}</span>
                  <a href={keyHref(e.key)}><b>{e.name}</b></a>
                  <span className="mut">{e.kind}</span>
                </div>
              ))}
            </div>
          ) : <Empty>No arrivals or departures observed yet. The console checks every tracked item on each data refresh (≈1 min, while a tab is open) and logs the changes here.</Empty>}
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Tags">
            {allTags().length ? (
              <>
                <div className="fchips">{allTags().map(([t, n]) => <Tag key={t} t={t} />)}</div>
                <p className="note" style={{ marginTop: 8 }}>Type <code>#tag</code> in any list&rsquo;s filter box to show only devices with that tag; <code>#</code> alone shows everything tagged.</p>
              </>
            ) : <p className="note">Tags are free text; add them on any device page.</p>}
          </Panel>
          <ExportImport />
        </div>
      </div>
    </>
  );
}

function keyHref(k) {
  const i = k.indexOf('|'); const t = k.slice(0, i), id = k.slice(i + 1);
  if (t === 'rf') return href(['device', id]);
  if (t === 'ap') return href(['wireless', 'ap', id]);
  if (t === 'client') return href(['wireless', 'client', id]);
  if (t === 'ble') return href(['wireless', 'addr', id]);
  if (t === 'ent') return href(['wireless', 'ble', id]);
  return '#/tracked';
}

function ExportImport() {
  const dump = JSON.stringify({ notes: S.notes, watch: S.watch, tags: S.tags }, null, 1);
  return (
    <Panel title="Export / import">
      <pre style={{ maxHeight: '10rem' }}>{dump}</pre>
      <div className="tools" style={{ border: 0, padding: '8px 0 0', gap: 8 }}>
        <button type="button" className="btn sm" onClick={() => navigator.clipboard.writeText(dump)}>copy JSON</button>
        <span className="panel-sub">Paste into the box to merge:</span>
      </div>
      <textarea className="notes" id="imp" placeholder='{"notes":{…},"watch":{…},"tags":{…}}' style={{ minHeight: '4rem', marginTop: 6 }} />
      <div className="tools" style={{ border: 0, padding: '8px 0 0', gap: 8 }}>
        <button type="button" className="btn sm" onClick={() => {
          try {
            const o = JSON.parse(document.getElementById('imp').value);
            S.notes = { ...(o.notes || {}), ...S.notes }; S.watch = { ...(o.watch || {}), ...S.watch };
            S.tags = { ...(o.tags || {}), ...S.tags };
            save('notes'); save('watch'); save('tags'); notify();
          } catch { alert('Invalid JSON'); }
        }}>merge</button>
        <span className="panel-sub">existing notes are kept unless the import has text for a key this browser lacks.</span>
      </div>
    </Panel>
  );
}

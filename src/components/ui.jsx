import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { S, useStore, setQ, save, notify, href, isWatched, toggleWatch, tagsOf, setTags, allTags, noteOf, setNote } from '../lib/store.js';
import { cmp, csvOf, tagHue, tagText, normTag, SUGGEST, wzq } from '../lib/format.js';

// ---------- toast ----------
export const toast = m => window.dispatchEvent(new CustomEvent('sd-toast', { detail: m }));
export function Toaster() {
  const [msg, setMsg] = useState(null);
  const t = useRef(null);
  useEffect(() => {
    const on = e => { setMsg(e.detail); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 1700); };
    window.addEventListener('sd-toast', on);
    return () => window.removeEventListener('sd-toast', on);
  }, []);
  return <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>;
}

// ---------- atoms ----------
export const Dot = ({ cls = '' }) => <span className={'dot ' + cls} />;
export const Chip = ({ cls = '', dot, children, title, href: h }) => {
  const inner = <>{dot != null && <span className="d" style={dot ? { background: dot } : undefined} />}{children}</>;
  return h ? <a className={'chip ' + cls} href={h} title={title}>{inner}</a> : <span className={'chip ' + cls} title={title}>{inner}</span>;
};
export const Sev = ({ level }) => <span className={'sev' + (level >= 3 ? ' s3' : level >= 2 ? ' s2' : '')}>{level}</span>;
export const Tag = ({ t, onRemove }) => (
  <span className="tag" style={{ '--h': tagHue(t) }}>
    {tagText(t)}
    {onRemove && <button type="button" title="remove tag" onClick={onRemove}>×</button>}
  </span>
);
export const Star = ({ k, size = 15 }) => (
  <button type="button" className={'star' + (isWatched(k) ? ' on' : '')} title={isWatched(k) ? 'Remove from watchlist' : 'Add to watchlist'}
    onClick={() => { toggleWatch(k); toast(isWatched(k) ? 'Added to watchlist' : 'Removed from watchlist'); }}>{isWatched(k) ? '★' : '☆'}</button>
);

export const Metric = ({ label, value, cls = '', sub, dot }) => (
  <div className="metric">
    <span className="metric-label">{label}</span>
    <span className={'metric-value ' + cls}>{dot && <Dot cls={dot} />}{value}</span>
    {sub && <span className="metric-sub">{sub}</span>}
  </div>
);
export const Stat = ({ value, label, href: h, cls = '' }) => {
  const inner = <><b className={cls}>{value}</b><span>{label}</span></>;
  return h ? <a className="stat link" href={h}>{inner}</a> : <div className="stat">{inner}</div>;
};
export const Section = ({ title, sub, link, children, id }) => (
  <section className="section">
    <div className="sec-head">
      {title && <h2 className="sec-title" id={id}>{title}</h2>}
      {sub && <span className="sec-sub">{sub}</span>}
      {link && <a className="sec-link" href={link.href}>{link.label}</a>}
    </div>
    {children}
  </section>
);
export const Panel = ({ title, sub, count, right, actions, children, flush, className = '' }) => (
  <div className={'panel ' + className}>
    {(title || sub || count || right) && (
      <div className="panel-head">
        {title && <h2>{title}</h2>}
        {sub && <span className="panel-sub">{sub}</span>}
        {count != null && <span className="panel-count">{count}</span>}
        {right}
      </div>
    )}
    {actions}
    <div className={'panel-body' + (flush ? ' flush' : '')}>{children}</div>
  </div>
);
export const Empty = ({ children }) => <div className="empty">{children}</div>;

// ---------- signal bar ----------
export const SignalBar = ({ v, max }) => {
  const pct = v == null ? 0 : Math.max(4, Math.min(100, Math.round((v + 95) / 45 * 100)));
  const hi = v != null && v >= -55;
  return (
    <span className="lvl">
      <span className="sigbar"><i className={hi ? 'hi' : ''} style={{ width: pct + '%' }} /></span>
      <span className="sigval">{v == null ? '–' : v}</span>
    </span>
  );
};

// ---------- notes + tags ----------
export function TagEditor({ k }) {
  const [val, setVal] = useState('');
  const cur = tagsOf(k), sugg = SUGGEST.filter(t => !cur.includes(t));
  const add = t => { t = normTag(t); if (!t) return; setTags(k, [...tagsOf(k), t]); notify(); setVal(''); };
  return (
    <>
      <div className="tools" style={{ border: 0, padding: 0, gap: 6 }}>
        {cur.map(t => <Tag key={t} t={t} onRemove={() => { setTags(k, tagsOf(k).filter(x => x !== t)); notify(); }} />)}
        <input list={'tl-' + k} value={val} placeholder="add tag ⏎" style={{ minWidth: '7rem', fontSize: 12.5, padding: '3px 8px' }}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(val); } }} />
        <datalist id={'tl-' + k}>{allTags().map(([t]) => <option key={t} value={tagText(t)} />)}</datalist>
      </div>
      {sugg.length > 0 && (
        <div className="fchips" style={{ marginTop: 6 }}>
          {sugg.map(t => <button key={t} type="button" className="fchip" onClick={() => add(t)}>+ {tagText(t)}</button>)}
        </div>
      )}
    </>
  );
}
export function NotesCard({ k, label }) {
  const [note, setLocal] = useState(noteOf(k));
  useEffect(() => { setLocal(noteOf(k)); }, [k]);
  const t = useRef(null);
  const commit = v => { clearTimeout(t.current); t.current = setTimeout(() => { setNote(k, v); notify(); }, 500); };
  return (
    <Panel title="Research" right={<span className="panel-count">{S.annot.online ? 'synced across your browsers' : 'this browser only'}</span>}
      actions={<div className="panel-actions"><Star k={k} /><span className="panel-sub">Tags</span></div>}>
      <TagEditor k={k} />
      <div className="panel-sub" style={{ margin: '10px 0 4px' }}>Note</div>
      <textarea className="notes" value={note} placeholder="What is this? Who owns it? What did you check? (autosaves)"
        onChange={e => { setLocal(e.target.value); commit(e.target.value); }} />
      <p className="note" style={{ marginTop: 8 }}>
        Starred, tagged or noted → it is <a href="#/tracked">tracked</a>: the console logs when it arrives and leaves.
        {' '}<b>{label || k}</b>
      </p>
    </Panel>
  );
}

// ---------- filters / tools ----------
export function Filters({ defs, rows, cur }) {
  const q = S.route.q;
  return (
    <div className="fchips">
      {defs.map(([k, l, fn]) => (
        <a key={k} className={'fchip' + (cur === k ? ' on' : '')}
          href={href(S.route.path, { ...q, f: k === 'all' ? '' : k, all: '' })}>
          {l}<span className="n">{fn ? rows.filter(fn).length : rows.length}</span>
        </a>
      ))}
    </div>
  );
}
export const applyFilter = (defs, rows, cur) => { const d = defs.find(x => x[0] === cur); return d && d[2] ? rows.filter(d[2]) : rows; };
export const quick = (rows, fields) => {
  const q = (S.route.q.q || '').toLowerCase().trim();
  if (!q) return rows;
  if (q.startsWith('#')) { const t = normTag(q); return rows.filter(r => { const k = r.key; return k && (t ? tagsOf(k).includes(t) : tagsOf(k).length > 0); }); }
  return rows.filter(r => fields.map(f => typeof f === 'function' ? f(r) : r[f]).filter(Boolean).join(' ').toLowerCase().includes(q));
};
export const QuickBox = ({ ph = 'filter…' }) => (
  <input type="search" placeholder={ph} defaultValue={S.route.q.q || ''} style={{ minWidth: '11rem' }}
    onChange={e => { const v = e.target.value; clearTimeout(window._qt); window._qt = setTimeout(() => setQ({ q: v, all: '', _keep: '1' }), 250); }} />
);
export const ToggleDense = () => (
  <button type="button" className="btn sm" onClick={() => { S.prefs.dense = !S.prefs.dense; save('prefs'); notify(); }}>
    {S.prefs.dense ? '☰ comfortable' : '☰ dense'}
  </button>
);
export function CsvButton({ name, rows, cols }) {
  const go = () => {
    const blob = new Blob([csvOf(rows, cols)], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = name + '-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv';
    a.click(); setTimeout(() => URL.revokeObjectURL(u), 5000);
  };
  return <button type="button" className="btn sm" onClick={go} title="Download the current rows as CSV">⇩ CSV</button>;
}
export const Tools = ({ children }) => <div className="tools">{children}<span className="sp" /></div>;

// ---------- table ----------
export function DataTable({ id, rows, cols, sortKey, defaultSort, limit = 100, href: hfn, rowCls, empty = 'Nothing matches.' }) {
  useStore();
  const key = sortKey || id;
  const s = (S.route.q.sk === key ? S.route.q.s : '') || S.sorts[key] || defaultSort || '';
  const desc = s.startsWith('-'), sk = s.replace(/^-/, '');
  const col = cols.find(c => c.k === sk);
  let out = rows;
  if (col) {
    const g = col.get || (r => r[col.k]);
    out = [...rows].sort((a, b) => {
      let x = g(a), y = g(b);
      if (typeof x === 'string') x = x.toLowerCase();
      if (typeof y === 'string') y = y.toLowerCase();
      if (x == null || x === '') return y == null || y === '' ? 0 : 1;
      if (y == null || y === '') return -1;
      return cmp(x, y) * (desc ? -1 : 1);
    });
  }
  const lim = S.route.q.all === '1' ? Infinity : limit;
  const shown = out.slice(0, lim);
  if (!rows.length) return <Empty>{empty}</Empty>;
  const clickSort = k => {
    const cur = S.route.q.s || S.sorts[key] || '';
    const next = cur === k ? '-' + k : cur === '-' + k ? k : (['name', 'ssid', 'mac', 'kind', 'manuf', 'type', 'job', 'id'].includes(k) ? k : '-' + k);
    S.sorts[key] = next; save('sorts');
    setQ({ s: next, sk: key, _keep: '1' });
  };
  return (
    <div className={'tbl' + (S.prefs.dense ? ' dense' : '')}>
      <table>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.k} className={[c.num ? 'n' : '', c.nw ? 'nw' : '', c.sort === false ? '' : 's', sk === c.k ? 'on' : ''].join(' ')}
                title={c.title || ''} onClick={c.sort === false ? undefined : () => clickSort(c.k)}>
                {c.l}{sk === c.k ? <span className="ar">{desc ? '▼' : '▲'}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            const h = hfn ? hfn(r) : null;
            return (
              <tr key={r.key || r.mac || r.id || i} className={[(rowCls ? rowCls(r) : ''), h ? 'row' : ''].filter(Boolean).join(' ')}
                onClick={h ? e => { if (e.target.closest('a,button')) return; if (window.getSelection().toString()) return; location.hash = h; } : undefined}>
                {cols.map(c => <td key={c.k} className={[c.num ? 'n' : '', c.nw ? ' nw' : ''].join(' ')}>{c.r ? c.r(r) : (r[c.k] ?? '')}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      {out.length > shown.length && (
        <div className="more">Showing {shown.length} of {out.length} · <a href={href(S.route.path, { ...S.route.q, all: '1' })}>show all</a></div>
      )}
    </div>
  );
}

// ---------- canvas charts ----------
function useCanvas(draw, deps) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const run = () => { try { draw(c); } catch { /* no data */ } };
    run();
    const ro = new ResizeObserver(run); ro.observe(c);
    return () => ro.disconnect();
  }, deps);
  return ref;
}
const cssv = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function prep(c, h) {
  const dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth || 600;
  c.width = W * dpr; c.height = (h || 80) * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  return [x, W, (h || 80)];
}
export function LineChart({ vals, second, min, max, base, h = 80, fill }) {
  const ref = useCanvas(c => {
    const [x, W, H] = prep(c, h); x.clearRect(0, 0, W, H);
    const v = vals.filter(n => n != null);
    if (!v.length) { x.fillStyle = cssv('--mut'); x.font = '12px sans-serif'; x.fillText('no data yet', 8, H / 2); return; }
    const lo = min ?? Math.min(...v) - 2, hi = max ?? Math.max(...v) + 2;
    const px = i => i / (vals.length - 1 || 1) * W, py = n => H - 2 - (n - lo) / (hi - lo) * (H - 4);
    x.strokeStyle = cssv('--line2'); x.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(f => { x.beginPath(); x.moveTo(0, H * f); x.lineTo(W, H * f); x.stroke(); });
    if (base != null) { x.strokeStyle = cssv('--mut'); x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, py(base)); x.lineTo(W, py(base)); x.stroke(); x.setLineDash([]); }
    const drawOne = (arr, col, doFill) => {
      x.strokeStyle = col; x.lineWidth = 1.6; x.beginPath();
      let st = false, x0 = 0, x1 = 0;
      arr.forEach((n, i) => { if (n == null) return; if (!st) { x0 = px(i); x.moveTo(x0, py(n)); st = true; } else x.lineTo(px(i), py(n)); x1 = px(i); });
      x.stroke();
      if (doFill) { x.lineTo(x1, H); x.lineTo(x0, H); x.closePath(); x.fillStyle = col + '2a'; x.fill(); }
    };
    drawOne(vals, cssv('--info'), fill);
    if (second) drawOne(second, cssv('--ok'));
    x.fillStyle = cssv('--mut'); x.font = '10px sans-serif';
    x.fillText(hi.toFixed(0), 3, 10); x.fillText(lo.toFixed(0), 3, H - 3);
  }, [JSON.stringify(vals), JSON.stringify(second), min, max, base, h, fill]);
  return <canvas ref={ref} height={h} />;
}
export function Bars({ vals, h = 56 }) {
  const ref = useCanvas(c => {
    const [x, W, H] = prep(c, h); x.clearRect(0, 0, W, H);
    if (!vals.length) { x.fillStyle = cssv('--mut'); x.font = '12px sans-serif'; x.fillText('no data yet', 8, H / 2); return; }
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const bw = W / vals.length; x.fillStyle = cssv('--info');
    vals.forEach((n, i) => { const bh = (n - lo) / (hi - lo || 1) * H; x.fillRect(i * bw, H - bh, Math.max(1, bw - 1), bh); });
  }, [JSON.stringify(vals), h]);
  return <canvas ref={ref} height={h} />;
}
export function Waterfall({ sweeps }) {
  const ref = useCanvas(c => {
    if (!c || !sweeps.length) return;
    const axis = sweeps[sweeps.length - 1].bins;
    const W = c.width = axis.length, H = c.height = sweeps.length;
    c.style.height = Math.max(56, sweeps.length * 6) + 'px';
    const x = c.getContext('2d'); const img = x.createImageData(W, H);
    const lo = -40, hi = 0;
    const xof = new Map(axis.map((f, i) => [Math.round(f * 10), i]));
    sweeps.forEach((s, r) => s.bins.forEach((f, i) => {
      const xi = xof.get(Math.round(f * 10)); const v = s.db[i];
      if (xi == null || v == null) return;
      const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      const p = (r * W + xi) * 4;
      img.data[p] = t * 200; img.data[p + 1] = t * t * 190; img.data[p + 2] = (1 - t) * 120 + 30; img.data[p + 3] = 255;
    }));
    x.putImageData(img, 0, 0); c.style.imageRendering = 'pixelated';
  }, [JSON.stringify(sweeps)]);
  return <canvas ref={ref} />;
}
export function Hours({ hrs }) {
  if (!hrs || !hrs.length) return <Empty>No hour profile yet.</Empty>;
  const m = Math.max(1, ...hrs), now = new Date().getHours();
  return (
    <>
      <div className="hrs">{hrs.map((n, h) => <i key={h} className={h === now ? 'now' : ''} title={`${h}:00 · ${n}`} style={{ height: Math.max(2, n / m * 100) + '%' }} />)}</div>
      <div className="axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    </>
  );
}
export function Strip({ tl, hours = 48, res = 600 }) {
  if (!tl || !tl.length) return null;
  const now = Math.floor(Date.now() / 1000 / res) * res;
  const n = hours * 3600 / res;
  const on = new Map(tl.map(([t, , r]) => [Math.floor(t / res) * res, r]));
  const cells = [];
  for (let i = n - 1; i >= 0; i--) { const t = now - i * res; const r = on.get(t); cells.push({ r, t }); }
  return (
    <>
      <div className="strip">{cells.map((c, i) => <i key={i} className={c.r == null ? '' : c.r >= -65 ? 'hi' : 'on'} title={new Date(c.t * 1000).toLocaleString() + (c.r != null ? ` · ${c.r} dBm` : '')} />)}</div>
      <div className="axis"><span>-48 h</span><span>-24 h</span><span>now</span></div>
    </>
  );
}
export function Days({ days }) {
  if (!days || !days.length) return null;
  const set = new Set(days); const out = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    out.push({ on: set.has(k), title: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + (set.has(k) ? ' · seen' : '') });
  }
  return (
    <>
      <div className="strip" style={{ height: 10 }}>{out.map((o, i) => <i key={i} className={o.on ? 'on' : ''} title={o.title} />)}</div>
      <div className="axis"><span>14 days ago</span><span>today</span></div>
    </>
  );
}
export function ChannelChart({ aps }) {
  const by = new Map();
  for (const a of aps) { const c = parseInt(a.channel, 10); if (!c) continue; if (!by.has(c)) by.set(c, { n: 0, ours: 0 }); const e = by.get(c); e.n++; if (a.ours) e.ours++; }
  const max = Math.max(1, ...[...by.values()].map(e => e.n));
  const row = (c, e) => (
    <div className={'r' + (e.ours ? ' ours' : '')} key={c}>
      <span>{c}</span>
      <span className="b"><i style={{ width: e.n / max * 100 + '%' }} />{e.ours ? <i className="ours" style={{ width: e.ours / max * 100 + '%' }} /> : null}</span>
      <span className="num">{e.n}</span>
    </div>
  );
  const g24 = [...by.entries()].filter(([c]) => c <= 14).sort((a, b) => a[0] - b[0]);
  const g5 = [...by.entries()].filter(([c]) => c > 14).sort((a, b) => a[0] - b[0]);
  return (
    <>
      <div className="grid2" style={{ gap: 14 }}>
        <div>
          <div className="panel-sub" style={{ marginBottom: 6 }}>{g24.reduce((s, [, e]) => s + e.n, 0)} APs · 1/6/11 don't overlap</div>
          <div className="chan">{g24.map(([c, e]) => row(c, e))}{!g24.length && <Empty>none</Empty>}</div>
        </div>
        <div>
          <div className="panel-sub" style={{ marginBottom: 6 }}>{g5.reduce((s, [, e]) => s + e.n, 0)} APs</div>
          <div className="chan">{g5.map(([c, e]) => row(c, e))}{!g5.length && <Empty>none</Empty>}</div>
        </div>
      </div>
      <div className="legend"><span><i style={{ background: 'var(--info)', opacity: .7 }} />neighbours</span><span><i style={{ background: 'var(--ok)' }} />ours</span></div>
    </>
  );
}
export function DashboardLink({ q, label = 'Dashboard ↗' }) {
  if (!wzq(q)) return null;
  return <a className="chip acc" href={wzq(q)} target="_blank" rel="noreferrer" title={q}><Icon name="external" size={12} />{label}</a>;
}
export const Cmd = ({ cmd, note }) => (
  <Panel title="Run on the server" count={null}>
    <pre className="cmd">{cmd}<button type="button" className="btn sm" onClick={() => { navigator.clipboard.writeText(cmd).then(() => toast('Copied')).catch(() => toast('Copy failed')); }}>copy</button></pre>
    {note && <p className="note" style={{ marginTop: 8 }}>{note}</p>}
  </Panel>
);

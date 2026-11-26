import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { S, useStore, api, href } from '../lib/store.js';
import { Panel, DataTable, Empty, Waterfall, LineChart, Chip } from '../components/ui.jsx';
import { ago, bandName, fmtDT, fmtT, n0 } from '../lib/format.js';

export default function Spectrum({ view }) {
  useStore();
  const nav = (
    <div className="subnav">
      <a className={view !== 'sky' ? 'on' : ''} href={href(['spectrum'], { v: '' })}>Spectrum</a>
      <a className={view === 'sky' ? 'on' : ''} href={href(['spectrum'], { v: 'sky' })}>Sky</a>
    </div>
  );
  return (
    <>
      {nav}
      {view === 'sky' ? <Sky /> : <Sweep />}
    </>
  );
}

function Sweep() {
  const [sw, setSw] = useState(S.sweep);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch(api('sweep.json?_=' + Date.now()), { cache: 'no-store' });
        if (r.ok) { const v = await r.json(); if (live) setSw(v); }
      } catch { /* ignore */ }
    })();
    return () => { live = false; };
  }, []);
  if (!sw) return <Panel><Empty>No sweep data yet — the first <code>sweep</code> job runs at 03:30 / 11:30 / 19:30.</Empty></Panel>;
  const last = sw.sweeps[sw.sweeps.length - 1];
  const an = [...(sw.anomalies || [])].reverse();
  const peaks = last.db.map((v, i) => [v, i]).filter(([v, i]) => v > -20 && (i === 0 || last.db[i - 1] <= v) && (i === last.db.length - 1 || last.db[i + 1] < v)).sort((a, b) => b[0] - a[0]).slice(0, 8);
  const anCols = [
    { k: 'at', l: 'Sweep', nw: true, r: a => fmtDT(a.at) },
    { k: 'start_mhz', l: 'Range', num: true, r: a => <span className="mono">{a.start_mhz}–{a.end_mhz} MHz</span> },
    { k: 'peak_db', l: 'Peak', num: true, r: a => a.peak_db + ' dB' },
    { k: 'above_db', l: 'Above', num: true, r: a => <span className="warn">+{a.above_db} dB</span> },
  ];
  return (
    <>
      <Panel title="Latest sweep" sub={`rtl_power occupancy 24–1750 MHz · ${sw.sweeps.length} sweep${sw.sweeps.length > 1 ? 's' : ''} kept · latest ${fmtDT(last.end)}`} count="hover for frequency">
        <LineChart vals={last.db} min={-45} max={Math.max(5, ...last.db.filter(v => v != null)) + 2} h={160} fill />
        <div className="axis"><span>24</span><span>250</span><span>500</span><span>750</span><span>1000</span><span>1250</span><span>1500</span><span>1750 MHz</span></div>
      </Panel>
      <div className="grid2">
        <Panel title="Strongest carriers in this sweep">
          {peaks.length ? (
            <div className="rowlist">
              {peaks.map(([v, i]) => (
                <div key={i}>
                  <span className="mono">{last.bins[i].toFixed(1)} MHz</span>
                  <span className="num">{v.toFixed(1)} dB</span>
                  <span className="mut" style={{ marginLeft: 'auto' }}>{bandName(last.bins[i])}</span>
                </div>
              ))}
            </div>
          ) : <Empty>Nothing above −20 dB.</Empty>}
        </Panel>
        <Panel title="Carriers above baseline · RF-013" flush>
          {an.length ? <DataTable id="sw-an" rows={an.slice(0, 40)} cols={anCols} defaultSort="-at" /> : <Empty>Nothing above baseline yet (needs 5 sweeps of history).</Empty>}
        </Panel>
      </div>
      <Panel title="Waterfall" sub="one row per sweep · newest at the bottom">
        <Waterfall sweeps={sw.sweeps} />
      </Panel>
    </>
  );
}

const PLANE = hdg => `<svg width="18" height="18" viewBox="0 0 24 24" fill="#8FE3CF" style="transform:rotate(${(hdg ?? 0) - 45}deg)"><path d="M21.5 15.5 13.5 10V3.2c0-.7-.5-1.2-1.5-1.2s-1.5.5-1.5 1.2V10l-8 5.5v2l8-2.5v4.6l-2.5 1.8v1.4l4-1.2 4 1.2v-1.4L13.5 19v-4.6l8 2.5z"/></svg>`;
const altColor = a => a == null ? '#8B95A1' : a > 35000 ? '#C9A2FF' : a > 20000 ? '#9DB4FF' : a > 8000 ? '#8FE3CF' : '#F2A93B';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const popupHtml = a => {
  const l = a.last || {};
  const agoS = l.ts ? Math.max(0, Date.now() / 1000 - l.ts) : null;
  return `<b>${esc(a.flight || a.hex)}</b> <span style="color:#8B95A1">${esc(a.hex)}</span><br>` +
    `alt ${l.alt != null ? l.alt.toLocaleString() + ' ft' : '–'} · ${l.speed != null ? l.speed + ' kt' : '–'} · hdg ${l.track ?? '–'}°<br>` +
    `${l.lat?.toFixed(4) ?? '–'}, ${l.lon?.toFixed(4) ?? '–'} · rssi ${l.rssi ?? '–'}<br>` +
    `last seen ${ago(agoS)}${a.squawk ? ` · sqk ${esc(a.squawk)}` : ''}`;
};

function Sky() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const fittedRef = useRef(false);
  const rxRef = useRef(null);
  const [ac, setAc] = useState([]);
  const [feed, setFeed] = useState({ state: 'loading', label: 'feed –' });

  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true, minZoom: 5, maxZoom: 12 });
    mapRef.current = map;
    map.attributionControl.setPrefix('').addAttribution('Natural Earth (public domain) · vendored offline basemap');
    map.setView([39.3, -92.3], 7);
    (async () => {
      const gj = f => fetch(new URL('geo/' + f, document.baseURI).href).then(r => r.json());
      try {
        const [countries, states, lakes, cities] = await Promise.all([
          gj('ne_50m_admin_0_countries.geojson'), gj('ne_50m_admin_1_states_provinces.geojson'),
          gj('ne_50m_lakes.geojson'), gj('ne_50m_populated_places.geojson')]);
        const grat = []; const gb = [[30, 48], [-104, -82]];
        for (let lat = Math.ceil(gb[0][0] / 2) * 2; lat <= gb[0][1]; lat += 2) grat.push([[lat, gb[1][0]], [lat, gb[1][1]]]);
        for (let lon = Math.ceil(gb[1][0] / 2) * 2; lon <= gb[1][1]; lon += 2) grat.push([[gb[0][0], lon], [gb[0][1], lon]]);
        L.polyline(grat, { color: '#2A323B', weight: .7, interactive: false }).addTo(map);
        L.geoJSON(countries, { style: { color: '#5B6B85', weight: 1.5, fill: false }, interactive: false }).addTo(map);
        L.geoJSON(states, { style: { color: '#3F4C61', weight: 1, fill: false }, interactive: false }).addTo(map);
        L.geoJSON(lakes, { style: { color: '#2E4A66', weight: .8, fillColor: '#1B2836', fillOpacity: .95 }, interactive: false }).addTo(map);
        L.geoJSON(cities, {
          pointToLayer: (f, ll) => {
            const big = (f.properties.pop_max || 0) >= 1000000;
            return L.circleMarker(ll, { radius: big ? 2.5 : 1.7, color: '#9AA7BA', weight: 1, fillColor: '#9AA7BA', fillOpacity: .8, interactive: false })
              .bindTooltip(f.properties.name, { permanent: true, direction: 'right', className: 'city' + (big ? ' big' : '') });
          },
        }).addTo(map);
      } catch { /* geo unavailable */ }
    })();
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const r = await fetch(api('adsb.json?_=' + Date.now()), { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        if (!live) return;
        const map = mapRef.current; if (!map) return;
        const now = Date.now() / 1000;
        const acs = (d.aircraft || []).filter(a => a.last && a.last.lat != null);
        const newest = acs[0]?.last?.ts ? now - acs[0].last.ts : null;
        const isLive = newest != null && newest < 900;
        setFeed({ state: isLive ? 'ok' : newest != null && newest < 86400 ? 'warn' : 'bad', label: isLive ? 'window active/recent' : 'last report ' + ago(newest) });
        setAc(acs.map(a => ({ hex: a.hex, flight: a.flight || a.hex, alt: a.last.alt, speed: a.last.speed, seen: now - a.last.ts })));

        if (d.receiver && !rxRef.current) {
          const icon = L.divIcon({ className: '', html: '<div class="rx-marker" style="width:10px;height:10px"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
          rxRef.current = L.marker([d.receiver.lat, d.receiver.lon], { icon, title: 'receiver' }).addTo(map);
        }
        const seen = new Set(); const bounds = [];
        for (const a of acs) {
          seen.add(a.hex);
          const l = a.last, col = altColor(l.alt);
          const pts = (a.track || []).map(p => [p[0], p[1]]);
          if (!pts.length || pts[pts.length - 1][0] !== l.lat || pts[pts.length - 1][1] !== l.lon) pts.push([l.lat, l.lon]);
          let L_ = layersRef.current[a.hex];
          const icon = L.divIcon({ className: 'ac-marker', html: PLANE(l.track).replace('#8FE3CF', col), iconSize: [18, 18], iconAnchor: [9, 9] });
          if (!L_) {
            L_ = layersRef.current[a.hex] = {
              marker: L.marker([l.lat, l.lon], { icon }).addTo(map).bindPopup(popupHtml(a)),
              line: L.polyline(pts, { color: col, weight: 1.6, opacity: .55 }).addTo(map),
            };
          }
          L_.marker.setLatLng([l.lat, l.lon]).setIcon(icon).setPopupContent(popupHtml(a));
          L_.line.setLatLngs(pts).setStyle({ color: col });
          bounds.push([l.lat, l.lon]);
        }
        for (const h of Object.keys(layersRef.current)) {
          if (!seen.has(h)) { map.removeLayer(layersRef.current[h].marker); map.removeLayer(layersRef.current[h].line); delete layersRef.current[h]; }
        }
        if (!fittedRef.current && bounds.length) { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 9 }); fittedRef.current = true; }
      } catch {
        if (live) setFeed({ state: 'bad', label: 'feed error' });
      }
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => { live = false; clearInterval(t); };
  }, []);

  return (
    <>
      <div className="page-title">
        <span className="crumb">ADS-B 1090 MHz · tracks persist 36 h</span>
        <div className="right">
          <Chip cls={feed.state === 'ok' ? 'ok' : feed.state === 'bad' ? 'bad' : 'warn'} dot>{feed.label}</Chip>
          <Chip>{ac.length} aircraft</Chip>
        </div>
      </div>
      <div className="map" ref={mapEl} />
      <Panel title="Aircraft · last 36 h" flush>
        {ac.length ? (
          <DataTable id="ac" rows={ac} defaultSort="-alt" cols={[
            { k: 'flight', l: 'Flight', r: a => <span className="mono">{a.flight}</span> },
            { k: 'hex', l: 'Hex', r: a => <span className="mono mut">{a.hex}</span> },
            { k: 'alt', l: 'Alt', num: true, r: a => a.alt != null ? a.alt.toLocaleString() + ' ft' : '–' },
            { k: 'speed', l: 'Speed', num: true, r: a => a.speed != null ? a.speed + ' kt' : '–' },
            { k: 'seen', l: 'Last seen', r: a => ago(a.seen) + ' ago' },
          ]} />
        ) : <Empty>No positioned aircraft in the last window. ADS-B runs 5 min hourly at :50; tracks persist 36 h.</Empty>}
      </Panel>
    </>
  );
}

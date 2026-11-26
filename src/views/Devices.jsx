import { S, useStore, devHref, isTracked } from '../lib/store.js';
import { Panel, DataTable, Filters, applyFilter, quick, QuickBox, Tools, ToggleDense, CsvButton } from '../components/ui.jsx';
import { RF_COLS } from '../lib/columns.jsx';
import { dname, isAdsb, isNew } from '../lib/format.js';

export default function Devices() {
  useStore();
  const all = S.sum.devices.filter(d => !isAdsb(d));
  const F = [
    ['all', 'All'],
    ['active', 'Active 24 h', d => d.active],
    ['known', 'Tagged', d => d.known],
    ['unknown', 'Untagged non-vehicle', d => !d.known && !d.transient],
    ['vehicle', 'Vehicles', d => d.transient],
    ['recurring', 'Recurring', d => d.recurring],
    ['new', 'New 24 h', d => isNew(d.first_seen)],
    ['tracked', '★ Tracked', d => isTracked('rf|' + d.key)],
  ];
  const f = S.route.q.f || 'all';
  const rows = quick(applyFilter(F, all, f), ['key', dname, 'type', 'model', d => d.known?.owner]);
  const cols = RF_COLS(false);

  return (
    <Panel flush>
      <Tools>
        <Filters defs={F} rows={all} cur={f} />
        <QuickBox ph="filter by id, model, tag…" />
        <ToggleDense />
        <CsvButton name="rf-devices" rows={rows} cols={cols} />
      </Tools>
      <DataTable id="rf" rows={rows} cols={cols} href={devHref} defaultSort="-last_seen" limit={200}
        rowCls={d => d.active ? '' : 'stale'} />
      <p className="note" style={{ padding: '10px 14px 14px' }}>
        {all.length} transmitters heard — 433.92 MHz listener, 315/915 MHz ISM jobs, 912 MHz meters,
        ADS-B 1090 MHz (type aircraft), APRS 144.390 (type aprs), Meshtastic nodes (type mesh).
      </p>
    </Panel>
  );
}

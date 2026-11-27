// Sample dataset for the dev server. Writes one fixture per feed the app reads
// (public/*.json). Usage: node scripts/gen-sample-data.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(pub, { recursive: true });
const write = (name, obj) => writeFileSync(join(pub, name), JSON.stringify(obj, null, 0));

const now = Date.now();
const iso = (msAgo = 0) => new Date(now - msAgo).toISOString();
const r = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.round(r(a, b));
const pick = a => a[ri(0, a.length - 1)];
// locally-administered MACs (U/L bit set) so they never collide with a real OUI
const mac = () => ['02', ...Array.from({ length: 5 }, () => ri(0, 255).toString(16).padStart(2, '0'))].join(':').toUpperCase();

// summary.json: receiver state, noise floor, and the RF device list (the Now screen)
const rfModels = [
  ['Acurite-Tower', 'Backyard weather', 'thermometer'],
  ['Prologue-TH', 'Garage temp/humidity', 'thermometer'],
  ['LaCrosse-TX141', 'Attic sensor', 'thermometer'],
  ['TPMS-Toyota', 'Front-left tire', 'car'],
  ['TPMS-Toyota', 'Front-right tire', 'car'],
  ['Honeywell-Door', 'Side door contact', 'contact'],
  ['Oregon-Rain', 'Rain gauge', 'rain'],
  ['Nexus-TH', 'Fridge probe', 'thermometer'],
  ['SoilMoisture', 'Garden bed', 'soil'],
  ['EcoWitt-WH51', 'Greenhouse', 'soil'],
];
const devices = rfModels.map((m, i) => {
  const age = ri(5, 4000);
  const kind = m[2];
  return {
    key: 'rf|' + m[0] + '-' + (100 + i), slug: m[0].toLowerCase() + '-' + (100 + i),
    label: m[1], model: m[0], type: 'sensor',
    first_seen: iso(ri(10, 60) * 864e5), last_seen: iso(age * 1000), age_seconds: age,
    active: age < 120, count: ri(40, 9000),
    present: kind === 'car' ? (i % 2 === 0) : undefined,
    known: { kind, label: m[1] },
  };
});
const noiseRecent = Array.from({ length: 30 }, (_, i) => [iso((30 - i) * 10000), +r(-80, -68).toFixed(1)]);
const hourly = {}; for (let h = 167; h >= 0; h--) { const d = new Date(now - h * 36e5); hourly[d.toISOString().slice(0, 13)] = +r(-80, -70).toFixed(1); }
write('summary.json', {
  demo: true,
  generated_at: iso(8000),
  receiver: { status: 'running', model: 'rtl_433', freq_mhz: 433.92 },
  noise: { current_db: -72.4, baseline_db: -77.9, recent: noiseRecent, hourly },
  weather: { temp_f: 54, temp_c: 12, humidity: 71, wind_mph: 6, desc: 'Overcast', as_of: iso(6e5) },
  devices, devices_total: devices.length,
});

// wifi.json: APs, clients, BLE, derived entities, alerts, known SSIDs/BSSIDs
const vendors = ['Apple', 'Samsung', 'Google', 'Espressif', 'Amazon', 'Ubiquiti', 'TP-Link', 'Unknown'];
const aps = Array.from({ length: 6 }, (_, i) => ({
  mac: mac(), first_seen: iso(ri(2, 40) * 864e5), last_seen: iso(ri(1, 300) * 1000),
  ssids: i < 2 ? ['Home-WiFi'] : i < 4 ? ['Neighbor-5G'] : [], channel: pick([1, 6, 11, 36, 44, 149]),
  crypt: 'WPA2', hidden: false, signal: ri(-82, -42), manuf: pick(vendors), trusted: i < 2,
}));
const clients = Array.from({ length: 9 }, () => ({
  mac: mac(), first_seen: iso(ri(1, 30) * 864e5), last_seen: iso(ri(1, 600) * 1000),
  client_of: [pick(aps).mac], signal: ri(-85, -45), manuf: pick(vendors),
}));
const ble = Array.from({ length: 7 }, (_, i) => ({
  mac: mac(), first_seen: iso(ri(1, 20) * 864e5), last_seen: iso(ri(1, 200) * 1000),
  entity_id: i < 4 ? i : null, signal: ri(-90, -50), manuf: pick(vendors), name: pick(['', 'Fitness band', 'Earbuds', 'Beacon', 'Smartwatch']),
}));
const entities = Array.from({ length: 4 }, (_, i) => ({
  id: i, label: pick(['Phone A', 'Phone B', 'Watch', 'Earbuds']) + ' ' + (i + 1),
  present: i < 3, signal: ri(-80, -48), kind: pick(['phone', 'wearable', 'beacon']),
}));
write('wifi.json', {
  counts: { phones_present: 3, trackers_present: 0, aps_total: aps.length, clients_total: clients.length },
  sensor: { status: 'running', iface: 'wlan0' }, ble_sensor: { status: 'running' },
  aps, clients, ble, entities,
  alerts: [
    { type: 'WF-004', at: iso(9e5), category: 'wifi', severity: 2, message: 'New client ' + clients[0].mac + ' on Home-WiFi', actor: { mac: clients[0].mac } },
    { type: 'WF-009', at: iso(36e5), category: 'wifi', severity: 1, message: 'Probe-only device ' + ble[0].mac, actor: { mac: ble[0].mac } },
  ],
  known: { ssids: ['Home-WiFi'], bssids: { [aps[0].mac.toLowerCase()]: 'Living-room AP', [aps[1].mac.toLowerCase()]: 'Office AP' } },
});

// incidents.json: open + recently closed correlator incidents
const incEvents = [
  { at: iso(9e5), category: 'wifi', type: 'WF-004', message: 'New client joined Home-WiFi', device_key: 'client|' + clients[0].mac, severity: 2 },
  { at: iso(6e5), category: 'wifi', type: 'WF-009', message: 'Repeated probe requests, no association', device_key: 'ble|' + ble[0].mac, severity: 2 },
];
write('incidents.json', {
  counts: { open: 1, open_high: 0 },
  open: [{
    uid: 'INC-20261126-001', id: 1, status: 'open', severity: 'medium',
    summary: 'Unrecognized client associated with Home-WiFi',
    opened_at: iso(9e5), updated_at: iso(3e5), classification: 'unknown_device', confidence: 0.62,
    events: incEvents, findings: [{ type: 'new-device', summary: 'MAC not seen before this week' }],
  }],
  recent_closed: [{
    uid: 'INC-20261125-007', id: 2, severity: 'low', summary: 'Probe burst from a passing device',
    opened_at: iso(9 * 36e5), updated_at: iso(8 * 36e5), closed_at: iso(8 * 36e5), classification: 'transient',
    events: [{ at: iso(9 * 36e5), category: 'wifi', type: 'WF-009', message: 'Probe burst, then gone', device_key: 'ble|' + ble[1].mac, severity: 1 }],
  }],
});

// jobs.json: dongle schedule and run history
const jobNames = ['sweep', 'fobs', 'meters', 'aprs', 'adsb'];
write('jobs.json', {
  schedule: [
    { job: 'sweep', when: '03:30 / 11:30 / 19:30', minutes: 12, what: 'rtl_power occupancy 24-1750 MHz' },
    { job: 'fobs', when: 'hourly :05', minutes: 4, what: 'listen for key-fob / remote bursts' },
    { job: 'meters', when: '*/30', minutes: 6, what: 'utility meter reads (ERT/SCM)' },
    { job: 'aprs', when: '06:00 / 18:00', minutes: 10, what: 'APRS / ham activity survey' },
    { job: 'adsb', when: 'continuous', minutes: 0, what: 'ADS-B aircraft feed' },
  ],
  history: Array.from({ length: 12 }, (_, i) => {
    const job = pick(jobNames); const start = (i + 1) * 4 * 36e5; const len = ri(3, 12) * 6e4;
    const rc = Math.random() < 0.12 ? 1 : 0;
    return { job, started: iso(start), ended: iso(start - len), rc, output: rc === 0 ? `${ri(3, 90)} decodes` : 'no device found' };
  }),
});

// ham.json: latest APRS/ham survey
write('ham.json', { survey: { latest: { at: iso(6 * 36e5), health: 'ok', heard: ri(2, 14), bands: ['2m', '70cm'] } } });

// sweep.json: rtl_power occupancy sweeps + anomalies
const N = 220, f0 = 24, f1 = 1750;
const bins = Array.from({ length: N }, (_, i) => +(f0 + (f1 - f0) * i / (N - 1)).toFixed(2));
const mkSweep = endAgo => {
  const db = bins.map(f => {
    let v = r(-44, -38);
    for (const c of [433.9, 915, 315, 345, 1090]) if (Math.abs(f - c) < 6) v = r(-18, -6); // ISM / ADS-B carriers
    return +v.toFixed(1);
  });
  return { end: iso(endAgo), db, bins };
};
write('sweep.json', {
  sweeps: [mkSweep(9 * 36e5), mkSweep(1 * 36e5)],
  anomalies: [{ at: iso(1 * 36e5), start_mhz: 430, end_mhz: 435, peak_db: -6.2, above_db: 9 }],
});

// adsb.json: aircraft near the map's default view. ts is unix seconds; track is the trail polyline
const cx = 39.3, cy = -92.3, nowS = Math.floor(now / 1000);
const aircraft = Array.from({ length: 9 }, (_, i) => {
  const lat = +(cx + r(-1.3, 1.3)).toFixed(4), lon = +(cy + r(-2.0, 2.0)).toFixed(4);
  const track = ri(0, 359), alt = ri(5, 390) * 100, speed = ri(180, 520);
  const rad = track * Math.PI / 180;
  const trail = Array.from({ length: 6 }, (_, k) => {
    const back = (6 - k) * 0.06;
    return [+(lat - Math.cos(rad) * back).toFixed(4), +(lon - Math.sin(rad) * back / Math.cos(cx * Math.PI / 180)).toFixed(4)];
  });
  return {
    hex: (0xA00000 + ri(1, 0xfffff)).toString(16), flight: 'SMPL' + (100 + i),
    track: trail,
    last: { lat, lon, alt, speed, track, ts: nowS - ri(2, 240) },
  };
});
write('adsb.json', { generated_at: iso(4000), receiver: { lat: cx, lon: cy }, aircraft });

console.log('wrote sample data to public/: summary, wifi, incidents, jobs, ham, sweep, adsb');

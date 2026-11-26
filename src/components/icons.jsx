// Line icons in the redesign's style: 24x24 viewBox, stroke 1.8, round joins.
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const Icon = ({ name, size = 17, ...rest }) => {
  const p = PATHS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} {...rest} aria-hidden="true">
      {p}
    </svg>
  );
};

const PATHS = {
  now: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  incidents: <><path d="M12 3.2 19 6v5.2c0 4.4-2.9 7.9-7 9.6-4.1-1.7-7-5.2-7-9.6V6z" /><path d="M12 8.3v4.6" /><path d="M12 16.2v.1" /></>,
  timeline: <><path d="M4 6h3" /><path d="M4 12h3" /><path d="M4 18h3" /><path d="M10 6h10" /><path d="M10 12h7" /><path d="M10 18h9" /></>,
  devices: <><rect x="3.5" y="4" width="17" height="6.5" rx="1.6" /><rect x="3.5" y="13.5" width="17" height="6.5" rx="1.6" /><path d="M7.5 7.25h.01" /><path d="M7.5 16.75h.01" /></>,
  tracked: <><path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" /></>,
  trackedFill: <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="currentColor" />,
  spectrum: <><path d="M3 13h2.5l2-6 3 11 3-8 2 4.5 1.5-1.5H21" /></>,
  sensors: <><path d="M12 21v-9" /><path d="M8.3 8.6a5.2 5.2 0 0 1 7.4 0" /><path d="M5.4 5.7a9.3 9.3 0 0 1 13.2 0" /><path d="M9 21h6" /></>,
  wireless: <><path d="M12 20v-6" /><path d="M8.5 9.5a5 5 0 0 1 7 0" /><path d="M5.6 6.6a9 9 0 0 1 12.8 0" /><circle cx="12" cy="13" r="1.2" fill="currentColor" /></>,
  antenna: <><path d="M12 20v-6" /><path d="M8.5 9.5a5 5 0 0 1 7 0" /><path d="M5.6 6.6a9 9 0 0 1 12.8 0" /><circle cx="12" cy="13" r="1.2" fill="currentColor" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2.4" /><path d="M11 17.8h2" /></>,
  watch: <><rect x="7" y="7" width="10" height="10" rx="3" /><path d="M9 7l.8-3.5h4.4L15 7" /><path d="M9 17l.8 3.5h4.4L15 17" /></>,
  headphones: <><path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" /><rect x="2.8" y="13.5" width="4" height="6" rx="1.6" /><rect x="17.2" y="13.5" width="4" height="6" rx="1.6" /></>,
  tag: <><path d="M11 3.5H5.5a2 2 0 0 0-2 2V11l9.3 9.3a2 2 0 0 0 2.8 0l5.4-5.4a2 2 0 0 0 0-2.8z" /><circle cx="7.8" cy="7.8" r="1.2" /></>,
  ap: <><rect x="3.5" y="13" width="17" height="6.5" rx="2" /><path d="M8 13V8.5" /><path d="M16 13V8.5" /><path d="M6 6.5a6 6 0 0 1 12 0" /></>,
  client: <><rect x="3.5" y="5" width="17" height="10.5" rx="2" /><path d="M8 19h8" /><path d="M12 15.5V19" /></>,
  weather: <><path d="M17.5 13a4 4 0 0 0-7.7-1.4A3 3 0 0 0 10 17.5h7a2.7 2.7 0 0 0 .5-4.5z" /></>,
  car: <><path d="M4 16v-3.2L6 8h12l2 4.8V16" /><path d="M4 16h16" /><circle cx="7.5" cy="17.5" r="1.6" /><circle cx="16.5" cy="17.5" r="1.6" /></>,
  key: <><circle cx="8" cy="12" r="3.4" /><path d="M11.4 12H21" /><path d="M18 12v3" /><path d="M15 12v2.4" /></>,
  meter: <><circle cx="12" cy="12" r="8.5" /><path d="M12 12l3.6-2.2" /></>,
  plane: <path d="M21.5 15.5 13.5 10V3.2c0-.7-.5-1.2-1.5-1.2s-1.5.5-1.5 1.2V10l-8 5.5v2l8-2.5v4.6l-2.5 1.8v1.4l4-1.2 4 1.2v-1.4L13.5 19v-4.6l8 2.5z" />,
  jobs: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7" /></>,
  alert: <><path d="M12 4.5 21 19H3z" /><path d="M12 10v4" /><path d="M12 16.6v.1" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  chevron: <><path d="m9 6 6 6-6 6" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  csv: <><path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M4 19h16" /></>,
};

// Map an RF model/type to a rail-style icon name.
export const rfIcon = d => {
  const t = (d.type || '').toLowerCase(), m = (d.model || '').toLowerCase();
  if (t === 'aircraft' || m.includes('adsb')) return 'plane';
  if (t === 'weather' || m.includes('acurite')) return 'weather';
  if (t === 'tpms' || t === 'keyfob' || m.includes('tpms') || m.includes('key')) return 'car';
  if (m.includes('meter') || t === 'meter') return 'meter';
  if (t === 'aprs' || t === 'mesh') return 'antenna';
  return 'sensors';
};

// BLE / wireless row icon by kind.
export const bleIcon = e => {
  const k = e.kind || '';
  if (e.phone_class || k === 'apple_nearby') return 'phone';
  if (k.includes('findmy') || k === 'tile' || k === 'samsung_smarttag' || k === 'google_findmy') return 'tag';
  if (k === 'hp_fastpair') return 'headphones';
  return 'wireless';
};

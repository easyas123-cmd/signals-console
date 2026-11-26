# Signals Defense console

A dense, dark "instrument panel" single-page dashboard for a home RF and Wi-Fi monitoring system.
It shows what's on the air and on the network: Wi-Fi and BLE devices, wireless incidents, an
RF spectrum sweep, an ADS-B aircraft map, scheduled sensor jobs, and a device timeline. Built as
the frontend for a personal homelab signals-monitoring project.

This repository is the **frontend only**. It's a static React SPA that reads JSON from a same-origin
backend (see "Data" below); the collectors and relay that produce that data are not included.

## Tech

- **React 19** with a hand-rolled store on `useSyncExternalStore` (no Redux, no query library) and
  a tiny hash router.
- **Vite 8** build, `base: './'` so the bundle runs at any mount point.
- **Leaflet** for the ADS-B / spectrum map, with an **offline** Natural Earth basemap vendored in
  `public/geo/` (no tile server).
- **No CDN, no runtime egress.** React, Leaflet, the IBM Plex fonts and the basemap are all bundled
  or vendored, so the app makes no third-party requests at runtime.

## Features

- **Now / Overview**: at-a-glance state: open incidents, trackers present, sensor health.
- **Incidents**, **Timeline (movements)**, **Wireless** + per-radio detail, **Devices** + detail,
  **Tracked** (starred/annotated entities), **Spectrum & sky** (RF sweep + ADS-B map),
  **Sensors & jobs**.
- **Client-side annotations** (notes, tags, watch, tracking) that persist in `localStorage` and
  sync to an optional relay, with 409-aware merge.
- **Live updates** over Server-Sent Events, degrading quietly when the relay is absent.
- Sortable, filterable data tables with **CSV export**, shared column definitions, and a small
  chart/metric component kit.

## Run

```sh
npm install
npm run dev      # local dev server
npm run build    # -> dist/  (static, deployable anywhere)
```

Node 18+ recommended.

## Data

The app fetches relative JSON from wherever it's served, and tolerates missing feeds (empty views,
no errors). The backend is expected to serve:

| Path | Contents |
|---|---|
| `summary.json` | top-line counts and health |
| `wifi.json` | Wi-Fi/BLE radios, clients, SSIDs |
| `incidents.json` | wireless incidents |
| `jobs.json` | scheduled sensor jobs + status |
| `sweep.json` | RF spectrum sweep |
| `ham.json`, `adsb.json` | ham/APRS and ADS-B feeds |
| `devices/<key>.json` | per-device detail |
| `live` | Server-Sent Events stream |
| `annotations` | GET/POST notes/tags/tracking store |

### Sample data

`public/*.json` is a generated sample dataset (devices, Wi-Fi, incidents, an RF sweep, and ADS-B
aircraft) so `npm run dev` shows a populated dashboard without a backend. Regenerate it with:

```sh
node scripts/gen-sample-data.mjs
```

Point the app at a real backend by serving your own JSON at the same paths; the `live` (SSE) and
`annotations` endpoints simply stay inactive without one.

## License

MIT, see [LICENSE](LICENSE).

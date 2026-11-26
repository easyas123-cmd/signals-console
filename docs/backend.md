# Reference backend design

This console is the frontend of a signals-monitoring system. It reads a small set of JSON files
and two live endpoints (see the "Data" section of the top-level README). This document scopes a
clean, generic **reference backend** that produces those feeds, so that anyone with an SDR, a
Wi-Fi adapter, and a Bluetooth adapter can clone the project and run it.

It is a design, not an implementation. The goal is a backend that is hardware-agnostic,
config-driven, and safe to publish: it ships generic collectors and example correlation rules, and
contains no site-specific detection logic, device lists, hostnames, or keys.

## Goals

- Emit exactly the JSON contract the console reads, so the two halves are decoupled and swappable.
- Run on commodity hardware: one or more RTL-SDR dongles, a monitor-mode-capable Wi-Fi adapter, a
  Bluetooth/BLE adapter. Degrade cleanly when any of these is absent.
- **Support multiple SDRs so collectors run continuously, in parallel, rather than time-sharing one
  dongle.** Still work with a single dongle by falling back to a shared schedule.
- Be clone-and-run: a `config.yml`, an `.env.example`, and `docker compose up` (with a systemd
  alternative documented).
- Carry no secrets and no private detection logic. Correlation ships as a small example rule set
  that users extend.

## Non-goals

- Not a SIEM. The reference correlator is a minimal, documented engine with a couple of example
  rules, not a production detection stack.
- No cloud dependency, no external egress at runtime (matches the frontend).
- Not a port of any specific private deployment. See "What not to port" below.

## The data contract

The backend writes these under a single `data/` directory that the web layer serves at the site
root. Shapes are summarized here; the authoritative consumer is the console's `src/lib/store.js`
and views.

| Path | Writer | Shape (summary) |
|---|---|---|
| `summary.json` | aggregator | `{ generated_at, receiver:{status,freq_mhz}, noise:{current_db,baseline_db,recent:[[t,db]],hourly:{}}, weather?, devices:[{key,label,model,type,first_seen,last_seen,age_seconds,active,count,present?,known:{kind,label}}], devices_total }` |
| `wifi.json` | wifi + ble collectors | `{ counts:{phones_present,trackers_present,...}, sensor:{status}, ble_sensor:{status}, aps:[{mac,first_seen,last_seen,ssids,channel,crypt,signal,manuf,trusted}], clients:[{mac,client_of:[bssid],signal,manuf,first_seen}], ble:[{mac,entity_id,signal,manuf,name,first_seen}], entities:[{id,label,present,signal,kind}], alerts:[{type,at,category,severity,message,actor:{mac}}], known:{ssids:[],bssids:{mac:label}} }` |
| `incidents.json` | correlator | `{ counts:{open,open_high}, open:[{uid,id,status,severity,summary,opened_at,updated_at,classification,confidence,events:[{at,category,type,message,device_key,severity}],findings:[{type,summary}]}], recent_closed:[...] }` |
| `jobs.json` | scheduler | `{ schedule:[{job,when,minutes,what}], history:[{job,started,ended,rc,output}], current?:{job,started,expected_end,overdue} }` |
| `sweep.json` | sweep collector | `{ sweeps:[{end,db:[...],bins:[mhz...]}], anomalies:[{at,start_mhz,end_mhz,peak_db,above_db}] }` |
| `ham.json` | ham collector | `{ survey:{latest:{at,health,heard,bands:[]}} }` |
| `adsb.json` | adsb collector | `{ generated_at, receiver:{lat,lon}, aircraft:[{hex,flight,track:[[lat,lon]],last:{lat,lon,alt,speed,track,ts}}] }` |
| `devices/<key>.json` | aggregator | per-device detail (history, decodes) |
| `GET/POST annotations` | web layer | notes/tags/watch/track store with a `rev` for optimistic concurrency; POST returns 409 + `{current}` on a stale rev |
| `GET live` (SSE) | live relay | `text/event-stream` of collector events |

`scripts/gen-sample-data.mjs` in this repo already produces valid fixtures for all of these; it is
the executable spec for the shapes and a useful test oracle for the backend.

## Architecture

```
 SDRs ──▶ collectors ──▶ data/*.json ──▶ web layer ──▶ console (static)
  │          │               ▲   │            │
  │          └── events ──▶ live relay (SSE) ─┘
  │                          │
  └── SDR manager (assign by serial, lock, watchdog)
                             │
 aggregator ◀── collector outputs ──▶ correlator ──▶ incidents.json
 scheduler ──▶ jobs.json + /jobs/trigger
 annotations store ◀──▶ console (GET/POST)
```

Components:

1. **Config** (`config.yml` + `.env`): SDR inventory, interfaces, enabled collectors, data dir, web
   bind, scheduler mode. One file to make it clone-and-run.
2. **SDR manager**: enumerates SDRs by stable serial, assigns each to a role, holds a per-serial
   lock so two processes never grab the same device, and watches for stalls/unplugs.
3. **Collectors** (one process per source; each appends events and refreshes its slice of state):
   - `rf433`: `rtl_433` JSON on an ISM band (433.92 by default; 315/915 if assigned) into the
     device list and per-device files.
   - `sweep`: `rtl_power`/`soapy_power` occupancy sweep into `sweep.json`.
   - `adsb`: `dump1090` Mode-S on 1090 MHz into `adsb.json`.
   - `meters`: `rtlamr` utility meters (900 MHz ISM).
   - `ham`/`aprs`: `rtl_power` survey + `direwolf` APRS into `ham.json`.
   - `wifi`: Kismet (or `airodump-ng`) on a monitor-mode adapter into APs/clients/BLE.
   - `ble`: HCI/bleak scan into BLE addresses and derived entities.
4. **Aggregator**: merges collector state into `summary.json`, maintains the noise floor
   (recent + hourly baseline), device presence, and first/last-seen.
5. **Correlator (reference)**: reads the collectors' event stream and writes `incidents.json`.
   Ships 2–3 **example** rules (new device seen, noise floor anomaly, signal appeared/absent),
   each a small pure function, explicitly documented as a starting point to extend. No private
   rule set.
6. **Scheduler**: owns `jobs.json`, `/jobs/status`, `/jobs/trigger`. In dedicated mode it is mostly
   informational; in shared mode it runs the borrow-and-return rotation (below).
7. **Web layer**: serves the built console, the `data/` JSON, the `/live` SSE relay, and the
   `annotations` GET/POST store. A small FastAPI/Flask (or Node) service; Caddy/nginx optional in
   front. Same-origin, so the console's relative fetches just work.
8. **Annotations store**: a JSON file plus a `rev` counter and the 409-merge the console expects.

## Multiple SDRs, always on (the core of this scope)

Today one dongle is shared: a 433.92 listener runs continuously and scheduled jobs stop it, borrow
the dongle, and give it back. One `rtl_433` and one `dump1090` cannot share a single dongle at the
same time, so continuous coverage of several bands requires several radios. The reference backend
makes that a first-class, configurable thing.

**Identify SDRs by serial, not index.** USB indices reorder across reboots and hubs. Set a stable
serial per dongle (`rtl_eeprom -s`), and address radios by serial everywhere. Serials must not look
like a small integer (the rtl tools read `"1"` as device index 1).

**Map serials to roles in config:**

```yaml
scheduler:
  mode: dedicated            # dedicated | shared
sdrs:
  - serial: ISM433           # continuous rtl_433 on 433.92
    role: rf433
  - serial: ADSB1090         # continuous dump1090
    role: adsb
  - serial: SCAN             # continuous rolling rtl_power sweep
    role: sweep
  - serial: SUB1G            # 315 / 915 / meters, rotated on this one dongle
    role: multi
    rotate: [fobs315, ism915, meters]
```

**Two scheduler modes:**

- **dedicated**: every role that has its own SDR runs as a persistent service and never stops.
  The 433 listener stays up, ADS-B is always on, the sweep runs continuously. `jobs.json.current`
  becomes informational (nothing is "borrowed"). This is the "run constantly" target.
- **shared**: when roles outnumber radios, the leftover roles share a pool SDR on a timed
  rotation: acquire the per-serial lock, stop the incumbent, run, restart the incumbent, release.
  This is the single-dongle fallback, and it is also how a `role: multi` dongle cycles several
  sub-GHz jobs.

**Safety and health:**
- Per-serial lockfile; the SDR manager assigns and never double-grabs a radio.
- A watchdog restarts a collector whose SDR stalled, and surfaces a down radio in `summary.json`
  and `jobs.json`.
- Document the physical limits: a powered USB hub for several dongles, USB bandwidth, and
  front-end overload/thermal notes.

**Degradation:** with one dongle and `mode: shared` you still get 433 + rotated jobs. With no Wi-Fi
adapter the `wifi.json` sensor simply reports absent and those views show empty states (the console
already handles this).

## Packaging

- **Primary: Docker Compose.** One service per collector, plus aggregator, correlator, scheduler,
  and web. USB passthrough for the SDRs; `network_mode: host` for the Wi-Fi/BLE sniffers where
  needed. `docker compose up` after editing `config.yml`.
- **Alternative: systemd units + timers**, generated from the same config, for a bare-metal host.
- `config.yml`, `.env.example`, and a `make up` / `make sample` (sample runs against the fixtures
  with no radios, so the UI is populated on first clone).

## What not to port (keep it a clean reference)

Explicitly excluded from the reference, to keep it generic and to avoid exposing a live network's
defenses:

- Site-specific detection rules and thresholds; private incident-rule catalogs.
- Trust lists, known-device/known-BSSID maps, device fingerprints, SSIDs, MACs.
- Hostnames, IPs, deploy accounts, TLS/mTLS or SSH config, data paths tied to one host.
- Any external dashboard/SIEM wiring. The console's optional "external dashboard" link stays a
  config value that is empty by default.

The reference ships empty/example versions of all of these and documents how to add your own.

## Suggested build order

1. **MVP (populates Now / Spectrum / Sky / Devices):** config + SDR manager, `rf433` + `sweep` +
   `adsb` collectors, aggregator, web layer serving JSON + annotations + a live stub. Single- and
   multi-SDR config. One example correlator rule.
2. **Wireless:** `wifi` + `ble` collectors, the `wifi.json` views, a second example rule.
3. **Breadth:** `meters`, `ham`/`aprs`, per-device history, richer example rules, the systemd path.

## Constraints and notes

- `rtl_433` and `dump1090` cannot share one dongle simultaneously; continuous multi-band coverage
  needs multiple radios (the reason this scope exists).
- Wi-Fi capture needs a monitor-mode-capable adapter; BLE needs an HCI adapter. Both are optional.
- Passive receive only. Decoding some signals, or capturing others, is regulated in some
  jurisdictions; the README should say "receive-only, know your local law," and ship nothing that
  transmits.

## Repo layout (proposed)

```
signals-backend/
  config.yml  .env.example  docker-compose.yml  Makefile  README.md
  sdr/            # SDR manager: enumerate, assign, lock, watchdog
  collectors/     # rf433, sweep, adsb, meters, ham, wifi, ble
  aggregate/      # summary.json builder, noise floor, presence
  correlate/      # reference rule engine + example rules
  web/            # static serving, /live SSE, annotations store, /jobs/*
  schema/         # JSON schema for the contract (shared with the console)
```

A `schema/` shared between this repo and the console turns the data contract into something both
sides validate against.

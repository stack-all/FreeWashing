# FreeWashing

Dormitory washing machine controller built with React, TypeScript, Vite, and local PWA assets for GitHub Pages.

## Features

- React + TypeScript + Vite frontend, split into reusable control, connection, status, builder, and manual-packet components.
- No runtime CDN, external font, or remote icon dependency.
- Web Bluetooth connection for the common `0xffe0` service, with write fallback discovery when `0xffe2` is not available.
- Notification listener for `0xffe1` and status response parsing.
- Remembered-device flow through `navigator.bluetooth.getDevices()` when Chrome exposes the Web Bluetooth permissions backend.
- Protocol-driven command generation from `TT / CC / MM / LL` fields and the reverse-engineered CRC.
- Responsive phone and desktop control console.
- Local `.mod` 8-bit loop asset under `webui/public/audio/`, mounted as background playback with a mute control.
- Common presets for intensive wash, standard wash, quick wash, spin, and tub clean.
- Water-level control and custom parameter builder.
- Manual raw HEX packet sender.
- Separate pause and resume controls, with pause using the confirmed fixed packet.

## Protocol

Request frames are generated as:

```text
AA TT CC MM LL CRC_H CRC_L 55
```

The CRC is calculated over the first five bytes:

```text
crc = 0xE4A5
crc ^= byte
if crc & 1: crc = (crc >> 1) ^ 0x8048
else:       crc = crc >> 1
```

Known fields:

- `TT=00` query status, `TT=01` send control.
- `CC=9A` normal washing/query family.
- `CC=9B` special mode family.
- `MM=01` intensive, `02` standard, `03` quick, `04` spin, `08` tub clean.
- `LL=01/02/03` low, middle, high water level.

The pause/resume packet is intentionally editable because the reference data does not contain a verified pause sample. The default is generated from `TT=01 CC=9B MM=05 LL=00`.

## Development

The frontend app lives under `webui/`:

```bash
cd webui
npm install
npm run dev
npm test
npm run build
```

Open the Vite dev server on `localhost`; Web Bluetooth requires HTTPS or a secure localhost context.

The UI entry is `webui/src/main.tsx`; app-level state and Bluetooth orchestration live in `webui/src/App.tsx`, while view modules live under `webui/src/components/`.

## GitHub Pages

The production build uses `/FreeWashing/` as the Vite base path:

```bash
cd webui
npm run build
```

`.github/workflows/pages.yml` builds and tests from `webui/`, then deploys `webui/dist` to GitHub Pages on pushes to `main`.

## Bluetooth Device Retention

Chrome's `navigator.bluetooth.getDevices()` returns devices that the current origin is already allowed to access. The app uses that API when available so a previously selected device can be listed and reconnected without opening the chooser again.

This API is still experimental and browser/platform dependent. If it is not available, the app falls back to `requestDevice()`.

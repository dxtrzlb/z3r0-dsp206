# z3r0 DSP 206

An unofficial, cross-platform controller for the **[t.racks DSP 206](https://www.thomann.de/)** speaker-management processor (Thomann). One desktop app drives the unit over USB; phones and tablets remote-control it over your LAN; and an MCP / OpenAPI bridge lets AI agents and scripts drive it too — all from a single shared command registry.

> The stock DSP 206 editor is Windows-only. This project gives you a modern UI on **Windows, macOS, Android, and iPad**, plus headless/agent access.

- **Repo:** https://github.com/dxtrzlb/z3r0-dsp206
- **Latest release:** https://github.com/dxtrzlb/z3r0-dsp206/releases/latest

---

## Features

- **Mixing desk** — per-channel gain, mute, polarity invert, metering for 2 inputs (In A / In B) and 6 outputs (Out 1–6).
- **Interactive Frequency View** — drag PEQ bands directly on the response graph.
- **Crossover** — HPF / LPF with selectable slope (Butterworth / Bessel / Linkwitz, 6–48 dB/oct).
- **Dynamics** — compressor, limiter, and input noise gate, calibrated to real engineering units (dB / ms / ratio).
- **31-band graphic EQ** on inputs.
- **Routing matrix** — In A / In B / A+B to any of the 6 outputs, with per-input trim.
- **Delay** per channel (ms / metres / feet).
- **Presets** — recall and store.
- **Test-tone generator** — pink / white / sine.
- **Remote control** — pair a tablet or phone by scanning a QR code; full feature parity with the desktop.
- **Agent access** — MCP server and OpenAPI 3.1 endpoint for LLMs, scripts, and automations.

---

## Download & Install

Grab the build for your platform from the **[latest release](https://github.com/dxtrzlb/z3r0-dsp206/releases/latest)**.

| Platform | File | Notes |
|---|---|---|
| Windows 10/11 | [`z3r0-DSP-206-Setup-0.1.0.exe`](https://github.com/dxtrzlb/z3r0-dsp206/releases/download/v0.1.0/z3r0-DSP-206-Setup-0.1.0.exe) | Installer (NSIS) |
| macOS (Apple Silicon) | [`z3r0-DSP-206-0.1.0-arm64.dmg`](https://github.com/dxtrzlb/z3r0-dsp206/releases/download/v0.1.0/z3r0-DSP-206-0.1.0-arm64.dmg) | M1 / M2 / M3+ |
| macOS (Intel) | [`z3r0-DSP-206-0.1.0-x64.dmg`](https://github.com/dxtrzlb/z3r0-dsp206/releases/download/v0.1.0/z3r0-DSP-206-0.1.0-x64.dmg) | Intel Macs |
| Android phone/tablet (remote) | [`z3r0-DSP-206-0.1.0.apk`](https://github.com/dxtrzlb/z3r0-dsp206/releases/download/v0.1.0/z3r0-DSP-206-0.1.0.apk) | Connects to a running desktop, not the unit |

> The desktop builds are **not code-signed**, so the OS will warn you the first time. That's expected — see the per-platform steps below.

### Windows

1. Download and run **`z3r0-DSP-206-Setup-0.1.0.exe`**.
2. SmartScreen may show "Windows protected your PC" → click **More info → Run anyway**.
3. Finish the installer (you can choose the install folder).
4. Plug the DSP 206 into a USB port. **Close the official t.racks editor first** — only one app can own the USB device at a time.
5. Launch **z3r0 DSP 206** and click **Connect**.

No driver needed — the device is class-compliant USB-HID.

### macOS

1. Download the **arm64** DMG (Apple Silicon) or **x64** DMG (Intel).
2. Open the DMG and drag the app to **Applications**.
3. First launch is blocked by Gatekeeper because the app is unsigned. Either:
   - **Right-click the app → Open → Open**, or
   - Run once in Terminal: `xattr -dr com.apple.quarantine "/Applications/z3r0 DSP 206.app"`
4. Connect the DSP 206 over USB, **close the official editor**, then launch and click **Connect**.

### Android (remote control)

The mobile app is a **remote** — it talks to a desktop hub over Wi-Fi, not to the DSP directly. The desktop app must be running and connected to the unit, on the **same network**.

1. Download **`z3r0-DSP-206-0.1.0.apk`** to your device.
2. Allow installs from your browser/file manager when prompted ("install unknown apps").
3. Install and open it.
4. On the desktop app, click **Tablet** to show a pairing **QR code**.
5. In the mobile app, **scan the QR** (or enter the host + 6-digit code manually). You're connected.

### iPad / iOS (remote control)

There is no pre-built iOS binary yet (it needs an Apple Developer account). To run it on an iPad today, use Expo Go from source — see [Build from source](#build-from-source) → iPad app.

### Linux

No pre-built Linux binary in this release. You can build an AppImage from source (`npm run package`), though the native USB module currently needs attention on Linux.

---

## How it works

```
   t.racks DSP 206 ──USB-HID──┐
                              ▼
                     ┌─────────────────┐         ┌──────────────────┐
                     │  Desktop hub    │  LAN    │  iPad / Android   │
                     │  (Electron)     │◄───────►│  remote (Expo)    │
                     │  owns state +   │  HTTP   └──────────────────┘
                     │  USB + LAN srv  │  + WS   ┌──────────────────┐
                     └─────────────────┘◄───────►│  MCP / OpenAPI    │
                                                 │  agents & scripts │
                                                 └──────────────────┘
```

Everything — the desktop UI, the remote apps, and the agent bridge — issues the **same commands** against one source of truth:

- **`@z3r0/core`** — the protocol codecs and a single command **registry** (each command = validated params + a pure `apply()` that produces the new state and the USB frames). This also emits the JSON Schema and OpenAPI doc.
- **Desktop hub** (Electron) — owns the USB-HID connection and the canonical device state, and runs a LAN server on **port 7206** (HTTP + WebSocket, mDNS `_dsp206._tcp`), protected by a 6-digit pairing code.
- **Remote app** (Expo / React Native) — a thin client that mirrors hub state and dispatches commands over the LAN.
- **`@z3r0/mcp`** — a stdio MCP server exposing the full command set as tools.

See [`DSP206_PROTOCOL.md`](DSP206_PROTOCOL.md) for the reverse-engineered USB protocol and [`REMOTE-CONTROL.md`](REMOTE-CONTROL.md) for the LAN/agent contract.

---

## Build from source

**Prerequisites:** [Node.js](https://nodejs.org/) 20 or newer and npm. On Windows, building the native USB module may require the Visual Studio "Desktop development with C++" build tools.

```bash
git clone https://github.com/dxtrzlb/z3r0-dsp206.git
cd z3r0-dsp206
npm install
```

**Run the desktop app (with a real device):**

```bash
npm run dev
```

**Preview the UI in a browser (no device — uses an in-memory mock):**

```bash
npm run dev:web      # http://localhost:5199
```

**Build installers for the current OS:**

```bash
npm run package      # output in ./release
```

**iPad app (via Expo Go):**

```bash
cd apps/ipad
npx expo start       # scan the QR with Expo Go on your iPad/phone
```

**Quality gate:**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

---

## Agent access (MCP & OpenAPI)

The desktop hub must be running (it serves the API on `http://127.0.0.1:7206`).

**OpenAPI 3.1:** `GET http://127.0.0.1:7206/openapi.json` — one operation per command; destructive operations are flagged `x-destructive`.

**MCP (for Claude, etc.):**

```bash
npm run build -w @z3r0/mcp
```

Then point your MCP client at `node packages/mcp/dist/index.js` with:

| Env var | Purpose | Default |
|---|---|---|
| `DSP206_URL` | Hub base URL | `http://127.0.0.1:7206` |
| `DSP206_CODE` | 6-digit pairing code from the desktop app | — |
| `DSP206_TOKEN` | Pre-shared token (alternative to the code) | — |

It exposes `dsp_get_state`, `dsp_get_meters`, and one tool per command (gain, mute, PEQ, crossover, dynamics, routing, presets, …). Preset load/store require an explicit `confirm: true`.

---

## Project layout

```
packages/core   @z3r0/core — protocol, command registry, state, OpenAPI
packages/mcp    @z3r0/mcp  — stdio MCP server
src/main        Electron main: USB-HID device, hub, LAN server
src/renderer    Desktop UI (React + zustand)
apps/ipad       Expo remote app (iPad / Android)
```

---

## Notes & disclaimer

- The controller and the **official t.racks editor cannot run at the same time** — both want exclusive ownership of the USB device. Quit one before using the other.
- This is an **unofficial** project, not affiliated with or endorsed by Thomann / the t.racks brand. The protocol was reverse-engineered from USB captures. Some dynamics/crossover units are uncalibrated edge cases. **Use at your own risk** — you are responsible for your equipment and your ears.

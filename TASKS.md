# Task Breakdown: z3r0 DSP 206

> Phase 3 artifact. Built from [PLAN.md](PLAN.md). Ordered by dependency. Each task is one
> focused session, ≤5 files, with explicit acceptance + verification.

## Phase 0 — Hardware / node-hid spike

- [ ] **0.1 — node-hid build + device round-trip spike**
  - Acceptance: a throwaway script opens VID `0x0168`/PID `0x0821`, sends the handshake, runs a
    few keepalives, decodes one `0x40` meter value, and releases the handle cleanly.
  - Verify: `node spike.mjs` prints a meter value and exits; reopen the official editor — it
    connects without hanging.
  - Files: `spike.mjs` (deleted after Phase 1). Stop everything if the native build fails.

## Phase 1 — Protocol core (pure, no hardware)

- [ ] **1.1 — Project scaffold + tooling**
  - Acceptance: electron-vite + TypeScript + Vitest + ESLint configured; `npm run typecheck`,
    `npm test`, `npm run lint` all run (empty/passing).
  - Verify: the three scripts exit 0.
  - Files: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `.eslintrc`.

- [ ] **1.2 — Frame + checksum + channel map**
  - Acceptance: `checksum`, `buildFrame`, `CH` implemented per §2; keepalive builds to
    `10 02 00 01 01 40 10 03 40`.
  - Verify: tests cover the §2 worked example + handshake frame.
  - Files: `src/main/device/protocol.ts`, `test/protocol.test.ts`.

- [ ] **1.3 — Numeric codecs (gain, freq, Q, dyn, delay, PEQ/GEQ gain)**
  - Acceptance: all §5 codecs implemented with clamps + little-endian; delay ≥683 ms clamps (no
    wrap); freq/Q use 300/100 steps; dyn threshold/time per §5.8.
  - Verify: byte-match tests for the doc's verified anchors (1000 Hz→170, Q 2.0→28, −6 dB thr,
    delay clamp, gain two-segment curve).
  - Files: `src/main/device/protocol.ts`, `test/protocol.test.ts`.

- [ ] **1.4 — High-level command builders (all blocks)**
  - Acceptance: `setGain/setMute/setPeqBand/setGeqBand/setHpf/setLpf/setDelay/setLimiter/`
    `setCompressor/setGate/setMatrixRoute/setMatrixLevel/loadPreset/storePreset/setPresetName`
    each produce the exact frame from the scope table.
  - Verify: byte-match tests incl. the doc's tricky cases — gate threshold at index 7, matrix
    Out 1 In A −6 dB → `…00 DC`, Out 1 both → `02 03`.
  - Files: `src/main/device/commands.ts`, `test/commands.test.ts`.

- [ ] **1.5 — Meter decode**
  - Acceptance: `decodeFloat16` + `parseMeters` with group map `[0,1,4,5,6,7,8,9]`; nonexistent
    groups read 0.
  - Verify: tests on a synthetic `0x40` response frame; gate: 100% coverage on protocol/commands/
    meters.
  - Files: `src/main/device/meters.ts`, `test/meters.test.ts`.

## Phase 2 — Device transport

- [ ] **2.1 — HID open/write/read**
  - Acceptance: `hid.ts` enumerates by VID/PID, opens, writes a 65-byte report (report-id + 64
    padded), subscribes to IN, parses `10 02 … 10 03` frames, closes.
  - Verify: on hardware — open succeeds, raw frames arrive.
  - Files: `src/main/device/hid.ts`.

- [ ] **2.2 — Session: handshake + keepalive + clean shutdown**
  - Acceptance: handshake once, 130 ms keepalive loop, meter frames dispatched via callback;
    handle released on quit / SIGINT / SIGTERM / uncaught exception.
  - Verify: on hardware — meters stream; kill the process every which way, then the official
    editor reconnects without hanging. **Hard gate.**
  - Files: `src/main/device/session.ts`.

## Phase 3 — IPC + preload

- [ ] **3.1 — Typed preload bridge + IPC handlers**
  - Acceptance: `connect`/`disconnect`/`status`/`meters` events + one `sendCommand(block, ch,
    params)` mapped to `commands.ts`; contextIsolation on, no Node in renderer.
  - Verify: a temporary renderer log shows connect + streaming meter events; `typeof require`
    is `undefined` in renderer.
  - Files: `src/main/ipc.ts`, `src/preload/index.ts`.

## Phase 4 — App shell

- [ ] **4.1 — Electron window + React root + store**
  - Acceptance: window titled "z3r0 DSP 206"; `store.ts` (zustand) holds connection state, per-
    channel params, meters; connect/disconnect button reflects real status.
  - Verify: `npm run dev` — app launches, connect toggles state.
  - Files: `src/main/index.ts`, `src/renderer/main.tsx`, `src/renderer/App.tsx`,
    `src/renderer/store.ts`.

- [ ] **4.2 — Live meters UI**
  - Acceptance: `Meters.tsx` shows In A/B + Out 1–6 bars driven by the meter stream.
  - Verify: on hardware — bars move with input; muting In A drops routed Out meters (§7).
  - Files: `src/renderer/components/Meters.tsx`.

> **SUPERSEDED (2026-06-19):** Phases 5–6 below are now absorbed into the remote-control rework —
> see [REMOTE-CONTROL.md](REMOTE-CONTROL.md) and the **R0–R5** section at the bottom of this file.
> The Frequency-View desktop UI is no longer built directly against IPC; it becomes a **client of
> the hub** in **R3**. Build the hub foundation (R0–R2) first. The screen designs in Phase 5/6
> still stand — only their wiring changes.

## Phase 5 — Frequency-view UI  *(redesign — see [PLAN.md](PLAN.md) Phase E)*

> Layout: top bar + always-on Output Overview Bar; left rail = Inputs + Routing; center =
> **Frequency View** (the hub); below = tabbed Output Editor. Three top-level views:
> **Edit / Safety / Party**. Channel-strip grid (old 5.1) is retired; GainBlock/MuteBlock survive
> inside the overview bar + editor. `store.ts` state/actions already cover every block — reuse them.
> Polarity is real (CMD 0x36, captured from the editor) — a per-output Normal/Inverse toggle in
> the Output Editor.

- [x] **5.0 — (done) Proof-of-life: gain + mute + live meters**
  - GainBlock/MuteBlock send-on-change and meter stream already verified on hardware. Their logic
    is reused below; the strip-grid container is replaced by the new shell.

- [ ] **5.1 — App shell: top bar + view switcher + Output Overview Bar**
  - Acceptance: top bar (preset name, USB status, **MUTE ALL**, Edit/Safety/Party switch); always-
    visible overview bar of O1–O6 (editable name, level meter, dB, mute/clip state); clicking an
    output sets `selected`. Locked until connected or demo.
  - Verify: clicking a card selects it (editor + graph follow); Mute All sends mute to all outputs.
  - Files: `App.tsx`, `components/TopBar.tsx`, `components/OutputBar.tsx`.

- [ ] **5.2 — Frequency View (interactive EQ + crossover graph)** ← the hub, biggest task
  - Acceptance: log-freq canvas (20 Hz–20 kHz) overlaying the selected output's PEQ curve + HPF/LPF
    slopes; draggable nodes (x=freq, y=gain), wheel=Q; per-output color; legend toggles other
    outputs' curves on/off. Drag commits via existing `setPeqBand`/`setHpf`/`setLpf`.
  - Verify: on hardware — dragging a node moves the response; emitted frames byte-match the doc.
  - Files: `components/FreqView.tsx`, `components/eqMath.ts`, `test/eqMath.test.ts`.

- [ ] **5.3 — Left rail: Inputs meters + Routing matrix (with SUM A+B)**
  - Acceptance: In A/B meters; node-grid routing (rows In A / In B / SUM A+B × Out 1–6); tap node
    toggles route; inputs renamable inline (local label).
  - Verify: on hardware — toggling a node routes (Out 1 both → `02 03`); muting In A drops routed Out meters.
  - Files: `components/InputsRail.tsx`, `components/RoutingMatrix.tsx`.

- [ ] **5.4 — Output Editor tabs: XOVER · EQ · LIMITER · DELAY**
  - Acceptance: tabbed panel for the selected output. XOVER (HPF/LPF freq live, slope disabled
    "v2"); EQ (band list: type/freq/Q/gain/bypass, 3 default + "+"); LIMITER (atk/rel/thr, drag-on-
    meter threshold); DELAY (ms with m/ft readout); per-output Polarity Normal/Inverse toggle.
    Compressor/Gate live under an "advanced" sub-tab.
  - Verify: on hardware — each control's frame byte-matches (delay, limiter defaults, PEQ band, matrix level −6 dB → `…00 DC`).
  - Files: `components/OutputEditor.tsx`, `blocks/{Crossover,Eq,Limiter,Delay,Compressor,Gate}Panel.tsx`.

- [ ] **5.5 — GEQ for inputs**
  - Acceptance: when an **input** is selected, the editor shows a 31-band GEQ (vertical mini-faders);
    inputs have no crossover/limiter.
  - Verify: on hardware — GEQ band 0 +8.1 dB → `0xc9`.
  - Files: `blocks/GeqPanel.tsx`.

## Phase 6 — Safety/Party views, presets, packaging

- [ ] **6.1 — Safety Mode view (fullscreen)**
  - Acceptance: per-output health rows (SAFE/WARNING/CLIPPING from meter thresholds); highest peak;
    **limiter activity = inferred** (level ≥ set threshold), thermal = heuristic — both clearly
    labeled "estimated", not presented as device telemetry.
  - Verify: drive an output near 0 dBFS in demo → row flips to CLIPPING.
  - Files: `components/SafetyView.tsx`, `components/health.ts`, `test/health.test.ts`.

- [ ] **6.2 — Party Mode view (fullscreen)**
  - Acceptance: large across-the-tent monitor — named output level bars, limiter-activity bar,
    overall STATUS. Read-only.
  - Verify: meters drive bars in demo + hardware.
  - Files: `components/PartyView.tsx`.

- [ ] **6.3 — PresetBar: load + store/name**
  - Acceptance: load (`0x20`) with amp-down warning; store sends name (`0x26`) then slot (`0x21`)
    behind a confirm dialog.
  - Verify: on hardware — load changes preset (confirm after disconnect, §3); store writes a slot.
  - Files: `components/PresetBar.tsx`.

- [ ] **6.4 — Packaging**
  - Acceptance: electron-builder config, Windows target, "z3r0 DSP 206" name + icon.
  - Verify: `npm run package` produces a runnable Windows build.
  - Files: `electron-builder config`, `build/icon.*`.

## Dependencies to approve (Ask-first per spec)
- `electron`, `electron-vite`, `vite`, `typescript`, `vitest`, `eslint` — toolchain.
- `node-hid` — transport.
- `react`, `react-dom`, `zustand` — renderer.
- `electron-builder` — packaging.

---

## Remote-control rework (R0–R5)  *(active plan — see [REMOTE-CONTROL.md](REMOTE-CONTROL.md))*

> Foundation-first. Goal: control the DSP from the desktop app, a native iPad app, and LLM agents
> (Claude Code/Hermes via MCP + HTTP). Hub = the Electron app (owns USB + serves the network API).
> One **command registry** drives IPC, WS, REST, OpenAPI, MCP, and shared types.

- [ ] **R0 — Monorepo + extract `packages/core`**
  - Acceptance: workspaces layout (`packages/core`, `apps/desktop`, later `apps/ipad`,
    `packages/mcp`); protocol/codecs/commands/types + tests move into `packages/core`; desktop
    imports from it. No behaviour change.
  - Verify: `npm test` (40+) + `npm run typecheck` green from the new layout; app still launches.

- [ ] **R1 — Command registry + canonical state in hub**
  - Acceptance: builders → registry (name + zod params + description + `destructive` flag + `apply`);
    Electron main owns `DspState`; IPC dispatches through the registry; renderer store becomes a
    synced mirror; read queries (`getState`/`getMeters`/`getHealth`) + first macros.
  - Verify: every existing control still works end-to-end via the registry; registry round-trip tests.

- [ ] **R2 — Embedded HTTP + WS server in Electron main**
  - Acceptance: WS (snapshot + schema on connect, command dispatch, state/meter broadcast) + REST
    (`/api/command`, `/api/state`, `/api/schema`, `/openapi.json`); pairing token auth; LAN bind;
    mDNS `_dsp206._tcp` advertisement.
  - Verify: a CLI/WS client connects, authenticates, sets gain, sees the broadcast; desktop stays in sync.

- [ ] **R3 — Desktop Frequency-View UI as a hub client** *(absorbs old Phase 5/6 screens)*
  - Acceptance: the redesigned UI (top bar + Output Overview Bar, Frequency View graph, routing,
    Output Editor incl. slope + polarity, GEQ, Safety/Party, PresetBar) built against the synced
    store/hub API; slope dropdown wired (ladder from the protocol doc); test-tone generator control.
  - Verify: on hardware — controls move the device; multi-client sync with a second connected client.

- [ ] **R4 — MCP server + OpenAPI**
  - Acceptance: `packages/mcp` generates tools from `/api/schema`; destructive tools require confirm;
    read tools + macros for "auto-set"; `/openapi.json` usable by Hermes/other agents.
  - Verify: Claude Code lists + calls the tools; a prompt sets gain/crossover and the change lands +
    is reflected back in a state snapshot.

- [ ] **R5 — React Native / Expo iPad app**
  - Acceptance: Expo app, WS+REST client, Bonjour discovery + pairing, touch-optimised screens
    (Frequency View, output bar, routing, presets, Safety/Party); reuses `packages/core` types/schema.
  - Verify: on an iPad over WiFi — discovers the hub, pairs, controls the device live; meters stream.

- [ ] **R6 — Packaging** *(was 6.2/6.4)*
  - Acceptance: electron-builder desktop build (Windows + macOS); Expo build for the iPad app.
  - Verify: installable desktop build runs; iPad app installs and connects.

### Decide during R0–R2
- The macro/intent set the LLM exposes ("auto-set" scenarios — to be specified by the owner).
- Pairing UX (QR vs code) + token storage on iPad.
- Whether a future headless hub mode is wanted (out of scope for now).

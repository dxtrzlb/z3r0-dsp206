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

## Phase 5 — DSP block UI  *(milestone: GainBlock first → proof-of-life)*

- [ ] **5.1 — ChannelStrip scaffold + GainBlock + MuteBlock**
  - Acceptance: one strip per channel (In A/B, Out 1–6) with collapsible blocks; gain fader +
    mute send on change. **This is the proof-of-life milestone.**
  - Verify: on hardware — fader moves gain, mute mutes; frames byte-match the doc.
  - Files: `src/renderer/components/ChannelStrip.tsx`, `blocks/GainBlock.tsx`, `blocks/MuteBlock.tsx`.

- [ ] **5.2 — PeqBlock (3 bands + "+") + GeqBlock (inputs only)**
  - Acceptance: 3 PEQ bands default, "+" adds more; type/freq/Q/gain/bypass per band; GEQ 31-band
    on In A/B only.
  - Verify: on hardware — a PEQ change moves response; frames byte-match (GEQ band 0 +8.1 → `0xc9`).
  - Files: `blocks/PeqBlock.tsx`, `blocks/GeqBlock.tsx`.

- [ ] **5.3 — CrossoverBlock (freq live, slope disabled) + DelayBlock**
  - Acceptance: HPF/LPF freq live; slope dropdown rendered **disabled** (tooltip "v2"); delay in ms.
  - Verify: on hardware — freq takes effect; delay frame byte-matches; slope sends nothing.
  - Files: `blocks/CrossoverBlock.tsx`, `blocks/DelayBlock.tsx`.

- [ ] **5.4 — LimiterBlock + CompressorBlock (outputs)**
  - Acceptance: limiter (atk/rel/thr) and compressor (ratio ladder/atk/rel/knee/thr) on Out 1–6.
  - Verify: on hardware — frames byte-match (limiter defaults atk 50 ms/rel 500 ms; ratio ladder anchors).
  - Files: `blocks/LimiterBlock.tsx`, `blocks/CompressorBlock.tsx`.

- [ ] **5.5 — GateBlock (inputs) + MatrixBlock (outputs)**
  - Acceptance: gate (atk/rel/hold/thr) on In A/B; matrix routing mask + per-input level on Out 1–6.
  - Verify: on hardware — gate threshold byte at index 7; matrix Out 1 both → `02 03`, level −6 dB → `…00 DC`.
  - Files: `blocks/GateBlock.tsx`, `blocks/MatrixBlock.tsx`.

## Phase 6 — Presets + packaging

- [ ] **6.1 — PresetBar: load + store/name**
  - Acceptance: load (`0x20`) with amp-down warning; store sends name (`0x26`) then slot (`0x21`)
    behind a confirm dialog.
  - Verify: on hardware — load changes preset (confirm after disconnect, §3); store writes a slot.
  - Files: `src/renderer/components/PresetBar.tsx`.

- [ ] **6.2 — Packaging**
  - Acceptance: electron-builder config, Windows target, "z3r0 DSP 206" name + icon.
  - Verify: `npm run package` produces a runnable Windows build.
  - Files: `electron-builder config`, `build/icon.*`.

## Dependencies to approve (Ask-first per spec)
- `electron`, `electron-vite`, `vite`, `typescript`, `vitest`, `eslint` — toolchain.
- `node-hid` — transport.
- `react`, `react-dom`, `zustand` — renderer.
- `electron-builder` — packaging.

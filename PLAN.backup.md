# Implementation Plan: z3r0 DSP 206

> Phase 2 artifact. Built from [SPEC.md](SPEC.md). Review before Phase 3 (Tasks).

## Build order (dependency-driven)

The protocol core is the foundation everything else composes on, and it's the only part that's
fully testable without hardware — so it goes first and gets locked down with tests.

```
0. Hardware spike       ──   (throwaway: node-hid builds, device opens, session round-trips)
1. Protocol core        ──┐  (pure, byte-tested — no Electron, no hardware)
2. Device transport     ──┤  (node-hid + session lifecycle)
3. IPC + preload bridge ──┤  (typed channel renderer ⇄ main)
4. App shell + connect  ──┤  (Electron window, connection state, meters)
5. DSP block UI         ──┘  (channel strips; blocks built in parallel once 1–4 land)
6. Presets + polish        (store/name dialog, slope-disabled, packaging)
```

### Phase 0 — Hardware / node-hid spike (de-risk first)
The one thing that can stall the whole build is node-hid not compiling on Windows, or the device
not round-tripping. Prove it before stacking anything on top. **Throwaway** — delete after.
- `npm install node-hid`; confirm native build succeeds (node-gyp / MSVC / Python toolchain).
- One script: enumerate VID `0x0168`/PID `0x0821`, open, send handshake `10 02 00 01 01 10 10 03 11`,
  run keepalive a few cycles, confirm a `0x40` meter response comes back, release the handle.
- **Checkpoint:** script prints a decoded meter value and exits clean; official editor reconnects.
  If this fails, stop and fix the toolchain — do not proceed.

### Phase A — Protocol core (no hardware, no Electron)
- `src/main/device/protocol.ts` — `checksum`, `buildFrame`, `CH` map, all §5 codecs
  (gain, freq, Q, PEQ gain, dyn threshold/time, delay, GEQ).
- `src/main/device/commands.ts` — high-level builders for every block in the scope table.
- `src/main/device/meters.ts` — `decodeFloat16`, `parseMeters`, group map `[0,1,4,5,6,7,8,9]`.
- `test/protocol.test.ts` — byte-match the doc's worked examples + clamps/edge cases.
- **Checkpoint:** `npm test` green, 100% on these three files. This is the safety net for full
  parity — everything downstream just plumbs these frames to the device.

### Phase B — Device transport
- `src/main/device/hid.ts` — enumerate VID/PID, open, write 65-byte report (report-id + 64),
  subscribe to IN frames, parse `10 02 … 10 03`, close.
- `src/main/device/session.ts` — handshake, 130 ms keepalive loop, meter dispatch, and the
  **clean-shutdown guarantee** (release on quit/SIGINT/SIGTERM/crash).
- **Checkpoint (manual, on hardware):** connect → keepalive sustains → meters stream → exit
  releases handle → official editor reconnects.

### Phase C — IPC + preload
- `src/main/ipc.ts` + `src/preload/index.ts` — typed, minimal API: `connect`, `disconnect`,
  `status` events, `meters` stream, and one `sendCommand(block, channel, params)` entry that maps
  to `commands.ts`.
- **Checkpoint:** renderer can connect and receive meter events; no Node APIs leak to renderer.

### Phase D — App shell
- Electron `index.ts`, window titled "z3r0 DSP 206", `App.tsx`, `store.ts` (zustand:
  connection, per-channel params, meters), `Meters.tsx`, connect/disconnect UI.
- **Checkpoint:** app launches, shows connection state + live meters.

### Phase E — DSP block UI (parallelizable per block)
- `ChannelStrip.tsx` scaffold, then each block wired to send-on-change:
  GainBlock, MuteBlock, PeqBlock (3 bands + "+"), GeqBlock (In only), CrossoverBlock
  (freq live, slope dropdown disabled), DelayBlock, LimiterBlock (Out), CompressorBlock (Out),
  GateBlock (In), MatrixBlock (Out routing + per-input level).
- **Checkpoint per block:** adjusting the control emits the frame that byte-matches the doc
  (assert in a thin test) and the live-verifiable ones move the hardware.

### Phase F — Presets + polish
- `PresetBar.tsx` — load (`0x20`) with amp-down warning; store (`0x26` name → `0x21` slot) behind
  a confirm dialog.
- electron-builder config, Windows package, icon.
- **Checkpoint:** preset load verified after disconnect; package builds and runs.

## Milestone framing

The real proof-of-life milestone is **Phase 0 → D plus one block (Gain)** — that exercises the
hard part (live session, handle lifecycle, IPC, meters, one round-trip to hardware). The remaining
9 blocks in Phase E are the same pattern repeated: low-risk volume, not new risk.

## Parallel vs sequential

- **Strictly sequential:** A → B → C → D (each depends on the prior).
- **Parallel:** within Phase E, the 10 blocks are independent once the strip scaffold exists —
  build/verify them in any order or batched.
- **Can start early:** electron-builder/packaging config (Phase F) can be stubbed alongside D.

## Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Handle left open → bricks official editor | High | Centralize release in `session.ts`; wire all exit signals in Phase B; manual reconnect test is a hard checkpoint. |
| node-hid native build issues on Windows | High | **Phase 0 spike** proves the build + a real device round-trip before any other work. Hard stop if it fails. |
| Codec drift from the doc | High | Phase A tests byte-match the doc's worked examples; treat the doc as frozen. |
| Preset store overwrites a good slot | Med | Confirm dialog + amp-down warning; store is opt-in per the spec boundary. |
| PEQ max band count unknown | Low | Dynamic "+" UI doesn't assume a max; cap defensively if the device rejects a band. |
| Meters/keepalive timing jitter in Electron | Low | Keepalive runs in main process (not renderer); meters pushed via IPC events. |

## Verification checkpoints (gates between phases)

1. After A — `npm test` + `npm run typecheck` clean.
2. After B — hardware: session sustains, handle releases, editor reconnects.
3. After C — renderer connects + receives meters, no Node leak in renderer.
4. After E (per block) — frame byte-matches doc; live blocks move hardware.
5. After F — preset load verified post-disconnect; package builds.

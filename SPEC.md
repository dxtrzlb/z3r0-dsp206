# Spec: t.racks DSP 206 Controller

> Phase 1 artifact (Specify). Source of truth for the transport/codec layer is
> [DSP206_PROTOCOL.md](DSP206_PROTOCOL.md) — this spec does not re-derive it.

## Objective

A desktop app to control a **t.racks DSP 206** over USB-HID, replacing the official
Windows-only editor with a cross-platform, modern controller.

- **User:** the device owner (audio engineer / installer) tuning a 2-in / 6-out DSP.
- **Why:** the stock editor is Windows-only, clunky, and hides preset state while connected.
- **Success looks like:** open the app, it finds the unit, you adjust any DSP block and hear/see
  the change live, meters move, presets load/store — and on exit the official editor can
  reconnect cleanly (handle released).

### Scope (v1 = full parity)

All blocks from the protocol doc:

| Block | Channels | Command |
|---|---|---|
| Gain | In A/B, Out 1–6 | `0x34` |
| Mute | all | `0x35` |
| PEQ (multi-band) | all | `0x33` |
| GEQ (31-band) | In A/B only | `0x48` |
| Crossover HPF/LPF (freq) | all | `0x32`/`0x31` |
| Delay | all | `0x38` |
| Limiter | Out 1–6 | `0x3f` |
| Compressor | Out 1–6 | `0x30` |
| Gate | In A/B | `0x3e` |
| Matrix routing + per-input level | Out 1–6 | `0x3a` / `0x41` |
| Presets (load/store/name) | — | `0x20`/`0x21`/`0x26` |
| Live meters | In A/B, Out 1–6 | `0x40` response |

**Out of scope for v1:** crossover **slope** (the one OPEN item — needs a store/recall capture;
frequency works live, slope deferred to v2). Multi-device. Preset file import/export.

## Tech Stack

- **Electron** (main process owns the single USB-HID handle; mutual-exclusion lifecycle).
- **TypeScript** throughout.
- **node-hid** for USB-HID transport (VID `0x0168` / PID `0x0821`).
- **React** in the renderer (channel-strip UI).
- **Vite / electron-vite** for build + HMR.
- **Vitest** for unit tests.
- **Zustand** for renderer state (lightweight; pending dependency approval).

## Commands

```
Install: npm install
Dev:     npm run dev          # electron-vite dev, HMR renderer
Build:   npm run build        # type-check + bundle main/preload/renderer
Package: npm run package      # electron-builder, Windows target first
Test:    npm test             # vitest run
Lint:    npm run lint         # eslint --fix
Types:   npm run typecheck    # tsc --noEmit
```

## Project Structure

```
src/
  main/                  → Electron main process
    index.ts             → app lifecycle, window, clean shutdown (release HID)
    device/
      protocol.ts        → checksum, buildFrame + all §5 codecs (pure, fully tested)
      commands.ts        → high-level builders: setGain, setMute, setPeqBand, …
      meters.ts          → decodeFloat16, parseMeters (§7)
      hid.ts             → open/close device, write 65-byte report, subscribe IN frames
      session.ts         → handshake + 130 ms keepalive loop + lifecycle/guards
    ipc.ts               → IPC handlers bridging renderer ⇄ device
  preload/
    index.ts             → contextBridge: typed, minimal device API
  renderer/
    index.html
    main.tsx
    App.tsx
    store.ts             → zustand: connection state, per-channel params, meters
    components/
      ChannelStrip.tsx   → one strip per channel, collapsible blocks
      Meters.tsx         → live meter bars (In A/B, Out 1–6)
      PresetBar.tsx      → load / store / name
      blocks/            → GainBlock, MuteBlock, PeqBlock, GeqBlock, CrossoverBlock,
                           DelayBlock, LimiterBlock, CompressorBlock, GateBlock, MatrixBlock
test/
  protocol.test.ts       → byte-verified codec/frame tests (the 25 from the doc + meters)
DSP206_PROTOCOL.md       → transport/codec reference (source of truth)
SPEC.md                  → this file
```

## Code Style

Pure, testable codec functions in `protocol.ts`; side effects isolated to `hid.ts`/`session.ts`.
Little-endian + clamp at every numeric boundary, exactly as the protocol doc prescribes.

```ts
// protocol.ts — pure, no I/O. Mirrors DSP206_PROTOCOL.md §2/§5 verbatim.
export const CH = { inA: 0, inB: 1, out1: 2, out2: 3, out3: 4, out4: 5, out5: 6, out6: 7 } as const;

export function checksum(payload: number[]): number {
  return payload.reduce((acc, b) => acc ^ b, 1) & 0xff;
}

export function buildFrame(cmd: number, data: number[] = []): number[] {
  const payload = [0x00, 0x01, 1 + data.length, cmd, ...data];
  return [0x10, 0x02, ...payload, 0x10, 0x03, checksum(payload)];
}

const u16le = (v: number): [number, number] => [v & 0xff, (v >> 8) & 0xff];

// commands.ts — composes codecs + buildFrame into device-ready frames.
export function setGain(ch: number, db: number): number[] {
  return buildFrame(0x34, [ch, ...u16le(gainValueFromDb(db))]);
}
```

- `camelCase` functions, `SCREAMING_SNAKE` consts for protocol constants.
- No comments except where the protocol has a non-obvious gotcha (e.g. gate threshold index 7,
  delay clamp wrap). Keep them sparse.
- Validate/clamp only at the boundary (codec input), never deep in the UI.

## Testing Strategy

- **Vitest**, tests in `test/`.
- **Unit (priority):** every codec and `buildFrame` byte-checked against the doc's worked
  examples — e.g. keepalive → `10 02 00 01 01 40 10 03 40`; Out 1 In A −6 dB matrix → `0x00DC`;
  gate threshold at index 7; delay ≥683 ms clamps (no wrap). This is the safety net for full parity.
- **Meters:** `decodeFloat16` / `parseMeters` against known group layout `[0,1,4,5,6,7,8,9]`.
- **No hardware in CI:** `hid.ts`/`session.ts` are thin and manually verified against the unit;
  protocol/meters/commands are the tested core.
- **Coverage target:** 100% of `protocol.ts` + `meters.ts` + `commands.ts`.

## Boundaries

- **Always:** clamp + little-endian at codec boundaries; release the HID handle on every exit
  path (quit / SIGINT / SIGTERM / crash); run `npm test` before declaring a block done; keep
  codecs pure and matching the protocol doc byte-for-byte.
- **Ask first:** adding any npm dependency (zustand, electron-builder, etc.); changing a verified
  encoding; anything that writes to the device's preset store (`0x21`) during testing.
- **Never:** ship a path that leaves the handle open (bricks the official editor at
  "uploading 0%"); load/store a preset without a guard/confirm (replaces entire config — amp-down
  warning); invent encodings for the OPEN slope item; commit without being asked.

## Success Criteria

1. App auto-detects VID `0x0168`/PID `0x0821`, opens it, shows "connected".
2. Handshake + 130 ms keepalive sustain a live session; meters update continuously.
3. Each block in the scope table produces a frame that **byte-matches** the protocol doc and
   takes effect on hardware (live-verifiable ones confirmed on the unit).
4. Preset load changes the active preset (verified after disconnect, since the panel hides it
   while connected).
5. On exit the handle is released and the official editor reconnects without hanging.
6. `npm test` green; `npm run typecheck` clean.

## Resolved Decisions

1. **Crossover slope** — deferred. UI shows the slope dropdown **disabled** (visible but inert,
   tooltip "v2"). Frequency control is live.
2. **PEQ bands** — UI shows **3 bands by default** with a **"+" to add more**; band count is
   dynamic per channel (band index sent as the 0-based value in `0x33`).
3. **Preset store/name** — **wired into the v1 UI** (`0x26` name then `0x21` store, per the doc).
   Guarded with an amp-down/confirm dialog since it overwrites a slot.
4. **App identity** — **"z3r0 DSP 206"** (product name, window title, packaging).

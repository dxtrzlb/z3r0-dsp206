# t.racks DSP 206 — Complete USB-HID Control Reference

Everything needed to control a **t.racks DSP 206** (Thomann) over USB, reverse-engineered
from the official Windows editor and verified byte-for-byte against hardware. A new
controller app can be built from this file alone — no editor re-capture required.

> Calibration dates and verification notes are kept inline so you can tell what's
> hardware-proven vs. inferred. Everything marked **VERIFIED** was confirmed against the
> real unit; items marked **OPEN** still need a capture.

---

## 1. Device identity & transport

| Property | Value |
|---|---|
| Connection | USB **HID** (no driver needed on macOS/Linux/Windows) |
| Vendor ID (VID) | `0x0168` |
| Product ID (PID) | `0x0821` |
| Product string | reports as `Dsp Process` |
| Interrupt OUT (commands) | endpoint `0x02` |
| Interrupt IN (responses) | endpoint `0x81` |
| Report size | fixed **64 bytes**, frame at the start, rest is `00` padding |
| Report ID | none — prepend a leading `0x00` byte on write |

It does **NOT** use the documented `7B 7D` RS-232 protocol over USB. Over USB it speaks the
`10 02 … 10 03 [chk]` framing — the same family as the open-source `Aeternitaas/dsp-408-ui`
project.

**Mutual exclusion:** only one program can own the USB handle. The official editor and any
custom controller are mutually exclusive. Always release the handle on exit (SIGINT/SIGTERM/
crash) or the editor will hang at "uploading parameters 0%".

---

## 2. Frame format

```
10 02  00 01  [LEN]  [CMD]  [DATA...]  10 03  [CHK]
└─┬─┘  └─┬─┘  └─┬─┘  └─┬─┘  └───┬───┘  └─┬─┘  └─┬─┘
start  addr   len   cmd    data       end   checksum
```

- `10 02` — start of frame
- `00 01` — device address field (always this default)
- `LEN`   — `1 + (number of DATA bytes)` — i.e. it counts CMD plus all DATA bytes
- `CMD`   — command/opcode byte (see §4)
- `DATA`  — command payload
- `10 03` — end of frame
- `CHK`   — **XOR checksum, seed `1`, over every byte between `10 02` and `10 03`** (that is,
  over `00 01 LEN CMD DATA...`). Result masked to a byte.

### Reference encoders (TypeScript)

```ts
// XOR checksum: seed 1, over the payload bytes (everything between 10 02 and 10 03).
function checksum(payload: number[]): number {
  return payload.reduce((acc, b) => acc ^ b, 1) & 0xff;
}

// Build a full command frame from a command byte and its data bytes.
function buildFrame(cmd: number, data: number[] = []): number[] {
  const payload = [0x00, 0x01, 1 + data.length, cmd, ...data];
  return [0x10, 0x02, ...payload, 0x10, 0x03, checksum(payload)];
}
```

**Worked example** — keepalive (`0x40`, no data):
`payload = [00 01 01 40]`, `chk = 1 ^ 00 ^ 01 ^ 01 ^ 40 = 0x41`
(the two `01` bytes cancel, so it reduces to `1 ^ 0x40`)
→ frame = `10 02 00 01 01 40 10 03 41`.

---

## 3. Session / handshake (REQUIRED)

One-shot writes without a live session do **not** reliably apply. To control the unit:

1. **Open** the HID device (VID/PID above).
2. **Send the handshake** once to enter remote-control mode:
   ```
   10 02 00 01 01 10 10 03 11
   ```
   (command `0x10`; this is what the editor sends on connect.)
3. **Start a keepalive loop**: send the keepalive frame every **~130 ms**:
   ```
   10 02 00 01 01 40 10 03 41
   ```
   This both keeps the session alive and polls the meters (the response carries meter data).
4. Send parameter commands (§4) at any time while the loop runs.
5. **On exit**, stop the loop and close the handle so the editor can reconnect.

Notes:
- While "PC connected" shows on the unit's screen, the front panel **hides the preset
  number** — verify preset/state changes only *after* disconnecting.
- Send each frame padded to a 64-byte output report with a leading `0x00` report-id byte:
  `write([0x00, ...frame, 0x00 × padding])` to total 65 bytes (1 report-id + 64 payload).

---

## 4. Command map

Channel byte (unified, used by gain/mute/PEQ/crossover/delay/limiter/comp/gate):

| Channel | Byte |
|---|---|
| In A | `0` |
| In B | `1` |
| Out 1 | `2` |
| Out 2 | `3` |
| Out 3 | `4` |
| Out 4 | `5` |
| Out 5 | `6` |
| Out 6 | `7` |

| Function | CMD | Data layout | Status |
|---|---|---|---|
| Gain | `0x34` | `[ch, val_lo, val_hi]` | VERIFIED |
| Mute | `0x35` | `[ch, 0/1]` | VERIFIED |
| Polarity invert | `0x36` | `[ch, 0/1]` (Normal=0, Inverse=1) | VERIFIED |
| Input signal generator | `0x39` | `[code, param]` — analog=0, sine=1(+freq idx), pink=2, white=3 | pink/white VERIFIED; sine freq table OPEN |
| PEQ band | `0x33` | `[ch, band, gain, 00, f_lo, f_hi, q, type, bypass]` | VERIFIED |
| Crossover HPF | `0x32` | `[ch, f_lo, f_hi, slope]` | freq VERIFIED; slope no-op |
| Crossover LPF | `0x31` | `[ch, f_lo, f_hi, slope]` | freq VERIFIED; slope no-op |
| Delay | `0x38` | `[ch, s_lo, s_hi]` (samples@96k) | VERIFIED |
| Limiter | `0x3f` | `[ch, atk_lo, atk_hi, rel_lo, rel_hi, 00, 00, thr, 00]` | VERIFIED |
| Compressor | `0x30` | `[ch, ratio, 00, atk_lo, atk_hi, rel_lo, rel_hi, knee, 00, thr, 00]` | VERIFIED (outputs) |
| Gate | `0x3e` | `[ch, atk_lo, atk_hi, rel_lo, rel_hi, hold_lo, hold_hi, thr, 00]` | VERIFIED (inputs) |
| GEQ (31-band, inputs) | `0x48` | `[ch, band, val, 00]` | VERIFIED |
| Matrix routing | `0x3a` | `[outCh, inMask]` | VERIFIED |
| Matrix in-level | `0x41` | `[outCh, inIdx, lvl_lo, lvl_hi]` | VERIFIED |
| Load preset | `0x20` | `[presetNum]` | VERIFIED |
| Store preset | `0x21` | `[slot]` | byte-tested |
| Preset name | `0x26` | `[ascii…]` (7-bit) | byte-tested |
| Keepalive / meters | `0x40` | `[]` | VERIFIED |
| Crossover slope | `0x27`/`0x29`? | see §6 | **OPEN** |

All multi-byte numeric fields are **little-endian** (low byte first).

---

## 5. Parameter encodings (codecs)

### 5.1 Gain (`0x34`) — two-segment curve

16-bit value, little-endian. Range roughly −60…+20 dB.

```ts
function gainValueFromDb(db: number): number {
  const v = db <= -20 ? Math.round((db + 60) * 2)      // coarse: 0.5 dB/step
                      : Math.round(80 + (db + 20) * 10); // fine:   0.1 dB/step
  return Math.max(0, Math.min(0xffff, v));               // clamp — never underflow/wrap
}
function gainDbFromValue(v: number): number {
  return v <= 80 ? -60 + v * 0.5 : -20 + (v - 80) / 10;
}
```

### 5.2 Mute (`0x35`)

`[ch, 0x01]` = muted, `[ch, 0x00]` = unmuted.

### 5.3 Delay (`0x38`) — samples @ 96 kHz

```ts
const SAMPLE_RATE = 96000;
function delaySamplesFromMs(ms: number): number {
  return Math.max(0, Math.min(0xffff, Math.round((ms * SAMPLE_RATE) / 1000)));
}
function delayMsFromSamples(s: number): number { return (s * 1000) / SAMPLE_RATE; }
```
Max ≈ 682 ms (16-bit). **Clamp** — without it, ≥683 ms wraps to ~0.34 ms.
Out 1's delay channel byte = **2** (the standard channel map).

### 5.4 Frequency raw ↔ Hz (log scale) — CALIBRATED 2026-06-16

The 206 uses **300** log steps (NOT the dsp-408 reference's 1000) over 19.70…20160 Hz.
Verified: 977.2 Hz→169, 1000 Hz→170, 14250 Hz→285. Used for both PEQ and crossover freq.

```ts
const FREQ_MIN = 19.70, FREQ_MAX = 20160.0, FREQ_STEPS = 300;
function hzToRaw(hz: number): number {
  if (hz <= FREQ_MIN) return 0;
  if (hz >= FREQ_MAX) return FREQ_STEPS;
  return Math.round((Math.log(hz / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN)) * FREQ_STEPS);
}
function rawToHz(raw: number): number {
  if (raw <= 0) return FREQ_MIN;
  if (raw >= FREQ_STEPS) return FREQ_MAX;
  return FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, raw / FREQ_STEPS);
}
```

### 5.5 Q raw ↔ value (log scale) — CALIBRATED 2026-06-16

The 206 uses **100** steps (NOT the dsp-408's 255) over Q 0.40…128.
Verified: Q 2.0→28, Q 3.0→35.

```ts
const Q_STEPS = 100;
function qToRaw(q: number): number {
  if (q <= 0.40) return 0;
  if (q >= 128) return Q_STEPS;
  return Math.round((Math.log(q / 0.40) / Math.log(320)) * Q_STEPS);
}
function rawToQ(raw: number): number {
  if (raw <= 0) return 0.40;
  if (raw >= Q_STEPS) return 128;
  return 0.40 * Math.pow(320, raw / Q_STEPS);
}
```

### 5.6 PEQ band (`0x33`)

```
[ch, band, gain, 00, f_lo, f_hi, q, type, bypass]
```
- `band` — band index (0-based)
- `gain` — `round(dB*10 + 120)` clamped 0…240 (−12…+12 dB, 0.1 dB steps)
- `f_lo/f_hi` — 16-bit freq raw (§5.4)
- `q` — Q raw byte (§5.5)
- `type` — PEQ type index (below)
- `bypass` — `0x01` bypassed, `0x00` active

PEQ type byte (index into):
`["Peak", "Low Shelf", "High Shelf", "LP 6", "LP 12", "HP 6", "HP 12", "AllPass1", "AllPass2"]`

```ts
function peqGainValueFromDb(db: number): number {
  return Math.max(0, Math.min(240, Math.round(db * 10 + 120)));
}
```

### 5.7 Crossover HPF (`0x32`) / LPF (`0x31`)

```
[ch, f_lo, f_hi, slope]
```
- Frequency (`f_lo/f_hi`, 16-bit raw §5.4) is **live and works**.
- The `slope` byte here is **ignored by the device** (stays `0x00`) — a no-op. See §6 for
  how slope actually reaches the unit.

### 5.8 Dynamics — shared calibration (limiter / comp / gate) — CALIBRATED 2026-06-16

**Threshold** (single byte, shared by all three blocks):
`byte = 2·dB + 180` → `dB = (byte − 180) / 2`. Verified −40/−30/−20/−6/0/+20 dB.

**Attack / Release / Hold** (16-bit LE): `raw = ms − 1` → `ms = raw + 1`.
Verified 1→0, 10→9, 50→49, 100→99, 500→499, 1000→999.

```ts
function dynThreshByteFromDb(db: number) { return Math.max(0, Math.min(255, Math.round(db*2+180))); }
function dynThreshDbFromByte(b: number)  { return (b - 180) / 2; }
function dynTimeRawFromMs(ms: number)    { return Math.max(0, Math.min(0xffff, Math.round(ms-1))); }
function dynTimeMsFromRaw(raw: number)   { return raw + 1; }
```

### 5.9 Limiter (`0x3f`) — on outputs

```
[ch, atk_lo, atk_hi, rel_lo, rel_hi, 00, 00, thr, 00]
```
- attack/release: 16-bit raw = ms−1; threshold: byte = 2·dB+180.
- Defaults: attack `0x0031` (50 ms), release `0x01f3` (500 ms).

### 5.10 Compressor (`0x30`) — on outputs

```
[ch, ratio, 00, atk_lo, atk_hi, rel_lo, rel_hi, knee, 00, thr, 00]
```
- `ratio` — ladder index 0…15 (below)
- attack/release — ms−1 (16-bit); `knee` — byte = dB (0→0, 6→6, 12→12); `thr` — 2·dB+180

Ratio ladder (index → ratio), VERIFIED anchors 0/1/5/9/13/14/15:
```
["1:1.0","1:1.1","1:1.2","1:1.4","1:1.6","1:2.0","1:2.5","1:3.0",
 "1:3.5","1:4.0","1:5.0","1:6.0","1:8.0","1:10","1:20","Lmt"]
```

### 5.11 Gate (`0x3e`) — on inputs

```
[ch, atk_lo, atk_hi, rel_lo, rel_hi, hold_lo, hold_hi, thr, 00]
```
- **Important (bug history):** threshold is the single byte at **index 7**, NOT a 16-bit
  value at indices 1–2. attack/release/hold are the three 16-bit ms−1 values.
- threshold byte = 2·dB+180; atk/rel/hold = ms−1.

### 5.12 GEQ (`0x48`) — 31-band graphic EQ on inputs

```
[ch, band, val, 00]
```
- `ch` — In A = 0, In B = 1
- `band` — 0…30
- `val` — `round(dB*10 + 120)` clamped 0…240 → dB = (val−120)/10 (−12…+12, 0.1 dB steps)
- Verified: band 0 +8.1 dB → `0xc9`, band 5 −8.1 dB → `0x27`.

### 5.13 Matrix routing (`0x3a`)

```
[outCh, inMask]
```
- `outCh` — uses the gain/mute channel map (Out 1 = 2 … Out 6 = 7)
- `inMask` — bitmask: In A = `0x01`, In B = `0x02`, both = `0x03`
- Verified: Out 1 both → `02 03`; Out 1 In A only → `02 01`.

### 5.14 Matrix per-input level (`0x41`)

```
[outCh, inIdx, lvl_lo, lvl_hi]
```
- `outCh` — gain channel map (Out 1 = 2 … Out 6 = 7); `inIdx` — In A = 0, In B = 1
- 16-bit level uses the **same encoding as gain** (§5.1). Verified: Out 1 In A −6 dB → `0x00DC`.

### 5.15 Presets

- **Load (`0x20`)**: `[presetNum]`. `0` = factory F00; `1…31` = user U01…U31. Replaces the
  **entire** configuration — turn the amp down first. Verified live (001→002 on the panel).
- **Store (`0x21`)**: `[slot]`, slot 1…31. The editor sends the **name (`0x26`) first**, then
  store. Byte-tested (the editor's custom dialog controls couldn't be driven for a live test).
- **Name (`0x26`)**: ASCII bytes, 7-bit masked.

---

## 6. Crossover slope — the one OPEN item

The slope byte in `0x32`/`0x31` is a no-op (§5.7). Slope does **not** appear to be a live
per-parameter command:

- Verified with a control gate (2026-06-17): in a healthy capture where a PEQ-gain change *was*
  recorded (proving the editor was pushing live), changing the HP/LP slope dropdowns and
  toggling Bypass sent **zero** commands. The earlier `0x27` (HP) / `0x29` (LP) frames seen
  during slope changes were **tab-load enumeration**, not a set-command.
- The owner confirms slope **is** settable manually → it must reach the unit via the **full
  preset-config push (store/recall)**, not live editing.

**RESOLVED (2026-06-19, clean single-instance capture):** slope **is** the 4th data byte of the
existing HPF `0x32` / LPF `0x31` frame — `[ch, f_lo, f_hi, slope]`. The editor sends `slope = 0x00`
on live edits (the no-op), but sends the **real index during the full-config push (Recall/Store)**.
Captured: `10 02 00 01 05 32 02 00 00 00` (HPF Out1 slope 0 = BW-6), `…32 02 00 00 01` (BL-6),
`10 02 00 01 05 31 02 2c 01 14` (LPF Out1 slope `0x14` = 20 = LK-48). So the slope ladder is a
0-based index: **BW-6=0, BL-6=1, BW-12=2, BL-12=3, LK-12=4, … LK-48=20** (BW/BL/LK × 6..48 dB/oct;
LK at the 12/24/36/48 steps). Our `setHpf`/`setLpf` already carry slope in this byte — pass the
index instead of 0. **Still to verify:** whether the device honors a *live* `0x32`/`0x31` with a
the exact full 21-entry label table (only the anchors above are byte-confirmed).

**Slope IS live-settable + Bypass is not a command (confirmed 2026-06-19):** toggling HPF/LPF
**Bypass** emits a live `0x32`/`0x31` frame carrying the real slope byte — e.g. HPF bypass-off →
`32 02 00 00 0a` (slope 10), bypass-on → `32 02 00 00 00`; LPF → `31 02 2c 01 14` (raw 300 = max
freq). So (a) the device honours a nonzero slope byte **live** (no full push needed — send
`setHpf(ch, hz, slopeIndex)`), and (b) Bypass is implemented purely by pushing the frequency to
the extreme (HPF → raw 0 = 19.7 Hz min; LPF → raw 300 = 20160 Hz max), which is exactly what the
app's on/off toggle already does — **no separate bypass opcode exists.** Slope anchors so far:
0=BW-6, 1=BL-6, 7=BW-24, 20=LK-48 (full ladder still to enumerate).

**Slope ladder — COMPLETE (owner-confirmed 2026-06-19).** 20 entries, 0-based index = the slope
byte. BW=Butterworth, BL=Bessel, LK=Linkwitz-Riley (LK only at 12/24/36/48):

```
0 BW-6   1 BL-6   2 BW-12  3 BL-12  4 LK-12  5 BW-18  6 BL-18  7 BW-24  8 BL-24  9 LK-24
10 BW-30 11 BL-30 12 BW-36 13 BL-36 14 LK-36 15 BW-42 16 BL-42 17 BW-48 18 BL-48 19 LK-48
```

Byte-confirmed via live captures: BW-6=0, BL-6=1, BW-24=7, BW-30=10, BL-30=11 (all fit). The
Slope dropdown only shows ~8 rows — scroll to see all 20. **Slope transmits live only when the
band's Bypass is OFF** (a slope change while bypassed sends nothing). A **bypassed band** sends the
crossover frame with freq at the extreme (HPF→raw 0/19.7 Hz, LPF→raw 300/20160 Hz) and a slope
**sentinel of 20** (one past the top) — e.g. the captured `31 02 2c 01 14` (LPF bypassed) — so byte
20 = "off", not a ladder entry.

Slope option ladder (names from dsp-408, VERIFY on the 206):
```
BW 6=0, BW 12=1, BW 18=2, BW 24=3, BW 36=5, BW 48=7, LR 12=8, LR 24=9, LR 48=11
```

---

## 7. Meters (read path)

The keepalive (`0x40`) **response** carries meter levels. A response frame is identifiable as
`10 02 01 00 … 40 …` (`frame[2]==0x01 && frame[5]==0x40`).

- From **offset 6**, meters are **3 bytes per group**: float16 LE level + a peak byte, for
  **12 groups** in the full 4-in/8-out DSP 408 layout:
  `[In A, In B, In C, In D, Out 1…Out 8]`.
- The 206's real channels are groups `[0, 1, 4, 5, 6, 7, 8, 9]`. The nonexistent In C/D
  (groups 2,3) and Out 7/8 (groups 10,11) are always `00 00 00`.
- **Display channel → meter group map:** `[0, 1, 4, 5, 6, 7, 8, 9]`
  (In A, In B, Out 1…Out 6).
- Meters are tapped **post-routing but pre-output-mute**: muting an output does not change its
  meter; muting an input drops the meters of the outputs it routes to. (Verified: mute In A →
  the routed Out meter dropped ~54 dB.)

```ts
function decodeFloat16(low: number, high: number): number {
  const v = low | (high << 8);
  const sign = (v >> 15) & 1, exp = (v >> 10) & 0x1f, mant = v & 0x3ff;
  let r: number;
  if (exp === 0) r = (mant / 1024) * 2 ** -14;
  else if (exp === 31) r = mant === 0 ? Infinity : NaN;
  else r = (1 + mant / 1024) * 2 ** (exp - 15);
  return sign ? -r : r;
}

function parseMeters(frame: number[], groups = 12): number[] {
  const out: number[] = [];
  for (let g = 0; g < groups; g++) {
    const o = 6 + g * 3;
    if (o + 1 >= frame.length) break;
    const v = decodeFloat16(frame[o], frame[o + 1]);
    out.push(Number.isFinite(v) ? v : 0);
  }
  return out;
}
```

---

## 8. Minimal end-to-end recipe

1. Find HID device VID `0x0168` / PID `0x0821`; open it.
2. Subscribe to input reports; parse `10 02 … 10 03` frames; decode meters from `0x40`
   responses (§7).
3. Send the handshake `10 02 00 01 01 10 10 03 11`.
4. Start a 130 ms keepalive loop (`buildFrame(0x40, [])`).
5. Send parameter frames via `buildFrame(cmd, data)` using the codecs in §5.
6. On exit: stop the loop, close the handle.

Every numeric value: build with the matching codec, emit little-endian, clamp to field width.
All frames here are byte-verified in `test/protocol.test.ts` (25 tests) and confirmed against
the real unit except where marked **OPEN**.

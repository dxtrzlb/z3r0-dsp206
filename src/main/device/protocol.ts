// Pure transport + codec layer. Mirrors DSP206_PROTOCOL.md §2 and §5 byte-for-byte.
// No I/O here — everything is deterministic and fully unit-tested.

export const CH = {
  inA: 0,
  inB: 1,
  out1: 2,
  out2: 3,
  out3: 4,
  out4: 5,
  out5: 6,
  out6: 7,
} as const;

export const CMD = {
  handshake: 0x10,
  keepalive: 0x40,
  loadPreset: 0x20,
  storePreset: 0x21,
  presetName: 0x26,
  gain: 0x34,
  mute: 0x35,
  polarity: 0x36,
  signalGen: 0x39,
  peq: 0x33,
  geq: 0x48,
  hpf: 0x32,
  lpf: 0x31,
  delay: 0x38,
  limiter: 0x3f,
  compressor: 0x30,
  gate: 0x3e,
  matrixRoute: 0x3a,
  matrixLevel: 0x41,
} as const;

export const PEQ_TYPES = [
  'Peak',
  'Low Shelf',
  'High Shelf',
  'LP 6',
  'LP 12',
  'HP 6',
  'HP 12',
  'AllPass1',
  'AllPass2',
] as const;

export const RATIO_LADDER = [
  '1:1.0',
  '1:1.1',
  '1:1.2',
  '1:1.4',
  '1:1.6',
  '1:2.0',
  '1:2.5',
  '1:3.0',
  '1:3.5',
  '1:4.0',
  '1:5.0',
  '1:6.0',
  '1:8.0',
  '1:10',
  '1:20',
  'Lmt',
] as const;

// Slope ladder names from dsp-408 (§6). Not yet live on the 206 — UI shows it disabled.
export const SLOPE_LADDER: { label: string; value: number }[] = [
  { label: 'BW 6', value: 0 },
  { label: 'BW 12', value: 1 },
  { label: 'BW 18', value: 2 },
  { label: 'BW 24', value: 3 },
  { label: 'BW 36', value: 5 },
  { label: 'BW 48', value: 7 },
  { label: 'LR 12', value: 8 },
  { label: 'LR 24', value: 9 },
  { label: 'LR 48', value: 11 },
];

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const u16le = (v: number): [number, number] => [v & 0xff, (v >> 8) & 0xff];

// §2 — XOR checksum, seed 1, over the bytes between 10 02 and 10 03.
export function checksum(payload: number[]): number {
  return payload.reduce((acc, b) => acc ^ b, 1) & 0xff;
}

// §2 — build a full frame from a command byte and its data bytes.
export function buildFrame(cmd: number, data: number[] = []): number[] {
  const payload = [0x00, 0x01, 1 + data.length, cmd, ...data];
  return [0x10, 0x02, ...payload, 0x10, 0x03, checksum(payload)];
}

// §5.1 — Gain, two-segment curve, 16-bit LE. ~ -60..+20 dB.
export function gainValueFromDb(db: number): number {
  const v = db <= -20 ? Math.round((db + 60) * 2) : Math.round(80 + (db + 20) * 10);
  return clamp(v, 0, 0xffff);
}
export function gainDbFromValue(v: number): number {
  return v <= 80 ? -60 + v * 0.5 : -20 + (v - 80) / 10;
}

// §5.3 — Delay, samples @ 96 kHz. Clamp or ≥683 ms wraps to ~0.34 ms.
export const SAMPLE_RATE = 96000;
export function delaySamplesFromMs(ms: number): number {
  return clamp(Math.round((ms * SAMPLE_RATE) / 1000), 0, 0xffff);
}
export function delayMsFromSamples(s: number): number {
  return (s * 1000) / SAMPLE_RATE;
}

// §5.4 — Frequency raw ↔ Hz, log scale, 300 steps. CALIBRATED 2026-06-16.
export const FREQ_MIN = 19.7;
export const FREQ_MAX = 20160.0;
export const FREQ_STEPS = 300;
export function hzToRaw(hz: number): number {
  if (hz <= FREQ_MIN) return 0;
  if (hz >= FREQ_MAX) return FREQ_STEPS;
  return Math.round((Math.log(hz / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN)) * FREQ_STEPS);
}
export function rawToHz(raw: number): number {
  if (raw <= 0) return FREQ_MIN;
  if (raw >= FREQ_STEPS) return FREQ_MAX;
  return FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, raw / FREQ_STEPS);
}

// §5.5 — Q raw ↔ value, log scale, 100 steps. CALIBRATED 2026-06-16.
export const Q_STEPS = 100;
export function qToRaw(q: number): number {
  if (q <= 0.4) return 0;
  if (q >= 128) return Q_STEPS;
  return Math.round((Math.log(q / 0.4) / Math.log(320)) * Q_STEPS);
}
export function rawToQ(raw: number): number {
  if (raw <= 0) return 0.4;
  if (raw >= Q_STEPS) return 128;
  return 0.4 * Math.pow(320, raw / Q_STEPS);
}

// §5.6 / §5.12 — PEQ and GEQ band gain byte: round(dB*10 + 120) clamped 0..240 (-12..+12 dB).
export function bandGainValueFromDb(db: number): number {
  return clamp(Math.round(db * 10 + 120), 0, 240);
}
export function bandGainDbFromValue(v: number): number {
  return (v - 120) / 10;
}

// §5.8 — Dynamics, shared by limiter/comp/gate.
export function dynThreshByteFromDb(db: number): number {
  return clamp(Math.round(db * 2 + 180), 0, 255);
}
export function dynThreshDbFromByte(b: number): number {
  return (b - 180) / 2;
}
export function dynTimeRawFromMs(ms: number): number {
  return clamp(Math.round(ms - 1), 0, 0xffff);
}
export function dynTimeMsFromRaw(raw: number): number {
  return raw + 1;
}

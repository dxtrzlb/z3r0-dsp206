// EQ + crossover magnitude response, for drawing the frequency graph. Pure; shared by the
// desktop graph and (later) the iPad. RBJ biquad magnitudes for PEQ peak/shelf bands; Nth-order
// Butterworth approximations for LP/HP band types and the crossover (the BW/BL/LK distinction is
// not modelled — close enough for a control-surface graph).
import type { PeqBand } from './state';

const FS = 96000;

export interface SlopeEntry {
  label: string;
  dbPerOct: number;
}

// 0-based index = the slope byte sent in the HPF/LPF frame (DSP206_PROTOCOL.md §6).
export const SLOPE_LADDER: SlopeEntry[] = [
  { label: 'BW-6', dbPerOct: 6 },
  { label: 'BL-6', dbPerOct: 6 },
  { label: 'BW-12', dbPerOct: 12 },
  { label: 'BL-12', dbPerOct: 12 },
  { label: 'LK-12', dbPerOct: 12 },
  { label: 'BW-18', dbPerOct: 18 },
  { label: 'BL-18', dbPerOct: 18 },
  { label: 'BW-24', dbPerOct: 24 },
  { label: 'BL-24', dbPerOct: 24 },
  { label: 'LK-24', dbPerOct: 24 },
  { label: 'BW-30', dbPerOct: 30 },
  { label: 'BL-30', dbPerOct: 30 },
  { label: 'BW-36', dbPerOct: 36 },
  { label: 'BL-36', dbPerOct: 36 },
  { label: 'LK-36', dbPerOct: 36 },
  { label: 'BW-42', dbPerOct: 42 },
  { label: 'BL-42', dbPerOct: 42 },
  { label: 'BW-48', dbPerOct: 48 },
  { label: 'BL-48', dbPerOct: 48 },
  { label: 'LK-48', dbPerOct: 48 },
];

const slopeOrder = (idx: number): number =>
  Math.max(1, Math.round((SLOPE_LADDER[idx] ?? SLOPE_LADDER[9]).dbPerOct / 6));

// Log-frequency display range and the position mapping used by the graph (0..1 across 20 Hz–20 kHz).
export const DISP_MIN = 20;
export const DISP_MAX = 20000;
export const freqToPos = (hz: number): number =>
  Math.log10(hz / DISP_MIN) / Math.log10(DISP_MAX / DISP_MIN);
export const posToFreq = (pos: number): number =>
  DISP_MIN * Math.pow(DISP_MAX / DISP_MIN, Math.min(1, Math.max(0, pos)));
export const logFreqs = (n: number): number[] =>
  Array.from({ length: n }, (_, i) => posToFreq(i / (n - 1)));

function biquadDb(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number, f: number): number {
  const w = (2 * Math.PI * f) / FS;
  const cw = Math.cos(w);
  const c2w = Math.cos(2 * w);
  const num = b0 * b0 + b1 * b1 + b2 * b2 + 2 * (b0 * b1 + b1 * b2) * cw + 2 * b0 * b2 * c2w;
  const den = a0 * a0 + a1 * a1 + a2 * a2 + 2 * (a0 * a1 + a1 * a2) * cw + 2 * a0 * a2 * c2w;
  return 10 * Math.log10(num / den);
}

function peakingDb(f0: number, q: number, gainDb: number, f: number): number {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / FS;
  const cw = Math.cos(w0);
  const a = Math.sin(w0) / (2 * q);
  return biquadDb(1 + a * A, -2 * cw, 1 - a * A, 1 + a / A, -2 * cw, 1 - a / A, f);
}

function lowShelfDb(f0: number, q: number, gainDb: number, f: number): number {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / FS;
  const cw = Math.cos(w0);
  const sa = 2 * Math.sqrt(A) * (Math.sin(w0) / (2 * q));
  return biquadDb(
    A * (A + 1 - (A - 1) * cw + sa),
    2 * A * (A - 1 - (A + 1) * cw),
    A * (A + 1 - (A - 1) * cw - sa),
    A + 1 + (A - 1) * cw + sa,
    -2 * (A - 1 + (A + 1) * cw),
    A + 1 + (A - 1) * cw - sa,
    f,
  );
}

function highShelfDb(f0: number, q: number, gainDb: number, f: number): number {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / FS;
  const cw = Math.cos(w0);
  const sa = 2 * Math.sqrt(A) * (Math.sin(w0) / (2 * q));
  return biquadDb(
    A * (A + 1 + (A - 1) * cw + sa),
    -2 * A * (A - 1 + (A + 1) * cw),
    A * (A + 1 + (A - 1) * cw - sa),
    A + 1 - (A - 1) * cw + sa,
    2 * (A - 1 - (A + 1) * cw),
    A + 1 - (A - 1) * cw - sa,
    f,
  );
}

export const lpDb = (fc: number, order: number, f: number): number =>
  -10 * Math.log10(1 + Math.pow(f / fc, 2 * order));
export const hpDb = (fc: number, order: number, f: number): number =>
  -10 * Math.log10(1 + Math.pow(fc / f, 2 * order));

export function peqBandDb(b: PeqBand, f: number): number {
  if (b.bypass) return 0;
  switch (b.type) {
    case 0:
      return peakingDb(b.hz, b.q, b.gainDb, f);
    case 1:
      return lowShelfDb(b.hz, b.q, b.gainDb, f);
    case 2:
      return highShelfDb(b.hz, b.q, b.gainDb, f);
    case 3:
      return lpDb(b.hz, 1, f);
    case 4:
      return lpDb(b.hz, 2, f);
    case 5:
      return hpDb(b.hz, 1, f);
    case 6:
      return hpDb(b.hz, 2, f);
    default:
      return 0; // AllPass — flat magnitude
  }
}

export interface ResponseInput {
  peq: PeqBand[];
  hpf: { hz: number; on: boolean; slope: number };
  lpf: { hz: number; on: boolean; slope: number };
}

export function channelResponseDb(ch: ResponseInput, freqs: number[]): number[] {
  return freqs.map((f) => {
    let db = 0;
    for (const b of ch.peq) db += peqBandDb(b, f);
    if (ch.hpf.on) db += hpDb(ch.hpf.hz, slopeOrder(ch.hpf.slope), f);
    if (ch.lpf.on) db += lpDb(ch.lpf.hz, slopeOrder(ch.lpf.slope), f);
    return db;
  });
}

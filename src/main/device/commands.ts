// High-level command builders. Each returns a device-ready frame (pre report-id/padding).
// Layouts come straight from DSP206_PROTOCOL.md §4/§5.
import {
  CMD,
  buildFrame,
  u16le,
  gainValueFromDb,
  delaySamplesFromMs,
  hzToRaw,
  qToRaw,
  bandGainValueFromDb,
  dynThreshByteFromDb,
  dynTimeRawFromMs,
} from './protocol';

export const handshake = (): number[] => buildFrame(CMD.handshake);
export const keepalive = (): number[] => buildFrame(CMD.keepalive);

export const setGain = (ch: number, db: number): number[] =>
  buildFrame(CMD.gain, [ch, ...u16le(gainValueFromDb(db))]);

export const setMute = (ch: number, muted: boolean): number[] =>
  buildFrame(CMD.mute, [ch, muted ? 1 : 0]);

// §4 — [ch, 0/1]. Polarity invert (Normal = 0, Inverse = 1). Captured from the official editor.
export const setPolarity = (ch: number, inverted: boolean): number[] =>
  buildFrame(CMD.polarity, [ch, inverted ? 1 : 0]);

// §4 — built-in input signal generator. [code, param]. Captured: pink = [2,0], white = [3,0].
// analog = 0 and sine = 1 inferred by elimination; the sine frequency-index table is not yet mapped.
export type InputSignal = 'analog' | 'sine' | 'pink' | 'white';
const SIGNAL_CODE: Record<InputSignal, number> = { analog: 0, sine: 1, pink: 2, white: 3 };
export const setInputSignal = (signal: InputSignal, sineFreqIndex = 0): number[] =>
  buildFrame(CMD.signalGen, [SIGNAL_CODE[signal], signal === 'sine' ? sineFreqIndex : 0]);

// §5.6 — [ch, band, gain, 00, f_lo, f_hi, q, type, bypass]
export interface PeqBand {
  gainDb: number;
  hz: number;
  q: number;
  type: number;
  bypass: boolean;
}
export const setPeqBand = (ch: number, band: number, p: PeqBand): number[] =>
  buildFrame(CMD.peq, [
    ch,
    band,
    bandGainValueFromDb(p.gainDb),
    0x00,
    ...u16le(hzToRaw(p.hz)),
    qToRaw(p.q),
    p.type,
    p.bypass ? 1 : 0,
  ]);

// §5.12 — [ch, band, val, 00]. Inputs only (In A = 0, In B = 1), band 0..30.
export const setGeqBand = (ch: number, band: number, db: number): number[] =>
  buildFrame(CMD.geq, [ch, band, bandGainValueFromDb(db), 0x00]);

// §5.7 — [ch, f_lo, f_hi, slope]. slope is a no-op on the device (kept 0).
export const setHpf = (ch: number, hz: number, slope = 0): number[] =>
  buildFrame(CMD.hpf, [ch, ...u16le(hzToRaw(hz)), slope]);
export const setLpf = (ch: number, hz: number, slope = 0): number[] =>
  buildFrame(CMD.lpf, [ch, ...u16le(hzToRaw(hz)), slope]);

// §5.3 — [ch, s_lo, s_hi]
export const setDelay = (ch: number, ms: number): number[] =>
  buildFrame(CMD.delay, [ch, ...u16le(delaySamplesFromMs(ms))]);

// §5.9 — [ch, atk_lo, atk_hi, rel_lo, rel_hi, 00, 00, thr, 00]
export const setLimiter = (ch: number, attackMs: number, releaseMs: number, threshDb: number): number[] =>
  buildFrame(CMD.limiter, [
    ch,
    ...u16le(dynTimeRawFromMs(attackMs)),
    ...u16le(dynTimeRawFromMs(releaseMs)),
    0x00,
    0x00,
    dynThreshByteFromDb(threshDb),
    0x00,
  ]);

// §5.10 — [ch, ratio, 00, atk_lo, atk_hi, rel_lo, rel_hi, knee, 00, thr, 00]
export const setCompressor = (
  ch: number,
  ratio: number,
  attackMs: number,
  releaseMs: number,
  kneeDb: number,
  threshDb: number,
): number[] =>
  buildFrame(CMD.compressor, [
    ch,
    ratio,
    0x00,
    ...u16le(dynTimeRawFromMs(attackMs)),
    ...u16le(dynTimeRawFromMs(releaseMs)),
    kneeDb,
    0x00,
    dynThreshByteFromDb(threshDb),
    0x00,
  ]);

// §5.11 — [ch, atk_lo, atk_hi, rel_lo, rel_hi, hold_lo, hold_hi, thr, 00]. thr is the byte at index 7.
export const setGate = (
  ch: number,
  attackMs: number,
  releaseMs: number,
  holdMs: number,
  threshDb: number,
): number[] =>
  buildFrame(CMD.gate, [
    ch,
    ...u16le(dynTimeRawFromMs(attackMs)),
    ...u16le(dynTimeRawFromMs(releaseMs)),
    ...u16le(dynTimeRawFromMs(holdMs)),
    dynThreshByteFromDb(threshDb),
    0x00,
  ]);

// §5.13 — [outCh, inMask]. In A = 0x01, In B = 0x02, both = 0x03.
export const setMatrixRoute = (outCh: number, inMask: number): number[] =>
  buildFrame(CMD.matrixRoute, [outCh, inMask & 0x03]);

// §5.14 — [outCh, inIdx, lvl_lo, lvl_hi]. Level uses the gain encoding.
export const setMatrixLevel = (outCh: number, inIdx: number, db: number): number[] =>
  buildFrame(CMD.matrixLevel, [outCh, inIdx, ...u16le(gainValueFromDb(db))]);

// §5.15 — presets.
export const loadPreset = (presetNum: number): number[] => buildFrame(CMD.loadPreset, [presetNum]);
export const storePreset = (slot: number): number[] => buildFrame(CMD.storePreset, [slot]);
export const setPresetName = (name: string): number[] =>
  buildFrame(CMD.presetName, Array.from(name, (c) => c.charCodeAt(0) & 0x7f));

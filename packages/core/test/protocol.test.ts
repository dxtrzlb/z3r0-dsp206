import { describe, it, expect } from 'vitest';
import {
  checksum,
  buildFrame,
  u16le,
  gainValueFromDb,
  gainDbFromValue,
  delaySamplesFromMs,
  delayMsFromSamples,
  hzToRaw,
  rawToHz,
  qToRaw,
  rawToQ,
  bandGainValueFromDb,
  bandGainDbFromValue,
  dynThreshByteFromDb,
  dynThreshDbFromByte,
  dynTimeRawFromMs,
  dynTimeMsFromRaw,
  FREQ_MIN,
  FREQ_MAX,
} from '../src/protocol';
import {
  handshake,
  keepalive,
  setGain,
  setMute,
  setPolarity,
  setInputSignal,
  setPeqBand,
  setGeqBand,
  setHpf,
  setLpf,
  setDelay,
  setLimiter,
  setCompressor,
  setGate,
  setMatrixRoute,
  setMatrixLevel,
  loadPreset,
  storePreset,
  setPresetName,
} from '../src/commands';
import {
  decodeFloat16,
  isMeterFrame,
  parseMeters,
  parseDisplayMeters,
} from '../src/meters';

// payload = bytes between 10 02 and 10 03
const payloadOf = (f: number[]) => f.slice(2, f.length - 3);
const dataOf = (f: number[]) => f.slice(6, f.length - 3);

describe('§2 framing', () => {
  it('checksum: keepalive payload (seed 1; the 01 bytes cancel, 1 ^ 0x40 = 0x41)', () => {
    expect(checksum([0x00, 0x01, 0x01, 0x40])).toBe(0x41);
  });

  it('keepalive frame byte-matches the reference encoder', () => {
    expect(keepalive()).toEqual([0x10, 0x02, 0x00, 0x01, 0x01, 0x40, 0x10, 0x03, 0x41]);
  });

  it('handshake frame byte-matches', () => {
    expect(handshake()).toEqual([0x10, 0x02, 0x00, 0x01, 0x01, 0x10, 0x10, 0x03, 0x11]);
  });

  it('LEN counts CMD + data bytes', () => {
    const f = buildFrame(0x34, [2, 0xdc, 0x00]);
    expect(f[4]).toBe(4);
  });

  it('u16le is little-endian', () => {
    expect(u16le(0x01f3)).toEqual([0xf3, 0x01]);
  });
});

describe('§5.1 gain', () => {
  it('-6 dB → 0x00DC (fine segment)', () => {
    expect(gainValueFromDb(-6)).toBe(0xdc);
  });
  it('coarse segment below -20 dB', () => {
    expect(gainValueFromDb(-60)).toBe(0); // (-60+60)*2
    expect(gainValueFromDb(-40)).toBe(40); // (-40+60)*2
  });
  it('clamps to field width', () => {
    expect(gainValueFromDb(-100)).toBe(0);
    expect(gainValueFromDb(1e6)).toBe(0xffff);
  });
  it('round-trips both segments', () => {
    expect(gainDbFromValue(0)).toBe(-60);
    expect(gainDbFromValue(220)).toBeCloseTo(-6);
  });
});

describe('§5.3 delay', () => {
  it('clamps ≥683 ms instead of wrapping', () => {
    expect(delaySamplesFromMs(683)).toBe(0xffff);
    expect(delaySamplesFromMs(0)).toBe(0);
  });
  it('inverse', () => {
    expect(delayMsFromSamples(96000)).toBe(1000);
  });
});

describe('§5.4 frequency (300 steps, calibrated)', () => {
  it('verified anchors', () => {
    expect(hzToRaw(977.2)).toBe(169);
    expect(hzToRaw(1000)).toBe(170);
    expect(hzToRaw(14250)).toBe(285);
  });
  it('edges', () => {
    expect(hzToRaw(10)).toBe(0);
    expect(hzToRaw(99999)).toBe(300);
    expect(rawToHz(0)).toBe(FREQ_MIN);
    expect(rawToHz(300)).toBe(FREQ_MAX);
    expect(rawToHz(170)).toBeCloseTo(1000, 0);
  });
});

describe('§5.5 Q (100 steps, calibrated)', () => {
  it('verified anchors', () => {
    expect(qToRaw(2.0)).toBe(28);
    expect(qToRaw(3.0)).toBe(35);
  });
  it('edges', () => {
    expect(qToRaw(0.4)).toBe(0);
    expect(qToRaw(200)).toBe(100);
    expect(rawToQ(0)).toBe(0.4);
    expect(rawToQ(100)).toBe(128);
    expect(rawToQ(28)).toBeCloseTo(2.0, 1);
  });
});

describe('§5.6/§5.12 band gain', () => {
  it('clamped -12..+12 dB → 0..240', () => {
    expect(bandGainValueFromDb(0)).toBe(120);
    expect(bandGainValueFromDb(12)).toBe(240);
    expect(bandGainValueFromDb(-12)).toBe(0);
    expect(bandGainValueFromDb(100)).toBe(240);
    expect(bandGainValueFromDb(-100)).toBe(0);
  });
  it('inverse', () => {
    expect(bandGainDbFromValue(201)).toBeCloseTo(8.1);
  });
});

describe('§5.8 dynamics shared calibration', () => {
  it('threshold byte = 2·dB + 180', () => {
    expect(dynThreshByteFromDb(-40)).toBe(100);
    expect(dynThreshByteFromDb(-30)).toBe(120);
    expect(dynThreshByteFromDb(-20)).toBe(140);
    expect(dynThreshByteFromDb(-6)).toBe(168);
    expect(dynThreshByteFromDb(0)).toBe(180);
    expect(dynThreshByteFromDb(20)).toBe(220);
  });
  it('threshold clamps', () => {
    expect(dynThreshByteFromDb(-200)).toBe(0);
    expect(dynThreshByteFromDb(200)).toBe(255);
    expect(dynThreshDbFromByte(168)).toBe(-6);
  });
  it('time raw = ms − 1', () => {
    expect(dynTimeRawFromMs(1)).toBe(0);
    expect(dynTimeRawFromMs(50)).toBe(49);
    expect(dynTimeRawFromMs(500)).toBe(499);
    expect(dynTimeRawFromMs(1000)).toBe(999);
    expect(dynTimeRawFromMs(99999)).toBe(0xffff);
    expect(dynTimeMsFromRaw(49)).toBe(50);
  });
});

describe('command frames byte-match the doc', () => {
  it('setGain', () => {
    expect(setGain(2, -6)).toEqual(buildFrame(0x34, [2, 0xdc, 0x00]));
  });
  it('setMute', () => {
    expect(dataOf(setMute(2, true))).toEqual([2, 1]);
    expect(dataOf(setMute(2, false))).toEqual([2, 0]);
  });
  it('setPolarity — captured Out3 Normal = 10 02 00 01 03 36 04 00 10 03 31', () => {
    expect(setPolarity(4, false)).toEqual(buildFrame(0x36, [4, 0]));
    expect(setPolarity(4, false)).toEqual([0x10, 0x02, 0x00, 0x01, 0x03, 0x36, 0x04, 0x00, 0x10, 0x03, 0x31]);
    expect(dataOf(setPolarity(4, true))).toEqual([4, 1]);
  });
  it('setInputSignal — captured pink = 0x39 02 00, white = 0x39 03 00', () => {
    expect(setInputSignal('pink')).toEqual([0x10, 0x02, 0x00, 0x01, 0x03, 0x39, 0x02, 0x00, 0x10, 0x03, 0x38]);
    expect(setInputSignal('white')).toEqual([0x10, 0x02, 0x00, 0x01, 0x03, 0x39, 0x03, 0x00, 0x10, 0x03, 0x39]);
    expect(dataOf(setInputSignal('analog'))).toEqual([0, 0]);
    expect(dataOf(setInputSignal('sine', 5))).toEqual([1, 5]);
  });
  it('setPeqBand layout [ch, band, gain, 00, f_lo, f_hi, q, type, bypass]', () => {
    const d = dataOf(setPeqBand(2, 0, { gainDb: 0, hz: 1000, q: 2.0, type: 0, bypass: false }));
    expect(d).toEqual([2, 0, 120, 0x00, 170, 0, 28, 0, 0]);
    const b = dataOf(setPeqBand(2, 1, { gainDb: 0, hz: 1000, q: 2.0, type: 0, bypass: true }));
    expect(b[8]).toBe(1);
  });
  it('setGeqBand: band 0 +8.1 → 0xC9, band 5 −8.1 → 0x27', () => {
    expect(dataOf(setGeqBand(0, 0, 8.1))).toEqual([0, 0, 0xc9, 0x00]);
    expect(dataOf(setGeqBand(0, 5, -8.1))).toEqual([0, 5, 0x27, 0x00]);
  });
  it('setHpf/setLpf with no-op slope (default and explicit)', () => {
    expect(dataOf(setHpf(2, 1000))).toEqual([2, 170, 0, 0]);
    expect(dataOf(setHpf(2, 1000, 3))).toEqual([2, 170, 0, 3]);
    expect(dataOf(setLpf(2, 1000))).toEqual([2, 170, 0, 0]);
    expect(dataOf(setLpf(2, 1000, 3))).toEqual([2, 170, 0, 3]);
  });
  it('setDelay', () => {
    expect(dataOf(setDelay(2, 1))).toEqual([2, ...u16le(96)]);
  });
  it('setLimiter: defaults atk 50 ms / rel 500 ms', () => {
    expect(dataOf(setLimiter(2, 50, 500, -6))).toEqual([2, 0x31, 0x00, 0xf3, 0x01, 0, 0, 168, 0]);
  });
  it('setCompressor', () => {
    expect(dataOf(setCompressor(2, 5, 50, 500, 6, -6))).toEqual([
      2, 5, 0x00, 0x31, 0x00, 0xf3, 0x01, 6, 0x00, 168, 0x00,
    ]);
  });
  it('setGate: threshold is the byte at data index 7', () => {
    const d = dataOf(setGate(0, 1, 10, 100, -30));
    expect(d).toEqual([0, 0, 0, 9, 0, 99, 0, 120, 0]);
    expect(d[7]).toBe(120);
  });
  it('setMatrixRoute: Out 1 both → 02 03, In A only → 02 01', () => {
    expect(dataOf(setMatrixRoute(2, 0x03))).toEqual([2, 0x03]);
    expect(dataOf(setMatrixRoute(2, 0x01))).toEqual([2, 0x01]);
  });
  it('setMatrixLevel: Out 1 In A −6 dB → DC 00', () => {
    expect(dataOf(setMatrixLevel(2, 0, -6))).toEqual([2, 0, 0xdc, 0x00]);
  });
  it('presets', () => {
    expect(dataOf(loadPreset(2))).toEqual([2]);
    expect(dataOf(storePreset(5))).toEqual([5]);
    expect(dataOf(setPresetName('AB~'))).toEqual([0x41, 0x42, 0x7e]);
  });
  it('all frames carry a valid checksum', () => {
    const f = setCompressor(3, 9, 100, 1000, 12, 0);
    expect(f[f.length - 1]).toBe(checksum(payloadOf(f)));
  });
});

describe('§7 meters', () => {
  it('decodeFloat16 across all branches', () => {
    expect(decodeFloat16(0x00, 0x3c)).toBe(1); // normal
    expect(decodeFloat16(0x00, 0xbc)).toBe(-1); // sign
    expect(decodeFloat16(0x00, 0x00)).toBe(0); // exp 0
    expect(decodeFloat16(0x00, 0x7c)).toBe(Infinity); // exp 31, mant 0
    expect(Number.isNaN(decodeFloat16(0x01, 0x7c))).toBe(true); // exp 31, mant != 0
  });

  const meterFrame = () => {
    const f = new Array(64).fill(0);
    f[0] = 0x10;
    f[1] = 0x02;
    f[2] = 0x01;
    f[3] = 0x00;
    f[5] = 0x40;
    f[6] = 0x00; // group 0 = 1.0
    f[7] = 0x3c;
    f[9] = 0x00; // group 1 = Infinity → coerced 0
    f[10] = 0x7c;
    return f;
  };

  it('isMeterFrame recognizes the response', () => {
    expect(isMeterFrame(meterFrame())).toBe(true);
    expect(isMeterFrame(keepalive())).toBe(false);
  });
  it('parseMeters: non-finite coerced to 0, short frame breaks early', () => {
    const m = parseMeters(meterFrame());
    expect(m[0]).toBe(1);
    expect(m[1]).toBe(0);
    expect(parseMeters([0x10, 0x02, 0x01, 0x00, 0x00, 0x40])).toEqual([]);
  });
  it('parseDisplayMeters returns the 8 display channels', () => {
    const m = parseDisplayMeters(meterFrame());
    expect(m).toHaveLength(8);
    expect(m[0]).toBe(1);
  });
  it('parseDisplayMeters falls back to 0 for missing groups (short frame)', () => {
    const m = parseDisplayMeters([0x10, 0x02, 0x01, 0x00, 0x00, 0x40]);
    expect(m).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

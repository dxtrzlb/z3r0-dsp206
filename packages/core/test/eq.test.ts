import { describe, it, expect } from 'vitest';
import { peqBandDb, channelResponseDb, hpDb, lpDb, freqToPos, posToFreq, SLOPE_LADDER } from '../src/eq';
import { defaultChannel } from '../src/state';
import type { PeqBand } from '../src/state';

const band = (p: Partial<PeqBand>): PeqBand => ({ gainDb: 0, hz: 1000, q: 2, type: 0, bypass: false, ...p });

describe('eq response', () => {
  it('a peaking band reaches ~its gain at the centre frequency', () => {
    expect(peqBandDb(band({ gainDb: 6, hz: 1000, q: 2 }), 1000)).toBeCloseTo(6, 1);
    expect(peqBandDb(band({ gainDb: -9, hz: 1000, q: 2 }), 1000)).toBeCloseTo(-9, 1);
  });

  it('a peaking band is ~flat far from its centre', () => {
    expect(peqBandDb(band({ gainDb: 6, hz: 1000 }), 50)).toBeCloseTo(0, 1);
    expect(peqBandDb(band({ gainDb: 6, hz: 1000 }), 18000)).toBeCloseTo(0, 1);
  });

  it('a bypassed band contributes nothing', () => {
    expect(peqBandDb(band({ gainDb: 12, bypass: true }), 1000)).toBe(0);
  });

  it('Nth-order roll-off is -3 dB at the corner and steeper with order', () => {
    expect(lpDb(1000, 1, 1000)).toBeCloseTo(-3.01, 1);
    expect(hpDb(1000, 1, 1000)).toBeCloseTo(-3.01, 1);
    // one octave below an HPF corner: order 1 ~ -7 dB, order 4 ~ -24 dB
    expect(hpDb(1000, 1, 500)).toBeCloseTo(-6.99, 1);
    expect(hpDb(1000, 4, 500)).toBeCloseTo(-24.1, 0);
  });

  it('log frequency mapping round-trips and spans the display range', () => {
    expect(freqToPos(20)).toBeCloseTo(0, 5);
    expect(freqToPos(20000)).toBeCloseTo(1, 5);
    expect(posToFreq(freqToPos(440))).toBeCloseTo(440, 3);
  });

  it('default channel response is flat (no active bands, crossover off)', () => {
    const r = channelResponseDb(defaultChannel(), [100, 1000, 10000]);
    r.forEach((db) => expect(db).toBeCloseTo(0, 6));
  });

  it('the slope ladder has 20 entries ending at LK-48', () => {
    expect(SLOPE_LADDER).toHaveLength(20);
    expect(SLOPE_LADDER[19]).toEqual({ label: 'LK-48', dbPerOct: 48 });
  });
});

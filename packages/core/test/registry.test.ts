import { describe, it, expect } from 'vitest';
import { dispatch, commandList } from '../src/registry';
import { defaultState } from '../src/state';
import { setGain, setMatrixRoute, setHpf, setMute } from '../src/commands';
import { FREQ_MIN } from '../src/protocol';

describe('command registry', () => {
  it('setGain updates state immutably and emits the gain frame', () => {
    const s = defaultState();
    const r = dispatch(s, 'setGain', { ch: 2, db: -6 });
    expect(r.state.channels[2].gainDb).toBe(-6);
    expect(s.channels[2].gainDb).toBe(0); // original untouched
    expect(r.frames).toEqual([setGain(2, -6)]);
  });

  it('setRoute computes the matrix mask from prior state', () => {
    let s = defaultState();
    s = dispatch(s, 'setRoute', { outCh: 2, inIdx: 0, on: true }).state; // In A
    const r = dispatch(s, 'setRoute', { outCh: 2, inIdx: 1, on: true }); // + In B
    expect(r.state.channels[2].routeMask).toBe(0x03);
    expect(r.frames).toEqual([setMatrixRoute(2, 0x03)]);
  });

  it('setHpf off sends the minimum frequency but keeps the stored hz', () => {
    const r = dispatch(defaultState(), 'setHpf', { ch: 2, hz: 100, on: false });
    expect(r.state.channels[2].hpf).toEqual({ hz: 100, on: false });
    expect(r.frames).toEqual([setHpf(2, FREQ_MIN)]);
  });

  it('partial limiter update merges with current and preserves a 0 threshold', () => {
    const r = dispatch(defaultState(), 'setLimiter', { ch: 2, threshDb: 0 });
    expect(r.state.channels[2].limiter).toEqual({ attackMs: 50, releaseMs: 500, threshDb: 0 });
  });

  it('muteAll mutes every channel and emits a frame per channel', () => {
    const r = dispatch(defaultState(), 'muteAll', { muted: true });
    expect(r.state.channels.every((c) => c.muted)).toBe(true);
    expect(r.frames).toEqual(defaultState().channels.map((_, i) => setMute(i, true)));
  });

  it('rejects invalid params (zod)', () => {
    expect(() => dispatch(defaultState(), 'setGain', { ch: 99, db: 0 })).toThrow();
    expect(() => dispatch(defaultState(), 'setGain', { ch: 2, db: 999 })).toThrow();
  });

  it('throws on an unknown command', () => {
    // @ts-expect-error unknown command name
    expect(() => dispatch(defaultState(), 'nope', {})).toThrow();
  });

  it('commandList flags destructive commands', () => {
    const list = commandList();
    expect(list.find((c) => c.name === 'loadPreset')?.destructive).toBe(true);
    expect(list.find((c) => c.name === 'setGain')?.destructive).toBe(false);
  });
});

// Canonical DSP state. Owned by the hub (Electron main); clients hold a synced mirror.
import { FREQ_MIN, FREQ_MAX } from './protocol';
import type { PeqBand, InputSignal } from './commands';

export type { PeqBand, InputSignal };

// Display channels in panel order. Index === device channel byte (In A=0 … Out 6=7).
export const CHANNELS = ['In A', 'In B', 'Out 1', 'Out 2', 'Out 3', 'Out 4', 'Out 5', 'Out 6'] as const;
export const isInput = (ch: number): boolean => ch < 2;

export { FREQ_MIN, FREQ_MAX };

export interface ChannelState {
  gainDb: number;
  muted: boolean;
  inverted: boolean;
  routeMask: number; // outputs: bit 0 = In A, bit 1 = In B
  inLevel: [number, number]; // outputs: per-input matrix level dB
  peq: PeqBand[];
  hpf: { hz: number; on: boolean; slope: number };
  lpf: { hz: number; on: boolean; slope: number };
  delayMs: number;
  limiter: { attackMs: number; releaseMs: number; threshDb: number };
  compressor: { ratio: number; attackMs: number; releaseMs: number; kneeDb: number; threshDb: number };
  gate: { attackMs: number; releaseMs: number; holdMs: number; threshDb: number };
  geq: number[]; // 31 bands, inputs only
}

export interface DspState {
  channels: ChannelState[];
  inputSignal: { signal: InputSignal; sineFreqIndex: number };
}

export const defaultBand = (hz: number): PeqBand => ({ gainDb: 0, hz, q: 2.0, type: 0, bypass: false });

export const defaultChannel = (): ChannelState => ({
  gainDb: 0,
  muted: false,
  inverted: false,
  routeMask: 0,
  inLevel: [0, 0],
  peq: [defaultBand(120), defaultBand(1000), defaultBand(8000)],
  hpf: { hz: 20, on: false, slope: 9 },
  lpf: { hz: 20000, on: false, slope: 9 },
  delayMs: 0,
  limiter: { attackMs: 50, releaseMs: 500, threshDb: 0 },
  compressor: { ratio: 0, attackMs: 50, releaseMs: 500, kneeDb: 0, threshDb: 0 },
  gate: { attackMs: 10, releaseMs: 100, holdMs: 10, threshDb: -60 },
  geq: new Array(31).fill(0),
});

export const defaultState = (): DspState => ({
  channels: CHANNELS.map(defaultChannel),
  inputSignal: { signal: 'analog', sineFreqIndex: 0 },
});

// Immutably update one channel.
export function patchChannel(
  state: DspState,
  ch: number,
  fn: (c: ChannelState) => ChannelState,
): DspState {
  const channels = state.channels.slice();
  channels[ch] = fn(channels[ch]);
  return { ...state, channels };
}

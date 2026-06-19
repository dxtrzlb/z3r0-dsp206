import { create } from 'zustand';
import type { SessionStatus } from '../main/device/session';
import type { DeviceInfo } from '../main/device/hid';

// Display channels in panel order. Index === device channel byte (In A=0 … Out 6=7).
export const CHANNELS = ['In A', 'In B', 'Out 1', 'Out 2', 'Out 3', 'Out 4', 'Out 5', 'Out 6'] as const;
export const isInput = (ch: number): boolean => ch < 2;

export interface PeqBand {
  gainDb: number;
  hz: number;
  q: number;
  type: number;
  bypass: boolean;
}

export interface ChannelState {
  gainDb: number;
  muted: boolean;
  inverted: boolean;
  routeMask: number; // outputs: bit 0 = In A, bit 1 = In B
  inLevel: [number, number]; // outputs: per-input matrix level dB
  peq: PeqBand[];
  hpf: { hz: number; on: boolean };
  lpf: { hz: number; on: boolean };
  delayMs: number;
  limiter: { attackMs: number; releaseMs: number; threshDb: number };
  compressor: { ratio: number; attackMs: number; releaseMs: number; kneeDb: number; threshDb: number };
  gate: { attackMs: number; releaseMs: number; holdMs: number; threshDb: number };
  geq: number[]; // 31 bands, inputs only
}

const defaultBand = (hz: number): PeqBand => ({ gainDb: 0, hz, q: 2.0, type: 0, bypass: false });

const defaultChannel = (): ChannelState => ({
  gainDb: 0,
  muted: false,
  inverted: false,
  routeMask: 0,
  inLevel: [0, 0],
  peq: [defaultBand(120), defaultBand(1000), defaultBand(8000)],
  hpf: { hz: 20, on: false },
  lpf: { hz: 20000, on: false },
  delayMs: 0,
  limiter: { attackMs: 50, releaseMs: 500, threshDb: 0 },
  compressor: { ratio: 0, attackMs: 50, releaseMs: 500, kneeDb: 0, threshDb: 0 },
  gate: { attackMs: 10, releaseMs: 100, holdMs: 10, threshDb: -60 },
  geq: new Array(31).fill(0),
});

const FREQ_MIN = 19.7;
const FREQ_MAX = 20160;

interface DspStore {
  status: SessionStatus;
  detail?: string;
  present: boolean;
  device: DeviceInfo | null;
  demoMode: boolean;
  meters: number[];
  channels: ChannelState[];
  selected: number;

  bind: () => () => void;
  refreshPresent: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setDemoMode: (on: boolean) => void;
  select: (ch: number) => void;

  setGain: (ch: number, db: number) => void;
  setMute: (ch: number, muted: boolean) => void;
  setPolarity: (ch: number, inverted: boolean) => void;
  setRoute: (outCh: number, inIdx: number, on: boolean) => void;
  setInLevel: (outCh: number, inIdx: number, db: number) => void;
  setPeqBand: (ch: number, band: number, patch: Partial<PeqBand>) => void;
  addPeqBand: (ch: number) => void;
  removePeqBand: (ch: number) => void;
  setHpf: (ch: number, patch: Partial<{ hz: number; on: boolean }>) => void;
  setLpf: (ch: number, patch: Partial<{ hz: number; on: boolean }>) => void;
  setDelay: (ch: number, ms: number) => void;
  setLimiter: (ch: number, patch: Partial<ChannelState['limiter']>) => void;
  setCompressor: (ch: number, patch: Partial<ChannelState['compressor']>) => void;
  setGate: (ch: number, patch: Partial<ChannelState['gate']>) => void;
  setGeqBand: (ch: number, band: number, db: number) => void;
}

// Immutably update one channel and return the new channels array.
function patchChannel(
  channels: ChannelState[],
  ch: number,
  fn: (c: ChannelState) => ChannelState,
): ChannelState[] {
  const next = channels.slice();
  next[ch] = fn(next[ch]);
  return next;
}

export const useStore = create<DspStore>((set, get) => ({
  status: 'disconnected',
  present: false,
  device: null,
  demoMode: false,
  meters: new Array(8).fill(0),
  channels: CHANNELS.map(defaultChannel),
  selected: 0,

  bind: () => {
    const offStatus = window.dsp.onStatus((status, detail) => {
      if (status !== 'connected') set({ status, detail, meters: new Array(8).fill(0) });
      else set({ status, detail });
    });
    const offMeters = window.dsp.onMeters((meters) => set({ meters }));
    window.dsp.sync();
    return () => {
      offStatus();
      offMeters();
    };
  },

  refreshPresent: async () => {
    const device = await window.dsp.deviceInfo();
    set({ present: device !== null, device });
  },

  connect: async () => {
    await get().refreshPresent();
    set({ demoMode: false });
    await window.dsp.connect();
  },
  disconnect: () => window.dsp.disconnect(),
  setDemoMode: (on) => set({ demoMode: on, meters: new Array(8).fill(0) }),
  select: (ch) => set({ selected: ch }),

  setGain: (ch, db) => {
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, gainDb: db })) }));
    window.dsp.send('setGain', ch, db);
  },
  setMute: (ch, muted) => {
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, muted })) }));
    window.dsp.send('setMute', ch, muted);
  },
  setPolarity: (ch, inverted) => {
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, inverted })) }));
    window.dsp.send('setPolarity', ch, inverted);
  },
  setRoute: (outCh, inIdx, on) => {
    const bit = inIdx === 0 ? 0x01 : 0x02;
    const mask = on ? get().channels[outCh].routeMask | bit : get().channels[outCh].routeMask & ~bit;
    set((s) => ({ channels: patchChannel(s.channels, outCh, (c) => ({ ...c, routeMask: mask })) }));
    window.dsp.send('setMatrixRoute', outCh, mask);
  },
  setInLevel: (outCh, inIdx, db) => {
    set((s) => ({
      channels: patchChannel(s.channels, outCh, (c) => {
        const inLevel = c.inLevel.slice() as [number, number];
        inLevel[inIdx] = db;
        return { ...c, inLevel };
      }),
    }));
    window.dsp.send('setMatrixLevel', outCh, inIdx, db);
  },

  setPeqBand: (ch, band, patch) => {
    const next = { ...get().channels[ch].peq[band], ...patch };
    set((s) =>
      ({ channels: patchChannel(s.channels, ch, (c) => {
        const peq = c.peq.slice();
        peq[band] = next;
        return { ...c, peq };
      }) }),
    );
    window.dsp.send('setPeqBand', ch, band, next);
  },
  addPeqBand: (ch) => {
    const band = get().channels[ch].peq.length;
    const newBand = defaultBand(1000);
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, peq: [...c.peq, newBand] })) }));
    window.dsp.send('setPeqBand', ch, band, newBand);
  },
  removePeqBand: (ch) => {
    const peq = get().channels[ch].peq;
    if (peq.length <= 1) return;
    const band = peq.length - 1;
    // Bypass the removed band on the device so it stops affecting audio.
    window.dsp.send('setPeqBand', ch, band, { ...peq[band], bypass: true });
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, peq: c.peq.slice(0, -1) })) }));
  },

  setHpf: (ch, patch) => {
    const next = { ...get().channels[ch].hpf, ...patch };
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, hpf: next })) }));
    window.dsp.send('setHpf', ch, next.on ? next.hz : FREQ_MIN);
  },
  setLpf: (ch, patch) => {
    const next = { ...get().channels[ch].lpf, ...patch };
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, lpf: next })) }));
    window.dsp.send('setLpf', ch, next.on ? next.hz : FREQ_MAX);
  },
  setDelay: (ch, ms) => {
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, delayMs: ms })) }));
    window.dsp.send('setDelay', ch, ms);
  },
  setLimiter: (ch, patch) => {
    const next = { ...get().channels[ch].limiter, ...patch };
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, limiter: next })) }));
    window.dsp.send('setLimiter', ch, next.attackMs, next.releaseMs, next.threshDb);
  },
  setCompressor: (ch, patch) => {
    const next = { ...get().channels[ch].compressor, ...patch };
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, compressor: next })) }));
    window.dsp.send('setCompressor', ch, next.ratio, next.attackMs, next.releaseMs, next.kneeDb, next.threshDb);
  },
  setGate: (ch, patch) => {
    const next = { ...get().channels[ch].gate, ...patch };
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => ({ ...c, gate: next })) }));
    window.dsp.send('setGate', ch, next.attackMs, next.releaseMs, next.holdMs, next.threshDb);
  },
  setGeqBand: (ch, band, db) => {
    set((s) => ({ channels: patchChannel(s.channels, ch, (c) => {
      const geq = c.geq.slice();
      geq[band] = db;
      return { ...c, geq };
    }) }));
    window.dsp.send('setGeqBand', ch, band, db);
  },
}));

// Controls are live only when a real device is connected or demo mode is on.
export const useInteractive = (): boolean =>
  useStore((s) => s.status === 'connected' || s.demoMode);

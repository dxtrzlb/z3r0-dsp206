import { create } from 'zustand';
import { CHANNELS, isInput, defaultState, type ChannelState, type PeqBand } from '@z3r0/core';
import type { SessionStatus } from '../main/device/session';
import type { DeviceInfo } from '../main/device/hid';

export { CHANNELS, isInput };
export type { ChannelState, PeqBand };

// The renderer holds a MIRROR of the hub's canonical state. Actions dispatch intents to the hub;
// the authoritative state comes back via onState and updates `channels`. UI-only fields
// (status, meters, selected, demoMode) stay local.
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
  muteAll: (muted: boolean) => void;
}

export const useStore = create<DspStore>((set, get) => ({
  status: 'disconnected',
  present: false,
  device: null,
  demoMode: false,
  meters: new Array(8).fill(0),
  channels: defaultState().channels,
  selected: 0,

  bind: () => {
    const offStatus = window.dsp.onStatus((status, detail) => {
      if (status !== 'connected') set({ status, detail, meters: new Array(8).fill(0) });
      else set({ status, detail });
    });
    const offMeters = window.dsp.onMeters((meters) => set({ meters }));
    const offState = window.dsp.onState((s) => set({ channels: s.channels }));
    window.dsp.sync();
    return () => {
      offStatus();
      offMeters();
      offState();
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

  setGain: (ch, db) => void window.dsp.dispatch('setGain', { ch, db }),
  setMute: (ch, muted) => void window.dsp.dispatch('setMute', { ch, muted }),
  setPolarity: (ch, inverted) => void window.dsp.dispatch('setPolarity', { ch, inverted }),
  setRoute: (outCh, inIdx, on) => void window.dsp.dispatch('setRoute', { outCh, inIdx, on }),
  setInLevel: (outCh, inIdx, db) => void window.dsp.dispatch('setMatrixLevel', { outCh, inIdx, db }),
  setPeqBand: (ch, band, patch) => void window.dsp.dispatch('setPeqBand', { ch, band, patch }),
  addPeqBand: (ch) => void window.dsp.dispatch('addPeqBand', { ch }),
  removePeqBand: (ch) => void window.dsp.dispatch('removePeqBand', { ch }),
  setHpf: (ch, patch) => void window.dsp.dispatch('setHpf', { ch, ...patch }),
  setLpf: (ch, patch) => void window.dsp.dispatch('setLpf', { ch, ...patch }),
  setDelay: (ch, ms) => void window.dsp.dispatch('setDelay', { ch, ms }),
  setLimiter: (ch, patch) => void window.dsp.dispatch('setLimiter', { ch, ...patch }),
  setCompressor: (ch, patch) => void window.dsp.dispatch('setCompressor', { ch, ...patch }),
  setGate: (ch, patch) => void window.dsp.dispatch('setGate', { ch, ...patch }),
  setGeqBand: (ch, band, db) => void window.dsp.dispatch('setGeqBand', { ch, band, db }),
  muteAll: (muted) => void window.dsp.dispatch('muteAll', { muted }),
}));

// Controls are live only when a real device is connected or demo mode is on.
export const useInteractive = (): boolean =>
  useStore((s) => s.status === 'connected' || s.demoMode);

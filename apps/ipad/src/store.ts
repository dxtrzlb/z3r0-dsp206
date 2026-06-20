// zustand mirror of the hub's canonical state — the same pattern as the desktop renderer's
// store, but the transport is the WebSocket/REST HubClient instead of Electron IPC. Actions
// send command intents; authoritative state arrives back over the socket and updates `channels`.
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import {
  CHANNELS,
  isInput,
  defaultState,
  type ChannelState,
  type PeqBand,
  type DspState,
} from '@z3r0/core';
import { HubClient, parseHost, type ConnStatus } from './hub/client';

export { CHANNELS, isInput };
export type { ChannelState, PeqBand };

const SESSION_KEY = 'dsp206.session';
const client = new HubClient();

interface Store {
  status: ConnStatus;
  detail?: string;
  host?: string;
  channels: ChannelState[];
  meters: number[];
  selected: number;

  init: () => Promise<void>;
  pairAndConnect: (host: string, code: string) => Promise<void>;
  disconnect: () => void;
  forget: () => Promise<void>;
  select: (ch: number) => void;

  setGain: (ch: number, db: number) => void;
  setMute: (ch: number, muted: boolean) => void;
  setPolarity: (ch: number, inverted: boolean) => void;
  setRoute: (outCh: number, inIdx: number, on: boolean) => void;
  setInLevel: (outCh: number, inIdx: number, db: number) => void;
  setPeqBand: (ch: number, band: number, patch: Partial<PeqBand>) => void;
  addPeqBand: (ch: number) => void;
  removePeqBand: (ch: number) => void;
  setHpf: (ch: number, patch: Partial<{ hz: number; on: boolean; slope: number }>) => void;
  setLpf: (ch: number, patch: Partial<{ hz: number; on: boolean; slope: number }>) => void;
  setDelay: (ch: number, ms: number) => void;
  setLimiter: (ch: number, patch: Partial<ChannelState['limiter']>) => void;
  setCompressor: (ch: number, patch: Partial<ChannelState['compressor']>) => void;
  setGate: (ch: number, patch: Partial<ChannelState['gate']>) => void;
  setGeqBand: (ch: number, band: number, db: number) => void;
  muteAll: (muted: boolean) => void;
}

export const useStore = create<Store>((set) => {
  client.onStatus((status, detail) => set({ status, detail }));
  client.onState((s: DspState) => set({ channels: s.channels }));
  client.onMeters((values) => set({ meters: values }));

  return {
    status: 'disconnected',
    channels: defaultState().channels,
    meters: new Array(8).fill(0),
    selected: 0,

    init: async () => {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw) return;
      try {
        const { host, token } = JSON.parse(raw) as { host: string; token: string };
        set({ host });
        client.connect({ ws: parseHost(host).ws, token });
      } catch {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      }
    },

    pairAndConnect: async (host, code) => {
      const { http, ws } = parseHost(host);
      const token = await client.pair(http, code);
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ host, token }));
      set({ host });
      client.connect({ ws, token });
    },

    disconnect: () => client.disconnect(),
    forget: async () => {
      client.disconnect();
      await SecureStore.deleteItemAsync(SESSION_KEY);
      set({ host: undefined, channels: defaultState().channels, meters: new Array(8).fill(0) });
    },
    select: (ch) => set({ selected: ch }),

    setGain: (ch, db) => client.dispatch('setGain', { ch, db }),
    setMute: (ch, muted) => client.dispatch('setMute', { ch, muted }),
    setPolarity: (ch, inverted) => client.dispatch('setPolarity', { ch, inverted }),
    setRoute: (outCh, inIdx, on) => client.dispatch('setRoute', { outCh, inIdx, on }),
    setInLevel: (outCh, inIdx, db) => client.dispatch('setMatrixLevel', { outCh, inIdx, db }),
    setPeqBand: (ch, band, patch) => client.dispatch('setPeqBand', { ch, band, patch }),
    addPeqBand: (ch) => client.dispatch('addPeqBand', { ch }),
    removePeqBand: (ch) => client.dispatch('removePeqBand', { ch }),
    setHpf: (ch, patch) => client.dispatch('setHpf', { ch, ...patch }),
    setLpf: (ch, patch) => client.dispatch('setLpf', { ch, ...patch }),
    setDelay: (ch, ms) => client.dispatch('setDelay', { ch, ms }),
    setLimiter: (ch, patch) => client.dispatch('setLimiter', { ch, ...patch }),
    setCompressor: (ch, patch) => client.dispatch('setCompressor', { ch, ...patch }),
    setGate: (ch, patch) => client.dispatch('setGate', { ch, ...patch }),
    setGeqBand: (ch, band, db) => client.dispatch('setGeqBand', { ch, band, db }),
    muteAll: (muted) => client.dispatch('muteAll', { muted }),
  };
});

export const useConnected = (): boolean => useStore((s) => s.status === 'connected');

// Browser dev harness: when the renderer runs outside Electron (plain `vite`, for visual preview),
// there is no preload bridge. This installs a fake `window.dsp` that drives the REAL core registry
// in-memory, so the UI behaves like demo mode in a browser. No-ops under Electron (bridge present).
import { dispatch as applyCommand, defaultState, type DspState, type CommandName } from '@z3r0/core';
import type { DspApi } from '../preload';

export function installDevMock(): void {
  const w = window as unknown as { dsp?: DspApi };
  if (w.dsp) return; // real Electron bridge present

  let state: DspState = defaultState();
  let status: 'disconnected' | 'connected' | 'error' = 'disconnected';
  const statusCbs = new Set<(s: typeof status, d?: string) => void>();
  const meterCbs = new Set<(m: number[]) => void>();
  const stateCbs = new Set<(s: DspState) => void>();
  const emitStatus = (): void => statusCbs.forEach((c) => c(status));
  const emitState = (): void => stateCbs.forEach((c) => c(state));

  const phase = state.channels.map(() => Math.random() * Math.PI * 2);
  setInterval(() => {
    if (status !== 'connected') return;
    const t = Date.now() / 1000;
    const m = phase.map((p, i) => Math.max(0, 0.35 + 0.3 * Math.sin(t * (1 + i * 0.15) + p) + (Math.random() - 0.5) * 0.1));
    meterCbs.forEach((c) => c(m));
  }, 80);

  const api = {
    connect: async () => {
      status = 'connected';
      emitStatus();
    },
    disconnect: async () => {
      status = 'disconnected';
      emitStatus();
    },
    isPresent: async () => true,
    deviceInfo: async () => ({ product: 'Dsp Process (demo)', manufacturer: 'z3r0', path: 'demo' }),
    sync: async () => {
      emitStatus();
      emitState();
    },
    getState: async () => state,
    serverInfo: async () => ({ port: 7206, code: '000000' }),
    dispatch: async (name: CommandName, params: unknown) => {
      state = applyCommand(state, name, params).state;
      emitState();
      return { ok: true as const };
    },
    onStatus: (cb: (s: typeof status, d?: string) => void) => {
      statusCbs.add(cb);
      return () => void statusCbs.delete(cb);
    },
    onMeters: (cb: (m: number[]) => void) => {
      meterCbs.add(cb);
      return () => void meterCbs.delete(cb);
    },
    onState: (cb: (s: DspState) => void) => {
      stateCbs.add(cb);
      return () => void stateCbs.delete(cb);
    },
  };

  w.dsp = api as unknown as DspApi;
  console.info('[z3r0] dev mock window.dsp installed (browser preview)');
}

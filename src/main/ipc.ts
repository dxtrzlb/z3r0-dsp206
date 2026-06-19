// Bridges the renderer to the device session. The renderer never sees node-hid.
import { ipcMain, type BrowserWindow } from 'electron';
import { DspSession } from './device/session';
import { getDeviceInfo } from './device/hid';
import * as cmd from './device/commands';

// Whitelist of command builders the renderer may invoke by name.
const builders = {
  setGain: cmd.setGain,
  setMute: cmd.setMute,
  setPolarity: cmd.setPolarity,
  setInputSignal: cmd.setInputSignal,
  setPeqBand: cmd.setPeqBand,
  setGeqBand: cmd.setGeqBand,
  setHpf: cmd.setHpf,
  setLpf: cmd.setLpf,
  setDelay: cmd.setDelay,
  setLimiter: cmd.setLimiter,
  setCompressor: cmd.setCompressor,
  setGate: cmd.setGate,
  setMatrixRoute: cmd.setMatrixRoute,
  setMatrixLevel: cmd.setMatrixLevel,
  loadPreset: cmd.loadPreset,
  storePreset: cmd.storePreset,
  setPresetName: cmd.setPresetName,
} as const;

export type CommandName = keyof typeof builders;

export function registerIpc(getWindow: () => BrowserWindow | null): DspSession {
  const session = new DspSession({
    onMeters: (levels) => getWindow()?.webContents.send('dsp:meters', levels),
    onStatus: (status, detail) => getWindow()?.webContents.send('dsp:status', status, detail),
  });

  ipcMain.handle('dsp:connect', () => session.connect());
  ipcMain.handle('dsp:disconnect', () => session.disconnect());
  ipcMain.handle('dsp:isPresent', () => session.isDevicePresent());
  ipcMain.handle('dsp:deviceInfo', () => getDeviceInfo());
  // Re-emit the true session state so a freshly loaded renderer reconciles with main.
  ipcMain.handle('dsp:sync', () => {
    getWindow()?.webContents.send('dsp:status', session.connected ? 'connected' : 'disconnected');
  });
  ipcMain.handle('dsp:command', (_e, name: CommandName, args: unknown[]) => {
    const build = builders[name];
    if (!build) throw new Error(`unknown command: ${name}`);
    session.send((build as (...a: never[]) => number[])(...(args as never[])));
  });

  return session;
}

// Bridges the renderer to the hub + device session. The renderer never sees node-hid.
import { ipcMain, type BrowserWindow } from 'electron';
import type { CommandName } from '@z3r0/core';
import { DspSession } from './device/session';
import { getDeviceInfo } from './device/hid';
import { Hub } from './hub';

export interface DspBackend {
  session: DspSession;
  hub: Hub;
}

export function registerIpc(getWindow: () => BrowserWindow | null): DspBackend {
  let hub!: Hub;
  const session = new DspSession({
    onMeters: (levels) => hub.pushMeters(levels),
    onStatus: (status, detail) => getWindow()?.webContents.send('dsp:status', status, detail),
  });
  hub = new Hub(session);

  // Fan canonical state + meters out to the renderer (the WS server subscribes separately).
  hub.onState((s) => getWindow()?.webContents.send('dsp:state', s));
  hub.onMeters((m) => getWindow()?.webContents.send('dsp:meters', m));

  ipcMain.handle('dsp:connect', () => session.connect());
  ipcMain.handle('dsp:disconnect', () => session.disconnect());
  ipcMain.handle('dsp:isPresent', () => session.isDevicePresent());
  ipcMain.handle('dsp:deviceInfo', () => getDeviceInfo());
  ipcMain.handle('dsp:getState', () => hub.getState());
  // Re-emit the true session state + canonical DSP state so a fresh renderer reconciles with main.
  ipcMain.handle('dsp:sync', () => {
    const w = getWindow();
    w?.webContents.send('dsp:status', session.connected ? 'connected' : 'disconnected');
    w?.webContents.send('dsp:state', hub.getState());
  });
  ipcMain.handle('dsp:dispatch', (_e, name: CommandName, params: unknown) => hub.dispatch(name, params));

  return { session, hub };
}

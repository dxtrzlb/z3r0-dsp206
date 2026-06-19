import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { CommandName } from '../main/ipc';
import type { SessionStatus } from '../main/device/session';
import type { DeviceInfo } from '../main/device/hid';

const api = {
  connect: (): Promise<void> => ipcRenderer.invoke('dsp:connect'),
  disconnect: (): Promise<void> => ipcRenderer.invoke('dsp:disconnect'),
  isPresent: (): Promise<boolean> => ipcRenderer.invoke('dsp:isPresent'),
  deviceInfo: (): Promise<DeviceInfo | null> => ipcRenderer.invoke('dsp:deviceInfo'),
  sync: (): Promise<void> => ipcRenderer.invoke('dsp:sync'),
  send: (name: CommandName, ...args: unknown[]): Promise<void> =>
    ipcRenderer.invoke('dsp:command', name, args),
  onStatus: (cb: (status: SessionStatus, detail?: string) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, status: SessionStatus, detail?: string) => cb(status, detail);
    ipcRenderer.on('dsp:status', h);
    return () => ipcRenderer.removeListener('dsp:status', h);
  },
  onMeters: (cb: (levels: number[]) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, levels: number[]) => cb(levels);
    ipcRenderer.on('dsp:meters', h);
    return () => ipcRenderer.removeListener('dsp:meters', h);
  },
};

export type DspApi = typeof api;

contextBridge.exposeInMainWorld('dsp', api);

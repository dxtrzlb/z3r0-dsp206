// Session lifecycle: handshake + keepalive loop + meter dispatch.
// The hard rule (§1 mutual exclusion): the USB handle must be released on EVERY exit path,
// or the official editor hangs at "uploading parameters 0%". The safety net below enforces it.
import { openDevice, findDevice, type DspHandle } from './hid';
import { handshake, keepalive, isMeterFrame, parseDisplayMeters } from '@z3r0/core';

const KEEPALIVE_MS = 130;

export type SessionStatus = 'disconnected' | 'connected' | 'error';

export interface SessionCallbacks {
  onMeters?: (levels: number[]) => void;
  onStatus?: (status: SessionStatus, detail?: string) => void;
}

let activeHandle: DspHandle | null = null;

function releaseActive(): void {
  if (activeHandle) {
    activeHandle.close();
    activeHandle = null;
  }
}

// Process-level safety net — fires no matter how the process dies.
let netInstalled = false;
function installSafetyNet(): void {
  if (netInstalled) return;
  netInstalled = true;
  process.once('exit', releaseActive);
  process.once('SIGINT', () => {
    releaseActive();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    releaseActive();
    process.exit(0);
  });
  process.once('uncaughtException', (err) => {
    releaseActive();
    console.error(err);
    process.exit(1);
  });
}

export class DspSession {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private cb: SessionCallbacks = {}) {
    installSafetyNet();
  }

  get connected(): boolean {
    return activeHandle !== null;
  }

  isDevicePresent(): boolean {
    return findDevice() !== undefined;
  }

  connect(): void {
    if (this.connected) return;
    try {
      const handle = openDevice();
      activeHandle = handle;
      handle.onFrame((frame) => {
        if (isMeterFrame(frame)) this.cb.onMeters?.(parseDisplayMeters(frame));
      });
      handle.onError((err) => {
        this.cb.onStatus?.('error', err.message);
        this.disconnect();
      });
      handle.write(handshake());
      this.timer = setInterval(() => activeHandle?.write(keepalive()), KEEPALIVE_MS);
      this.cb.onStatus?.('connected');
    } catch (err) {
      releaseActive();
      this.cb.onStatus?.('error', err instanceof Error ? err.message : String(err));
    }
  }

  disconnect(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    releaseActive();
    this.cb.onStatus?.('disconnected');
  }

  // Send a pre-built command frame (from commands.ts) while the session is live.
  send(frame: number[]): void {
    activeHandle?.write(frame);
  }
}

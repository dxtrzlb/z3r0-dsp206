// USB-HID transport. The only place that touches node-hid. Owns the single device handle.
import HID from 'node-hid';

export const VID = 0x0168;
export const PID = 0x0821;

// 65-byte output report: leading report-id 0x00 + 64-byte padded frame (§3).
function toReport(frame: number[]): number[] {
  const buf = new Array(65).fill(0);
  for (let i = 0; i < frame.length && i < 64; i++) buf[i + 1] = frame[i];
  return buf;
}

export interface DspHandle {
  write(frame: number[]): void;
  onFrame(cb: (frame: number[]) => void): void;
  onError(cb: (err: Error) => void): void;
  close(): void;
}

export function findDevice(): HID.Device | undefined {
  return HID.devices().find((d) => d.vendorId === VID && d.productId === PID);
}

export interface DeviceInfo {
  product: string | null;
  manufacturer: string | null;
  vendorId: number;
  productId: number;
}

export function getDeviceInfo(): DeviceInfo | null {
  const d = findDevice();
  if (!d) return null;
  return {
    product: d.product ?? null,
    manufacturer: d.manufacturer ?? null,
    vendorId: d.vendorId,
    productId: d.productId,
  };
}

// Open the DSP 206. Throws if not present or already owned by another program.
export function openDevice(): DspHandle {
  const info = findDevice();
  if (!info?.path) {
    throw new Error('DSP 206 not found (is it connected and the official editor closed?)');
  }
  const device = new HID.HID(info.path);
  let closed = false;

  device.on('data', () => {}); // ensure the read loop starts

  return {
    write(frame) {
      if (closed) return;
      device.write(toReport(frame));
    },
    onFrame(cb) {
      device.on('data', (data) => cb([...data]));
    },
    onError(cb) {
      device.on('error', (e) => cb(e instanceof Error ? e : new Error(String(e))));
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        device.close();
      } catch {
        // already gone — nothing to release
      }
    },
  };
}

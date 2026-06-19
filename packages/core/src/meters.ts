// Meter read path. §7 — the 0x40 keepalive response carries 12 groups of [float16 LE level, peak].
// The 206's real channels map to groups [0,1,4,5,6,7,8,9] = In A, In B, Out 1..Out 6.

export const METER_GROUPS = 12;
export const DISPLAY_GROUP_MAP = [0, 1, 4, 5, 6, 7, 8, 9] as const; // In A, In B, Out 1..6

export function decodeFloat16(low: number, high: number): number {
  const v = low | (high << 8);
  const sign = (v >> 15) & 1;
  const exp = (v >> 10) & 0x1f;
  const mant = v & 0x3ff;
  let r: number;
  if (exp === 0) r = (mant / 1024) * 2 ** -14;
  else if (exp === 31) r = mant === 0 ? Infinity : NaN;
  else r = (1 + mant / 1024) * 2 ** (exp - 15);
  return sign ? -r : r;
}

// A response meter frame: 10 02 01 00 ... 40 ... (frame[2]==0x01 && frame[5]==0x40).
export function isMeterFrame(frame: number[]): boolean {
  return frame[2] === 0x01 && frame[5] === 0x40;
}

// Decode all 12 groups (3 bytes each from offset 6). Non-finite → 0.
export function parseMeters(frame: number[], groups = METER_GROUPS): number[] {
  const out: number[] = [];
  for (let g = 0; g < groups; g++) {
    const o = 6 + g * 3;
    if (o + 1 >= frame.length) break;
    const v = decodeFloat16(frame[o], frame[o + 1]);
    out.push(Number.isFinite(v) ? v : 0);
  }
  return out;
}

// Just the 8 display channels (In A, In B, Out 1..6).
export function parseDisplayMeters(frame: number[]): number[] {
  const all = parseMeters(frame);
  return DISPLAY_GROUP_MAP.map((g) => all[g] ?? 0);
}

import { describe, it, expect } from 'vitest';
import { meterDbfs, statusOf, limiterActivity } from '../src/health';

describe('health', () => {
  it('maps level to dBFS', () => {
    expect(meterDbfs(1)).toBeCloseTo(0, 5);
    expect(meterDbfs(0.5)).toBeCloseTo(-6.02, 1);
    expect(meterDbfs(0)).toBe(-90);
  });

  it('classifies clip / warning / safe by level', () => {
    expect(statusOf(1.0)).toBe('clip');
    expect(statusOf(0.6)).toBe('warning'); // ~-4.4 dBFS
    expect(statusOf(0.2)).toBe('safe'); // ~-14 dBFS
  });

  it('infers limiter activity from level above threshold', () => {
    expect(limiterActivity(0.5, -6)).toBe(0); // exactly at threshold
    expect(limiterActivity(1.0, -6)).toBeCloseTo(0.5, 1); // ~6 dB over / 12
    expect(limiterActivity(0.1, -6)).toBe(0); // below threshold
  });
});

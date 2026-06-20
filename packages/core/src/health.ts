// System-health derivation for the Safety/Party views. Pure; shared with the iPad.
// NOTE on honesty: the DSP reports signal LEVELS only. Clip/warning are real (from the meter),
// but limiter activity and thermal are INFERRED from level vs the user's threshold — present them
// as estimates, never as device telemetry.

export type HealthStatus = 'safe' | 'warning' | 'clip';

export const meterDbfs = (level: number): number =>
  level <= 0 ? -90 : Math.max(-90, 20 * Math.log10(level));

export function statusOf(level: number): HealthStatus {
  const db = meterDbfs(level);
  if (db >= -0.5) return 'clip';
  if (db >= -6) return 'warning';
  return 'safe';
}

// Inferred limiter activity 0..1: how far the level sits above the set threshold (12 dB = full).
export function limiterActivity(level: number, threshDb: number): number {
  const over = meterDbfs(level) - threshDb;
  return Math.max(0, Math.min(1, over / 12));
}

// Heuristic thermal estimate 0..1 from a set of output levels (sustained loudness proxy).
export function thermalEstimate(levels: number[]): number {
  if (levels.length === 0) return 0;
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  return Math.max(0, Math.min(1, avg));
}

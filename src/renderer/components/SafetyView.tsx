import { useStore, CHANNELS } from '../store';
import { meterDbfs, statusOf, limiterActivity, thermalEstimate, type HealthStatus } from '@z3r0/core';

const OUTPUTS = [2, 3, 4, 5, 6, 7];
const STATUS_LABEL: Record<HealthStatus, string> = { safe: 'SAFE', warning: 'WARNING', clip: 'CLIPPING' };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="safety-stat">
      <span className="safety-stat-label">
        {label}
        {sub && <em> · {sub}</em>}
      </span>
      <span className="safety-stat-value">{value}</span>
    </div>
  );
}

export function SafetyView() {
  const meters = useStore((s) => s.meters);
  const channels = useStore((s) => s.channels);
  const levels = OUTPUTS.map((ch) => meters[ch] ?? 0);
  const peak = Math.max(-90, ...levels.map(meterDbfs));
  const activity =
    levels.reduce((a, l, i) => a + limiterActivity(l, channels[OUTPUTS[i]].limiter.threshDb), 0) / OUTPUTS.length;
  const thermal = thermalEstimate(levels);

  return (
    <div className="safety">
      <div className="safety-stats">
        <Stat label="Highest peak" value={`${peak.toFixed(1)} dBFS`} />
        <Stat label="Limiter activity" sub="estimated" value={`${Math.round(activity * 100)}%`} />
        <Stat label="Thermal" sub="estimated" value={thermal > 0.8 ? 'High' : thermal > 0.5 ? 'Medium' : 'Low'} />
      </div>
      <div className="safety-rows">
        {OUTPUTS.map((ch, i) => {
          const db = meterDbfs(levels[i]);
          const st = statusOf(levels[i]);
          const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
          return (
            <div key={ch} className="safety-row">
              <span className="safety-name">{CHANNELS[ch]}</span>
              <div className="safety-bar">
                <div className={`safety-bar-fill ${st}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="safety-db">{db <= -90 ? '—' : `${db.toFixed(1)} dB`}</span>
              <span className={`safety-status ${st}`}>{STATUS_LABEL[st]}</span>
            </div>
          );
        })}
      </div>
      <p className="safety-note">
        Clip and warning come from the live output meters. Limiter activity and thermal are
        estimates inferred from level vs. your settings — not device telemetry.
      </p>
    </div>
  );
}

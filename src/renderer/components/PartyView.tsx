import { useStore, CHANNELS } from '../store';
import { meterDbfs, statusOf, type HealthStatus } from '@z3r0/core';

const OUTPUTS = [2, 3, 4, 5, 6, 7];
const STATUS_LABEL: Record<HealthStatus, string> = { safe: 'SAFE', warning: 'WARNING', clip: 'CLIPPING' };
const rank: Record<HealthStatus, number> = { safe: 0, warning: 1, clip: 2 };

export function PartyView() {
  const meters = useStore((s) => s.meters);
  const levels = OUTPUTS.map((ch) => meters[ch] ?? 0);
  const worst = levels.map(statusOf).reduce<HealthStatus>((w, s) => (rank[s] > rank[w] ? s : w), 'safe');

  return (
    <div className="party">
      <div className="party-bars">
        {OUTPUTS.map((ch, i) => {
          const db = meterDbfs(levels[i]);
          const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
          const st = statusOf(levels[i]);
          return (
            <div key={ch} className="party-col">
              <div className="party-meter">
                <div className={`party-fill ${st}`} style={{ height: `${pct}%` }} />
              </div>
              <span className="party-name">{CHANNELS[ch]}</span>
              <span className="party-db">{db <= -90 ? '—' : db.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
      <div className={`party-status ${worst}`}>{STATUS_LABEL[worst]}</div>
    </div>
  );
}

import { View, Text, StyleSheet } from 'react-native';
import { useStore, CHANNELS } from '../store';
import { meterDbfs, statusOf, limiterActivity, thermalEstimate, type HealthStatus } from '@z3r0/core';
import { theme } from '../theme';

const OUTPUTS = [2, 3, 4, 5, 6, 7];
const STATUS_LABEL: Record<HealthStatus, string> = { safe: 'SAFE', warning: 'WARNING', clip: 'CLIPPING' };
const COLOR: Record<HealthStatus, string> = { safe: theme.safe, warning: theme.warn, clip: theme.clip };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>
        {label}
        {sub ? <Text style={styles.statSub}> · {sub}</Text> : null}
      </Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
    <View style={styles.root}>
      <View style={styles.stats}>
        <Stat label="Highest peak" value={`${peak.toFixed(1)} dBFS`} />
        <Stat label="Limiter activity" sub="estimated" value={`${Math.round(activity * 100)}%`} />
        <Stat label="Thermal" sub="estimated" value={thermal > 0.8 ? 'High' : thermal > 0.5 ? 'Medium' : 'Low'} />
      </View>
      <View style={styles.rows}>
        {OUTPUTS.map((ch, i) => {
          const db = meterDbfs(levels[i]);
          const st = statusOf(levels[i]);
          const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
          return (
            <View key={ch} style={styles.row}>
              <Text style={styles.name}>{CHANNELS[ch]}</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: COLOR[st] }]} />
              </View>
              <Text style={styles.db}>{db <= -90 ? '—' : `${db.toFixed(1)} dB`}</Text>
              <Text style={[styles.status, { color: COLOR[st] }]}>{STATUS_LABEL[st]}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>
        Clip and warning come from the live output meters. Limiter activity and thermal are estimates inferred from
        level vs. your settings — not device telemetry.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 14,
    gap: 6,
  },
  statLabel: { color: theme.dim, fontSize: 13 },
  statSub: { color: theme.dim, fontStyle: 'italic' },
  statValue: { color: theme.text, fontSize: 26, fontWeight: '600' },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: theme.text, width: 56, fontSize: 14 },
  bar: {
    flex: 1,
    height: 16,
    backgroundColor: theme.panel2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    overflow: 'hidden',
  },
  barFill: { height: '100%' },
  db: { color: theme.dim, width: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
  status: { width: 76, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  note: { color: theme.dim, fontSize: 12, lineHeight: 17 },
});

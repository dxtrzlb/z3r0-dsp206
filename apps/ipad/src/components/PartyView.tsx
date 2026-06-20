import { View, Text, StyleSheet } from 'react-native';
import { useStore, CHANNELS } from '../store';
import { meterDbfs, statusOf, type HealthStatus } from '@z3r0/core';
import { theme } from '../theme';

const OUTPUTS = [2, 3, 4, 5, 6, 7];
const STATUS_LABEL: Record<HealthStatus, string> = { safe: 'SAFE', warning: 'WARNING', clip: 'CLIPPING' };
const COLOR: Record<HealthStatus, string> = { safe: theme.safe, warning: theme.warn, clip: theme.clip };
const rank: Record<HealthStatus, number> = { safe: 0, warning: 1, clip: 2 };

export function PartyView() {
  const meters = useStore((s) => s.meters);
  const levels = OUTPUTS.map((ch) => meters[ch] ?? 0);
  const worst = levels.map(statusOf).reduce<HealthStatus>((w, s) => (rank[s] > rank[w] ? s : w), 'safe');

  return (
    <View style={styles.root}>
      <View style={styles.bars}>
        {OUTPUTS.map((ch, i) => {
          const db = meterDbfs(levels[i]);
          const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
          const st = statusOf(levels[i]);
          return (
            <View key={ch} style={styles.col}>
              <View style={styles.meter}>
                <View style={[styles.fill, { height: `${pct}%`, backgroundColor: COLOR[st] }]} />
              </View>
              <Text style={styles.name}>{CHANNELS[ch]}</Text>
              <Text style={styles.db}>{db <= -90 ? '—' : db.toFixed(0)}</Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.statusBanner, { backgroundColor: COLOR[worst] }]}>
        <Text style={styles.statusText}>{STATUS_LABEL[worst]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
  bars: { flex: 1, flexDirection: 'row', gap: 16, justifyContent: 'space-around' },
  col: { flex: 1, alignItems: 'center', gap: 8 },
  meter: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.panel2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.line,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%' },
  name: { color: theme.text, fontSize: 16, fontWeight: '600' },
  db: { color: theme.dim, fontSize: 14, fontVariant: ['tabular-nums'] },
  statusBanner: { borderRadius: 14, paddingVertical: 24, alignItems: 'center' },
  statusText: { color: theme.bg, fontSize: 40, fontWeight: '800', letterSpacing: 2 },
});

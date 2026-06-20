import { View, StyleSheet } from 'react-native';
import { meterDbfs, statusOf, type HealthStatus } from '@z3r0/core';
import { theme } from '../theme';

const COLOR: Record<HealthStatus, string> = { safe: theme.safe, warning: theme.warn, clip: theme.clip };

// Linear level (0..1) → dBFS bar, filled from the bottom, colored by clip/warn/safe status.
export function Meter({ level }: { level: number }) {
  const db = meterDbfs(level);
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { height: `${pct}%`, backgroundColor: COLOR[statusOf(level)] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 12,
    flex: 1,
    backgroundColor: theme.panel2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.line,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%' },
});

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { theme } from '../theme';

const OUTS = [2, 3, 4, 5, 6, 7];

// In A / In B / A+B routed to each of the 6 outputs (bitmask: In A = 1, In B = 2).
export function RoutingMatrix() {
  const channels = useStore((s) => s.channels);
  const setRoute = useStore((s) => s.setRoute);

  const maskOf = (out: number): number => channels[out].routeMask;
  const toggle = (out: number, inIdx: number): void =>
    setRoute(out, inIdx, (maskOf(out) & (inIdx === 0 ? 1 : 2)) === 0);
  const toggleSum = (out: number): void => {
    const both = (maskOf(out) & 3) === 3;
    setRoute(out, 0, !both);
    setRoute(out, 1, !both);
  };

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <Text style={styles.rowLabel} />
        {OUTS.map((o) => (
          <Text key={o} style={styles.colLabel}>
            O{o - 1}
          </Text>
        ))}
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>In A</Text>
        {OUTS.map((o) => (
          <Pressable key={o} style={[styles.node, maskOf(o) & 1 ? styles.on : null]} onPress={() => toggle(o, 0)} />
        ))}
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>In B</Text>
        {OUTS.map((o) => (
          <Pressable key={o} style={[styles.node, maskOf(o) & 2 ? styles.on : null]} onPress={() => toggle(o, 1)} />
        ))}
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>A+B</Text>
        {OUTS.map((o) => (
          <Pressable
            key={o}
            style={[styles.node, (maskOf(o) & 3) === 3 ? styles.on : null]}
            onPress={() => toggleSum(o)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { width: 36, color: theme.dim, fontSize: 12 },
  colLabel: { flex: 1, textAlign: 'center', color: theme.dim, fontSize: 11 },
  node: { flex: 1, height: 30, borderRadius: 8, backgroundColor: theme.panel2, borderWidth: 1, borderColor: theme.line },
  on: { backgroundColor: theme.accent, borderColor: theme.accent },
});

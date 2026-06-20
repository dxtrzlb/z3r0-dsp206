import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { Slider } from './Slider';
import { theme } from '../theme';

// Per-channel delay (0..683 ms, the device maximum). Mirrors the desktop DelayTab: a slider for
// the time plus a readout of the equivalent distance in metres and feet (speed of sound 343 m/s).
export function DelayEditor({ ch }: { ch: number }) {
  const ms = useStore((s) => s.channels[ch].delayMs);
  const setDelay = useStore((s) => s.setDelay);

  const metres = (ms / 1000) * 343;
  const feet = metres * 3.28084;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Delay</Text>
      <Slider
        label="Time"
        value={ms}
        min={0}
        max={683}
        step={0.05}
        unit=" ms"
        onChange={(v) => setDelay(ch, Number(v.toFixed(2)))}
      />
      <View style={styles.readout}>
        <Text style={styles.readVal}>{ms.toFixed(2)} ms</Text>
        <Text style={styles.readVal}>{metres.toFixed(2)} m</Text>
        <Text style={styles.readVal}>{feet.toFixed(2)} ft</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
  },
  title: { color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  readout: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  readVal: { color: theme.dim, fontSize: 12, fontVariant: ['tabular-nums'] },
});

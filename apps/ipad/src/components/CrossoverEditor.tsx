import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SLOPE_LADDER } from '@z3r0/core';
import { useStore } from '../store';
import { theme } from '../theme';

// Crossover tab ported from the desktop OutputEditor's XoverTab: a High-pass and a Low-pass
// section, each with an on/off toggle, a frequency control, and a slope selector that shows the
// SLOPE_LADDER label (e.g. "BW-24"). Writes through setHpf / setLpf. No shared Slider is used —
// frequency and slope are stepped inline with Pressables.

const FREQ_MIN = 20;
const FREQ_MAX = 20000;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const fmtHz = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 2)} kHz` : `${hz} Hz`);

// Nudge a frequency by ~1/12 octave per press so the full range is reachable in sensible steps.
const stepFreq = (hz: number, dir: 1 | -1): number =>
  Math.round(clamp(hz * Math.pow(2, dir / 12), FREQ_MIN, FREQ_MAX));

type XoverPatch = Partial<{ hz: number; on: boolean; slope: number }>;

function XoverBand({
  kind,
  band,
  set,
}: {
  kind: 'hpf' | 'lpf';
  band: { hz: number; on: boolean; slope: number };
  set: (patch: XoverPatch) => void;
}) {
  const slope = SLOPE_LADDER[band.slope] ?? SLOPE_LADDER[0];
  const label = kind === 'hpf' ? 'High-pass' : 'Low-pass';

  return (
    <View style={styles.band}>
      <View style={styles.head}>
        <Text style={styles.title}>{label}</Text>
        <Pressable
          style={[styles.toggle, band.on && styles.toggleOn]}
          onPress={() => set({ on: !band.on })}
        >
          <Text style={[styles.toggleText, band.on && styles.toggleTextOn]}>
            {band.on ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Freq</Text>
        <Pressable style={styles.step} onPress={() => set({ hz: stepFreq(band.hz, -1) })}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{fmtHz(band.hz)}</Text>
        <Pressable style={styles.step} onPress={() => set({ hz: stepFreq(band.hz, 1) })}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Slope</Text>
        <Pressable
          style={styles.step}
          onPress={() => set({ slope: clamp(band.slope - 1, 0, SLOPE_LADDER.length - 1) })}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{slope.label}</Text>
        <Pressable
          style={styles.step}
          onPress={() => set({ slope: clamp(band.slope + 1, 0, SLOPE_LADDER.length - 1) })}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CrossoverEditor({ ch }: { ch: number }) {
  const hpf = useStore((s) => s.channels[ch].hpf);
  const lpf = useStore((s) => s.channels[ch].lpf);
  const setHpf = useStore((s) => s.setHpf);
  const setLpf = useStore((s) => s.setLpf);

  return (
    <View style={styles.wrap}>
      <XoverBand kind="hpf" band={hpf} set={(patch) => setHpf(ch, patch)} />
      <XoverBand kind="lpf" band={lpf} set={(patch) => setLpf(ch, patch)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12 },
  band: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    gap: 12,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: theme.text, fontSize: 14, fontWeight: '700' },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.panel2,
  },
  toggleOn: { backgroundColor: 'rgba(76,194,255,0.18)', borderColor: theme.accent },
  toggleText: { color: theme.dim, fontSize: 12, fontWeight: '800' },
  toggleTextOn: { color: theme.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { color: theme.dim, fontSize: 12, width: 44 },
  step: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: theme.text, fontSize: 20, fontWeight: '700', lineHeight: 22 },
  value: {
    flex: 1,
    textAlign: 'center',
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

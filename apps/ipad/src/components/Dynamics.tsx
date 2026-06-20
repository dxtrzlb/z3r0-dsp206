import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RATIO_LADDER } from '@z3r0/core';
import { useStore, isInput } from '../store';
import { Slider } from './Slider';
import { theme } from '../theme';

// Dynamics editor. Output channels get a Limiter + Compressor; input channels get a Gate.
// Mirrors the desktop OutputEditor DynTab / GateTab, driven through the same store actions.
export function Dynamics({ ch }: { ch: number }) {
  return isInput(ch) ? <GateSection ch={ch} /> : <OutputDynamics ch={ch} />;
}

function OutputDynamics({ ch }: { ch: number }) {
  return (
    <View style={styles.cols}>
      <LimiterSection ch={ch} />
      <CompressorSection ch={ch} />
    </View>
  );
}

function LimiterSection({ ch }: { ch: number }) {
  const limiter = useStore((s) => s.channels[ch].limiter);
  const setLimiter = useStore((s) => s.setLimiter);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Limiter</Text>
      <Slider
        label="Thresh"
        value={limiter.threshDb}
        min={-40}
        max={0}
        step={0.5}
        unit=" dB"
        onChange={(threshDb) => setLimiter(ch, { threshDb })}
      />
      <Slider
        label="Attack"
        value={limiter.attackMs}
        min={1}
        max={100}
        step={1}
        unit=" ms"
        onChange={(attackMs) => setLimiter(ch, { attackMs })}
      />
      <Slider
        label="Release"
        value={limiter.releaseMs}
        min={10}
        max={1000}
        step={10}
        unit=" ms"
        onChange={(releaseMs) => setLimiter(ch, { releaseMs })}
      />
    </View>
  );
}

function CompressorSection({ ch }: { ch: number }) {
  const comp = useStore((s) => s.channels[ch].compressor);
  const setCompressor = useStore((s) => s.setCompressor);
  const ratioLabel = RATIO_LADDER[comp.ratio] ?? RATIO_LADDER[0];
  const stepRatio = (dir: number): void => {
    const next = Math.max(0, Math.min(RATIO_LADDER.length - 1, comp.ratio + dir));
    if (next !== comp.ratio) setCompressor(ch, { ratio: next });
  };
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Compressor</Text>
      <View style={styles.ratioRow}>
        <Text style={styles.ratioLabel}>Ratio</Text>
        <Pressable style={styles.step} onPress={() => stepRatio(-1)}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.ratioValue}>{ratioLabel}</Text>
        <Pressable style={styles.step} onPress={() => stepRatio(1)}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <Slider
        label="Thresh"
        value={comp.threshDb}
        min={-60}
        max={0}
        step={0.5}
        unit=" dB"
        onChange={(threshDb) => setCompressor(ch, { threshDb })}
      />
      <Slider
        label="Knee"
        value={comp.kneeDb}
        min={0}
        max={12}
        step={0.5}
        unit=" dB"
        onChange={(kneeDb) => setCompressor(ch, { kneeDb })}
      />
      <Slider
        label="Attack"
        value={comp.attackMs}
        min={1}
        max={100}
        step={1}
        unit=" ms"
        onChange={(attackMs) => setCompressor(ch, { attackMs })}
      />
      <Slider
        label="Release"
        value={comp.releaseMs}
        min={10}
        max={1000}
        step={10}
        unit=" ms"
        onChange={(releaseMs) => setCompressor(ch, { releaseMs })}
      />
    </View>
  );
}

function GateSection({ ch }: { ch: number }) {
  const gate = useStore((s) => s.channels[ch].gate);
  const setGate = useStore((s) => s.setGate);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Gate</Text>
      <Slider
        label="Thresh"
        value={gate.threshDb}
        min={-80}
        max={0}
        step={0.5}
        unit=" dB"
        onChange={(threshDb) => setGate(ch, { threshDb })}
      />
      <Slider
        label="Attack"
        value={gate.attackMs}
        min={1}
        max={100}
        step={1}
        unit=" ms"
        onChange={(attackMs) => setGate(ch, { attackMs })}
      />
      <Slider
        label="Hold"
        value={gate.holdMs}
        min={1}
        max={1000}
        step={10}
        unit=" ms"
        onChange={(holdMs) => setGate(ch, { holdMs })}
      />
      <Slider
        label="Release"
        value={gate.releaseMs}
        min={10}
        max={1000}
        step={10}
        unit=" ms"
        onChange={(releaseMs) => setGate(ch, { releaseMs })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 12 },
  section: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
  },
  title: { color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  ratioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  ratioLabel: { color: theme.dim, fontSize: 12, flex: 1 },
  ratioValue: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 52,
    textAlign: 'center',
  },
  step: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: theme.accent, fontSize: 18, fontWeight: '700' },
});

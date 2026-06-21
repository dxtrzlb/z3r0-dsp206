import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { theme } from '../theme';

// Vertical touch fader. The thumb tracks the finger immediately (optimistic `local`), while onChange
// is dispatched throttled (trailing-edge) so a drag doesn't flood the link — the final value lands.
export function Fader({
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const range = max - min;
  const [height, setHeight] = useState(1);
  const [local, setLocal] = useState<number | null>(null);
  const heightRef = useRef(1);
  const startRef = useRef(value);
  const shownRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const dispatch = useThrottledCallback(onChange, 40);
  const dispatchRef = useRef(dispatch);
  heightRef.current = height;
  onCommitRef.current = onCommit;
  dispatchRef.current = dispatch;

  const shown = local ?? value;
  shownRef.current = shown;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          startRef.current = shownRef.current;
        })
        .onUpdate((e) => {
          const next = Math.max(
            min,
            Math.min(max, startRef.current - (e.translationY / heightRef.current) * range),
          );
          setLocal(next);
          dispatchRef.current(next);
        })
        .onEnd(() => {
          setLocal(null);
          onCommitRef.current?.();
        }),
    [min, max, range],
  );

  const pct = ((shown - min) / range) * 100;
  const label = shown > 0 ? `+${shown.toFixed(1)}` : shown.toFixed(1);
  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  return (
    <View style={styles.col}>
      <Text style={styles.val}>{label}</Text>
      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={onLayout}>
          <View style={[styles.fill, { height: `${pct}%` }]} />
          <View style={[styles.thumb, { bottom: `${pct}%` }]} />
        </View>
      </GestureDetector>
      <Text style={styles.unit}>dB</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: 'center', flex: 1 },
  val: { color: theme.text, fontSize: 12, fontVariant: ['tabular-nums'], marginBottom: 4 },
  track: {
    flex: 1,
    width: 36,
    backgroundColor: theme.panel2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.line,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', backgroundColor: 'rgba(76,194,255,0.25)' },
  thumb: {
    position: 'absolute',
    left: 2,
    right: 2,
    height: 14,
    marginBottom: -7,
    borderRadius: 7,
    backgroundColor: theme.accent,
  },
  unit: { color: theme.dim, fontSize: 10, marginTop: 4 },
});

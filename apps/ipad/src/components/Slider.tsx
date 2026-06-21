import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { theme } from '../theme';

// Reusable horizontal value slider. Tracks the finger immediately (optimistic `local`) and dispatches
// onChange throttled (trailing-edge), so dragging a control doesn't flood the link.
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onCommit,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const range = max - min;
  const [width, setWidth] = useState(1);
  const [local, setLocal] = useState<number | null>(null);
  const widthRef = useRef(1);
  const startRef = useRef(value);
  const shownRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const dispatch = useThrottledCallback(onChange, 40);
  const dispatchRef = useRef(dispatch);
  widthRef.current = width;
  onCommitRef.current = onCommit;
  dispatchRef.current = dispatch;

  const quantize = (v: number): number => {
    const clamped = Math.max(min, Math.min(max, v));
    return step ? Math.round(clamped / step) * step : clamped;
  };

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
          const next = quantize(startRef.current + (e.translationX / widthRef.current) * range);
          setLocal(next);
          dispatchRef.current(next);
        })
        .onEnd(() => {
          setLocal(null);
          onCommitRef.current?.();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, range, step],
  );

  const pct = Math.max(0, Math.min(100, ((shown - min) / range) * 100));
  const decimals = step && step < 1 ? 1 : 0;
  const text = `${shown.toFixed(decimals)}${unit ?? ''}`;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        {label != null && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.val}>{text}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={onLayout}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
          <View style={[styles.thumb, { left: `${pct}%` }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', marginVertical: 6 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: theme.dim, fontSize: 12 },
  val: { color: theme.text, fontSize: 12, fontVariant: ['tabular-nums'] },
  track: {
    height: 28,
    backgroundColor: theme.panel2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(76,194,255,0.25)' },
  thumb: {
    position: 'absolute',
    width: 14,
    top: 2,
    bottom: 2,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: theme.accent,
  },
});

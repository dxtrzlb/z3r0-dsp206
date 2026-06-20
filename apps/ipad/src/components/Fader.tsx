import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { theme } from '../theme';

// Vertical touch fader. A Pan gesture maps drag distance (up = louder) to the value range.
// runOnJS(true) keeps the handlers on the JS thread, so no reanimated dependency is needed.
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
  const heightRef = useRef(1);
  const valueRef = useRef(value);
  const startRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  heightRef.current = height;
  valueRef.current = value;
  onChangeRef.current = onChange;
  onCommitRef.current = onCommit;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          startRef.current = valueRef.current;
        })
        .onUpdate((e) => {
          const next = startRef.current - (e.translationY / heightRef.current) * range;
          onChangeRef.current(Math.max(min, Math.min(max, next)));
        })
        .onEnd(() => onCommitRef.current?.()),
    [min, max, range],
  );

  const pct = ((value - min) / range) * 100;
  const label = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
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

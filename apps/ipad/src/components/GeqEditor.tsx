import { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useStore } from '../store';
import { theme } from '../theme';

const BANDS = 31;
const RANGE = 12; // ±dB

// 31-band graphic EQ (inputs). A single pan over the strip sets the band under the finger from
// its vertical position; center line = 0 dB. Throttled so we don't flood the socket.
export function GeqEditor({ ch }: { ch: number }) {
  const geq = useStore((s) => s.channels[ch].geq);
  const setGeqBand = useStore((s) => s.setGeqBand);

  const sizeRef = useRef({ w: 1, h: 1 });
  const last = useRef(0);
  const setRef = useRef(setGeqBand);
  const chRef = useRef(ch);
  setRef.current = setGeqBand;
  chRef.current = ch;

  const apply = (x: number, y: number) => {
    const { w, h } = sizeRef.current;
    const band = Math.max(0, Math.min(BANDS - 1, Math.floor((x / w) * BANDS)));
    const db = Math.max(-RANGE, Math.min(RANGE, (0.5 - y / h) * 2 * RANGE));
    const now = Date.now();
    if (now - last.current > 30) {
      last.current = now;
      setRef.current(chRef.current, band, Number(db.toFixed(1)));
    }
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin((e) => apply(e.x, e.y))
        .onUpdate((e) => apply(e.x, e.y)),
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    sizeRef.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Graphic EQ · 31 band</Text>
      <Text style={styles.hint}>Drag across the bands to shape. Center line = 0 dB (±{RANGE}).</Text>
      <GestureDetector gesture={pan}>
        <View style={styles.strip} onLayout={onLayout}>
          <View style={styles.midline} />
          {Array.from({ length: BANDS }, (_, i) => {
            const db = geq[i] ?? 0;
            const half = Math.max(-50, Math.min(50, (db / RANGE) * 50));
            return (
              <View key={i} style={styles.slot}>
                <View
                  style={[
                    styles.bar,
                    half >= 0 ? { bottom: '50%', height: `${half}%` } : { top: '50%', height: `${-half}%` },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  title: { color: theme.text, fontSize: 14, fontWeight: '700' },
  hint: { color: theme.dim, fontSize: 11 },
  strip: {
    height: 180,
    flexDirection: 'row',
    backgroundColor: theme.panel2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  midline: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: theme.line },
  slot: { flex: 1, marginHorizontal: 1 },
  bar: { position: 'absolute', left: 1, right: 1, backgroundColor: theme.accent, borderRadius: 2 },
});

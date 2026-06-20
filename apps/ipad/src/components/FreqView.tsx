import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path, Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { channelResponseDb, logFreqs, freqToPos, posToFreq } from '@z3r0/core';
import { useStore } from '../store';
import { theme } from '../theme';

// SVG frequency-response graph ported from the desktop renderer's FreqView. Log x (20 Hz–20 kHz),
// linear y in dB. The combined channel response is one Path; each PEQ band is a draggable node.
// react-native-svg children can't take RN gestures directly, so a transparent overlay View hosts
// a single Gesture.Pan().runOnJS(true) (same ref + onLayout pattern as Fader) and maps the touch
// to the nearest band on grab, then writes hz/gainDb back through setPeqBand.

const PAD = { l: 34, r: 12, t: 12, b: 20 };
const DB_MAX = 18;
const DB_MIN = -18;
const GAIN_CLAMP = 12;

const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const DB_TICKS = [12, 6, 0, -6, -12];
const SAMPLES = logFreqs(180);

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const fmtHz = (hz: number): string => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);

export function FreqView({ ch }: { ch: number }) {
  const channel = useStore((s) => s.channels[ch]);
  const setPeqBand = useStore((s) => s.setPeqBand);

  const [sel, setSel] = useState(0);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const peqRef = useRef(channel.peq);
  peqRef.current = channel.peq;
  const dragBand = useRef(0);

  const plot = useMemo(() => {
    const w = size.w;
    const h = size.h;
    const x0 = PAD.l;
    const x1 = w - PAD.r;
    const y0 = PAD.t;
    const y1 = h - PAD.b;
    const xFor = (hz: number): number => x0 + freqToPos(hz) * (x1 - x0);
    const yFor = (db: number): number => y0 + ((DB_MAX - db) / (DB_MAX - DB_MIN)) * (y1 - y0);
    return { x0, x1, y0, y1, xFor, yFor };
  }, [size]);

  const curve = useMemo(() => {
    const ys = channelResponseDb(channel, SAMPLES);
    return SAMPLES.map(
      (f, i) =>
        `${i === 0 ? 'M' : 'L'}${plot.xFor(f).toFixed(1)},${plot.yFor(clamp(ys[i], DB_MIN, DB_MAX)).toFixed(1)}`,
    ).join(' ');
  }, [channel, plot]);

  // Map an absolute touch (x,y in pixels within the overlay) to hz/gainDb and commit to a band.
  const writeFromTouch = (band: number, x: number, y: number) => {
    const { x0, x1, y0, y1 } = plot;
    const pos = clamp((x - x0) / Math.max(1, x1 - x0), 0, 1);
    const hz = Math.round(clamp(posToFreq(pos), 20, 20000));
    const dbRaw = DB_MAX - ((y - y0) / Math.max(1, y1 - y0)) * (DB_MAX - DB_MIN);
    const gainDb = clamp(Math.round(dbRaw * 10) / 10, -GAIN_CLAMP, GAIN_CLAMP);
    setPeqBand(ch, band, { hz, gainDb });
  };

  // Pick the active band whose node is nearest the grab point (ignoring bypassed bands).
  const nearestBand = (x: number, y: number): number => {
    let best = -1;
    let bestD = Infinity;
    peqRef.current.forEach((b, i) => {
      if (b.bypass) return;
      const dx = plot.xFor(b.hz) - x;
      const dy = plot.yFor(b.gainDb) - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin((e) => {
          const band = nearestBand(e.x, e.y);
          if (band < 0) return;
          dragBand.current = band;
          setSel(band);
          writeFromTouch(band, e.x, e.y);
        })
        .onUpdate((e) => writeFromTouch(dragBand.current, e.x, e.y)),
    [plot],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const band = channel.peq[sel];
  const color = theme.accent;

  const setQ = (mult: number) => {
    if (!band) return;
    setPeqBand(ch, sel, { q: clamp(+(band.q * mult).toFixed(2), 0.4, 24) });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.graph} onLayout={onLayout}>
        <Svg width="100%" height="100%">
          <Rect
            x={plot.x0}
            y={plot.y0}
            width={plot.x1 - plot.x0}
            height={plot.y1 - plot.y0}
            fill={theme.panel2}
            rx={6}
          />
          {FREQ_TICKS.map((f) => (
            <Line
              key={`g${f}`}
              x1={plot.xFor(f)}
              x2={plot.xFor(f)}
              y1={plot.y0}
              y2={plot.y1}
              stroke={theme.line}
              strokeWidth={1}
            />
          ))}
          {DB_TICKS.map((d) => (
            <Line
              key={`h${d}`}
              x1={plot.x0}
              x2={plot.x1}
              y1={plot.yFor(d)}
              y2={plot.yFor(d)}
              stroke={d === 0 ? theme.dim : theme.line}
              strokeWidth={1}
            />
          ))}
          {FREQ_TICKS.map((f) => (
            <SvgText
              key={`fl${f}`}
              x={plot.xFor(f)}
              y={size.h - 6}
              fill={theme.dim}
              fontSize={9}
              textAnchor="middle"
            >
              {fmtHz(f)}
            </SvgText>
          ))}
          {DB_TICKS.map((d) => (
            <SvgText key={`dl${d}`} x={4} y={plot.yFor(d) + 3} fill={theme.dim} fontSize={9}>
              {d > 0 ? `+${d}` : `${d}`}
            </SvgText>
          ))}

          <Path d={curve} stroke={color} strokeWidth={2} fill="none" />

          {channel.peq.map((b, i) =>
            b.bypass ? null : (
              <Circle
                key={`n${i}`}
                cx={plot.xFor(b.hz)}
                cy={plot.yFor(b.gainDb)}
                r={i === sel ? 11 : 9}
                fill={color}
                stroke={i === sel ? theme.text : 'transparent'}
                strokeWidth={2}
              />
            ),
          )}
          {channel.peq.map((b, i) =>
            b.bypass ? null : (
              <SvgText
                key={`t${i}`}
                x={plot.xFor(b.hz)}
                y={plot.yFor(b.gainDb) + 3}
                fill={theme.bg}
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
              >
                {i + 1}
              </SvgText>
            ),
          )}
        </Svg>
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      </View>

      <View style={styles.controls}>
        <Text style={styles.selLabel}>Band {sel + 1}</Text>
        {band ? (
          <>
            <Text style={styles.readout}>
              {band.hz} Hz · {band.gainDb > 0 ? `+${band.gainDb.toFixed(1)}` : band.gainDb.toFixed(1)} dB
            </Text>
            <View style={styles.qRow}>
              <Text style={styles.qLabel}>Q {band.q.toFixed(2)}</Text>
              <Pressable style={styles.btn} onPress={() => setQ(0.9)}>
                <Text style={styles.btnText}>Q−</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => setQ(1.1)}>
                <Text style={styles.btnText}>Q+</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, band.bypass && styles.btnOff]}
                onPress={() => setPeqBand(ch, sel, { bypass: !band.bypass })}
              >
                <Text style={[styles.btnText, band.bypass && styles.btnTextOff]}>
                  {band.bypass ? 'Bypassed' : 'Active'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 8 },
  graph: {
    flex: 1,
    minHeight: 180,
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    overflow: 'hidden',
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  selLabel: { color: theme.text, fontSize: 13, fontWeight: '700' },
  readout: { color: theme.dim, fontSize: 12, fontVariant: ['tabular-nums'] },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  qLabel: { color: theme.text, fontSize: 12, fontVariant: ['tabular-nums'] },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.panel2,
  },
  btnOff: { borderColor: theme.warn },
  btnText: { color: theme.text, fontSize: 12, fontWeight: '700' },
  btnTextOff: { color: theme.warn },
});

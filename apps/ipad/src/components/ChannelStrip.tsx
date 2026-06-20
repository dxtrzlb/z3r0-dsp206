import { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useStore, CHANNELS, isInput } from '../store';
import { Meter } from './Meter';
import { Fader } from './Fader';
import { theme } from '../theme';

// One channel: name + IN/OUT tag, live meter beside a gain fader, and a mute button.
// Tapping the strip selects the channel (for the detail editor in a later step).
export function ChannelStrip({ ch }: { ch: number }) {
  const gainDb = useStore((s) => s.channels[ch].gainDb);
  const muted = useStore((s) => s.channels[ch].muted);
  const level = useStore((s) => s.meters[ch] ?? 0);
  const selected = useStore((s) => s.selected === ch);
  const select = useStore((s) => s.select);
  const setGain = useStore((s) => s.setGain);
  const setMute = useStore((s) => s.setMute);

  // Show the dragged value immediately; throttle the dispatch so we don't flood the socket.
  const [live, setLive] = useState<number | null>(null);
  const lastSent = useRef(0);
  const onChange = (v: number) => {
    setLive(v);
    const now = Date.now();
    if (now - lastSent.current > 40) {
      lastSent.current = now;
      setGain(ch, Number(v.toFixed(1)));
    }
  };
  const onCommit = () => {
    if (live !== null) setGain(ch, Number(live.toFixed(1)));
    setLive(null);
  };

  return (
    <Pressable style={[styles.strip, selected && styles.selected]} onPress={() => select(ch)}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {CHANNELS[ch]}
        </Text>
        <Text style={[styles.tag, isInput(ch) ? styles.tagIn : styles.tagOut]}>{isInput(ch) ? 'IN' : 'OUT'}</Text>
      </View>
      <View style={styles.body}>
        <Meter level={level} />
        <Fader value={live ?? gainDb} min={-60} max={20} onChange={onChange} onCommit={onCommit} />
      </View>
      <Pressable style={[styles.mute, muted && styles.muteOn]} onPress={() => setMute(ch, !muted)}>
        <Text style={[styles.muteText, muted && styles.muteTextOn]}>{muted ? 'MUTED' : 'MUTE'}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 8,
    minWidth: 84,
  },
  selected: { borderColor: theme.accent },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { color: theme.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  tag: { fontSize: 9, fontWeight: '800', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  tagIn: { backgroundColor: 'rgba(76,194,255,0.18)', color: theme.accent },
  tagOut: { backgroundColor: 'rgba(63,185,80,0.18)', color: theme.safe },
  body: { flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  mute: { marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.line, paddingVertical: 8, alignItems: 'center' },
  muteOn: { backgroundColor: theme.clip, borderColor: theme.clip },
  muteText: { color: theme.dim, fontWeight: '700', fontSize: 12 },
  muteTextOn: { color: '#fff' },
});

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useStore, isInput } from '../store';
import { theme } from '../theme';

export type AppView = 'edit' | 'safety' | 'party';
const VIEWS: AppView[] = ['edit', 'safety', 'party'];

export function TopBar({ view, setView }: { view: AppView; setView: (v: AppView) => void }) {
  const host = useStore((s) => s.host);
  const anyOutMuted = useStore((s) => s.channels.some((c, ch) => !isInput(ch) && c.muted));
  const muteAll = useStore((s) => s.muteAll);
  const forget = useStore((s) => s.forget);

  return (
    <View style={styles.bar}>
      <View>
        <Text style={styles.brand}>
          z3r0 <Text style={styles.brandThin}>DSP 206</Text>
        </Text>
        <Text style={styles.host}>{host}</Text>
      </View>

      <View style={styles.seg}>
        {VIEWS.map((v) => (
          <Pressable key={v} style={[styles.segItem, view === v && styles.segOn]} onPress={() => setView(v)}>
            <Text style={[styles.segText, view === v && styles.segTextOn]}>{v[0].toUpperCase() + v.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.right}>
        <Pressable style={[styles.btn, anyOutMuted && styles.btnDanger]} onPress={() => muteAll(!anyOutMuted)}>
          <Text style={[styles.btnText, anyOutMuted && styles.btnTextDanger]}>
            {anyOutMuted ? 'Unmute all' : 'Mute all'}
          </Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void forget()}>
          <Text style={styles.btnText}>Disconnect</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  brand: { color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  brandThin: { color: theme.accent, fontWeight: '600' },
  host: { color: theme.dim, fontSize: 11 },
  seg: { flexDirection: 'row', backgroundColor: theme.panel2, borderRadius: 10, padding: 3 },
  segItem: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  segOn: { backgroundColor: theme.accent },
  segText: { color: theme.dim, fontWeight: '700', fontSize: 14 },
  segTextOn: { color: '#04121d' },
  right: { flexDirection: 'row', gap: 10 },
  btn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: theme.line },
  btnDanger: { backgroundColor: theme.clip, borderColor: theme.clip },
  btnText: { color: theme.text, fontWeight: '600', fontSize: 14 },
  btnTextDanger: { color: '#fff' },
});

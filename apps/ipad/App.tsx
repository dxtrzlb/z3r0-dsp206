import { useEffect } from 'react';
import { SafeAreaView, View, Text, Pressable, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { meterDbfs, statusOf, type HealthStatus } from '@z3r0/core';
import { useStore, CHANNELS } from './src/store';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { theme } from './src/theme';

const STATUS_COLOR: Record<HealthStatus, string> = {
  safe: theme.safe,
  warning: theme.warn,
  clip: theme.clip,
};

function Meter({ label, level }: { label: string; level: number }) {
  const db = meterDbfs(level);
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const color = STATUS_COLOR[statusOf(level)];
  return (
    <View style={styles.meterCol}>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { height: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.meterLabel}>{label}</Text>
    </View>
  );
}

function ConnectedView() {
  const host = useStore((s) => s.host);
  const meters = useStore((s) => s.meters);
  const disconnect = useStore((s) => s.forget);

  return (
    <View style={styles.connected}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>z3r0 DSP 206</Text>
          <Text style={styles.headerSub}>Connected · {host}</Text>
        </View>
        <Pressable style={styles.disconnect} onPress={() => void disconnect()}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionLabel}>Live meters</Text>
      <View style={styles.meters}>
        {CHANNELS.map((label, ch) => (
          <Meter key={ch} label={label} level={meters[ch] ?? 0} />
        ))}
      </View>
      <Text style={styles.note}>Full mixing-desk controls land in the next build step.</Text>
    </View>
  );
}

export default function App() {
  const connected = useStore((s) => s.status === 'connected');
  const init = useStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <StatusBar style="light" />
        {connected ? <ConnectedView /> : <ConnectScreen />}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  connected: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  brand: { color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: theme.dim, fontSize: 13, marginTop: 2 },
  disconnect: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.line },
  disconnectText: { color: theme.text, fontWeight: '600' },
  sectionLabel: { color: theme.dim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  meters: { flexDirection: 'row', gap: 12, height: 220 },
  meterCol: { alignItems: 'center', flex: 1 },
  meterTrack: { flex: 1, width: 28, backgroundColor: theme.panel2, borderRadius: 6, borderWidth: 1, borderColor: theme.line, justifyContent: 'flex-end', overflow: 'hidden' },
  meterFill: { width: '100%', borderRadius: 5 },
  meterLabel: { color: theme.dim, fontSize: 11, marginTop: 6 },
  note: { color: theme.dim, fontSize: 13, marginTop: 24, fontStyle: 'italic' },
});

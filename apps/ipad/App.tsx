import { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useStore } from './src/store';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { TopBar, type AppView } from './src/components/TopBar';
import { ChannelStrip } from './src/components/ChannelStrip';
import { RoutingMatrix } from './src/components/RoutingMatrix';
import { theme } from './src/theme';

const INPUTS = [0, 1];
const OUTPUTS = [2, 3, 4, 5, 6, 7];

function EditView() {
  return (
    <View style={styles.edit}>
      <View style={styles.rail}>
        <Text style={styles.section}>Inputs</Text>
        <View style={styles.inputRow}>
          {INPUTS.map((ch) => (
            <ChannelStrip key={ch} ch={ch} />
          ))}
        </View>
        <Text style={styles.section}>Routing</Text>
        <RoutingMatrix />
      </View>
      <View style={styles.main}>
        <Text style={styles.section}>Outputs</Text>
        <View style={styles.outRow}>
          {OUTPUTS.map((ch) => (
            <ChannelStrip key={ch} ch={ch} />
          ))}
        </View>
      </View>
    </View>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{label} view — coming in the next build step</Text>
    </View>
  );
}

export default function App() {
  const connected = useStore((s) => s.status === 'connected');
  const init = useStore((s) => s.init);
  const [view, setView] = useState<AppView>('edit');

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <StatusBar style="light" />
        {connected ? (
          <View style={styles.flex}>
            <TopBar view={view} setView={setView} />
            {view === 'edit' && <EditView />}
            {view === 'safety' && <Placeholder label="Safety" />}
            {view === 'party' && <Placeholder label="Party" />}
          </View>
        ) : (
          <ConnectScreen />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  edit: { flex: 1, flexDirection: 'row', padding: 16, gap: 16 },
  rail: { width: 320, gap: 10 },
  inputRow: { flexDirection: 'row', gap: 10, height: 240 },
  main: { flex: 1, gap: 10 },
  outRow: { flex: 1, flexDirection: 'row', gap: 10 },
  section: { color: theme.dim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: theme.dim, fontSize: 15, fontStyle: 'italic' },
});

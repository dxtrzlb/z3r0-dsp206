import { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useStore } from './src/store';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { TopBar, type AppView } from './src/components/TopBar';
import { ChannelStrip } from './src/components/ChannelStrip';
import { RoutingMatrix } from './src/components/RoutingMatrix';
import { OutputEditor } from './src/components/OutputEditor';
import { PresetBar } from './src/components/PresetBar';
import { SafetyView } from './src/components/SafetyView';
import { PartyView } from './src/components/PartyView';
import { theme } from './src/theme';

const INPUTS = [0, 1];
const OUTPUTS = [2, 3, 4, 5, 6, 7];

function EditView() {
  const selected = useStore((s) => s.selected);
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
        <PresetBar />
      </View>
      <View style={styles.main}>
        <OutputEditor ch={selected} />
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
            {view === 'safety' && <SafetyView />}
            {view === 'party' && <PartyView />}
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
  edit: { flex: 1, flexDirection: 'row', padding: 14, gap: 14 },
  rail: { width: 320, gap: 8 },
  inputRow: { flexDirection: 'row', gap: 10, height: 200 },
  main: { flex: 1, gap: 8 },
  outRow: { flexDirection: 'row', gap: 10, height: 200 },
  section: { color: theme.dim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
});

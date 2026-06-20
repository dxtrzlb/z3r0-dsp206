import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useStore, CHANNELS, isInput } from '../store';
import { FreqView } from './FreqView';
import { CrossoverEditor } from './CrossoverEditor';
import { Dynamics } from './Dynamics';
import { DelayEditor } from './DelayEditor';
import { GeqEditor } from './GeqEditor';
import { theme } from '../theme';

// The per-channel detail editor for the selected channel. Tabs differ by channel type:
// outputs get Crossover/EQ/Dynamics/Delay; inputs get EQ/GEQ/Gate/Delay.
const OUTPUT_TABS = ['Crossover', 'EQ', 'Dynamics', 'Delay'] as const;
const INPUT_TABS = ['EQ', 'GEQ', 'Gate', 'Delay'] as const;
type Tab = (typeof OUTPUT_TABS)[number] | (typeof INPUT_TABS)[number];

export function OutputEditor({ ch }: { ch: number }) {
  const input = isInput(ch);
  const tabs = input ? INPUT_TABS : OUTPUT_TABS;
  const inverted = useStore((s) => s.channels[ch].inverted);
  const setPolarity = useStore((s) => s.setPolarity);
  const [tab, setTab] = useState<Tab>(tabs[0]);

  useEffect(() => {
    setTab(input ? 'EQ' : 'Crossover');
  }, [ch, input]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.name}>{CHANNELS[ch]}</Text>
        <Pressable style={[styles.pol, inverted && styles.polOn]} onPress={() => setPolarity(ch, !inverted)}>
          <Text style={[styles.polText, inverted && styles.polTextOn]}>Ø {inverted ? 'Inverted' : 'Normal'}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {tab === 'EQ' ? (
          <FreqView ch={ch} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {tab === 'Crossover' && <CrossoverEditor ch={ch} />}
            {(tab === 'Dynamics' || tab === 'Gate') && <Dynamics ch={ch} />}
            {tab === 'GEQ' && <GeqEditor ch={ch} />}
            {tab === 'Delay' && <DelayEditor ch={ch} />}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: theme.text, fontSize: 18, fontWeight: '800' },
  pol: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: theme.line },
  polOn: { backgroundColor: theme.warn, borderColor: theme.warn },
  polText: { color: theme.dim, fontWeight: '700', fontSize: 12 },
  polTextOn: { color: '#04121d' },
  tabs: { flexDirection: 'row', backgroundColor: theme.panel2, borderRadius: 10, padding: 3, gap: 3 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  tabOn: { backgroundColor: theme.accent },
  tabText: { color: theme.dim, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: '#04121d' },
  body: { flex: 1 },
  scroll: { paddingVertical: 4, gap: 10 },
});

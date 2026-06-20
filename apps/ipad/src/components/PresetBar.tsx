import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { theme } from '../theme';

const label = (n: number): string => (n === 0 ? 'F00' : `U${String(n).padStart(2, '0')}`);
const PRESETS = Array.from({ length: 32 }, (_, i) => i); // 0..31 (0 = factory)
const SLOTS = Array.from({ length: 31 }, (_, i) => i + 1); // 1..31 user slots

// Loading and storing presets are destructive (replace/overwrite device data) — both confirm first.
export function PresetBar() {
  const loadPreset = useStore((s) => s.loadPreset);
  const storePreset = useStore((s) => s.storePreset);
  const setPresetName = useStore((s) => s.setPresetName);
  const [slot, setSlot] = useState(1);
  const [name, setName] = useState('');

  const onLoad = (n: number): void =>
    Alert.alert('Load preset', `Load ${label(n)}? This replaces ALL current settings — turn amplifiers down first.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Load', style: 'destructive', onPress: () => loadPreset(n) },
    ]);

  const onStore = (): void =>
    Alert.alert('Store preset', `Overwrite ${label(slot)} with the current settings?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Store',
        style: 'destructive',
        onPress: () => {
          const t = name.trim();
          if (t) setPresetName(t.slice(0, 20));
          storePreset(slot);
        },
      },
    ]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Presets</Text>

      <Text style={styles.label}>Load</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {PRESETS.map((n) => (
          <Pressable key={n} style={styles.chip} onPress={() => onLoad(n)}>
            <Text style={styles.chipText}>{label(n)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Store to</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SLOTS.map((n) => (
          <Pressable key={n} style={[styles.chip, slot === n && styles.chipOn]} onPress={() => setSlot(n)}>
            <Text style={[styles.chipText, slot === n && styles.chipTextOn]}>{label(n)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.storeRow}>
        <TextInput
          style={styles.input}
          placeholder="Name (optional)"
          placeholderTextColor={theme.dim}
          value={name}
          maxLength={20}
          onChangeText={setName}
        />
        <Pressable style={styles.storeBtn} onPress={onStore}>
          <Text style={styles.storeBtnText}>Store {label(slot)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  title: { color: theme.dim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  label: { color: theme.dim, fontSize: 11, marginTop: 4 },
  chips: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.panel2,
    borderWidth: 1,
    borderColor: theme.line,
  },
  chipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { color: theme.text, fontSize: 12, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: '#04121d', fontWeight: '700' },
  storeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  input: {
    flex: 1,
    backgroundColor: theme.panel2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    color: theme.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  storeBtn: { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  storeBtnText: { color: '#04121d', fontWeight: '700', fontSize: 13 },
});

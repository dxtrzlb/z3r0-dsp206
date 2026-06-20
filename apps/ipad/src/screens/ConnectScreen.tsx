import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parsePairingPayload } from '../hub/client';
import { useStore } from '../store';
import { theme } from '../theme';

type Mode = 'manual' | 'scan';

export function ConnectScreen() {
  const pairAndConnect = useStore((s) => s.pairAndConnect);
  const status = useStore((s) => s.status);
  const [mode, setMode] = useState<Mode>('manual');
  const [host, setHost] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const connect = async (h: string, c: string) => {
    setBusy(true);
    setError(null);
    try {
      await pairAndConnect(h.trim(), c.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode('manual');
    } finally {
      setBusy(false);
    }
  };

  const onScan = (data: string) => {
    if (busy) return;
    const parsed = parsePairingPayload(data);
    if (!parsed) {
      setError('That QR code is not a DSP pairing code.');
      return;
    }
    void connect(parsed.host, parsed.code);
  };

  const openScanner = async () => {
    setError(null);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera permission is needed to scan the QR. Enter the address manually instead.');
        return;
      }
    }
    setMode('scan');
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Connect to your DSP</Text>
        <Text style={styles.subtitle}>
          Open the desktop app, choose “Connect a tablet”, then scan the QR or type the address and code.
        </Text>

        {mode === 'scan' ? (
          <View style={styles.scanner}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => onScan(data)}
            />
            <Pressable style={[styles.btn, styles.btnGhost, styles.scanCancel]} onPress={() => setMode('manual')}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Hub address</Text>
            <TextInput
              style={styles.input}
              placeholder="192.168.1.50:7206"
              placeholderTextColor={theme.dim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              value={host}
              onChangeText={setHost}
            />
            <Text style={styles.label}>Pairing code</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={theme.dim}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />

            <View style={styles.row}>
              <Pressable
                style={[styles.btn, styles.btnPrimary, (busy || !host || !code) && styles.btnDisabled]}
                disabled={busy || !host || !code}
                onPress={() => connect(host, code)}
              >
                {busy ? <ActivityIndicator color="#04121d" /> : <Text style={styles.btnPrimaryText}>Connect</Text>}
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={openScanner}>
                <Text style={styles.btnGhostText}>Scan QR</Text>
              </Pressable>
            </View>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {status === 'connecting' && <Text style={styles.hint}>Connecting…</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg, padding: 24 },
  card: { width: 460, maxWidth: '100%', backgroundColor: theme.panel, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: theme.line },
  title: { color: theme.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: theme.dim, fontSize: 13, marginTop: 6, marginBottom: 18, lineHeight: 18 },
  label: { color: theme.dim, fontSize: 12, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.panel2, borderRadius: 10, borderWidth: 1, borderColor: theme.line, color: theme.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: theme.accent },
  btnPrimaryText: { color: '#04121d', fontWeight: '700', fontSize: 16 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.line },
  btnGhostText: { color: theme.text, fontWeight: '600', fontSize: 16 },
  btnDisabled: { opacity: 0.4 },
  scanner: { height: 280, borderRadius: 12, overflow: 'hidden', marginTop: 12, backgroundColor: '#000' },
  scanCancel: { position: 'absolute', bottom: 12, left: 12, right: 12, flex: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  error: { color: theme.clip, fontSize: 13, marginTop: 14 },
  hint: { color: theme.dim, fontSize: 13, marginTop: 14 },
});

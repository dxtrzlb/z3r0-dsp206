import { useEffect } from 'react';
import { useStore, CHANNELS } from './store';
import { ChannelStrip } from './components/ChannelStrip';

export function App() {
  const status = useStore((s) => s.status);
  const detail = useStore((s) => s.detail);
  const present = useStore((s) => s.present);
  const device = useStore((s) => s.device);
  const demoMode = useStore((s) => s.demoMode);
  const bind = useStore((s) => s.bind);
  const connect = useStore((s) => s.connect);
  const disconnect = useStore((s) => s.disconnect);
  const setDemoMode = useStore((s) => s.setDemoMode);
  const refreshPresent = useStore((s) => s.refreshPresent);

  useEffect(() => {
    const unbind = bind();
    refreshPresent();
    const poll = setInterval(refreshPresent, 2000);
    return () => {
      unbind();
      clearInterval(poll);
    };
  }, [bind, refreshPresent]);

  // Synthetic meters so demo mode looks alive without hardware.
  useEffect(() => {
    if (!demoMode) return;
    const phase = CHANNELS.map(() => Math.random() * Math.PI * 2);
    const id = setInterval(() => {
      const t = Date.now() / 1000;
      useStore.setState({
        meters: phase.map((p, i) => {
          const base = 0.35 + 0.3 * Math.sin(t * (1 + i * 0.15) + p);
          return Math.max(0, base + (Math.random() - 0.5) * 0.1);
        }),
      });
    }, 80);
    return () => clearInterval(id);
  }, [demoMode]);

  const connected = status === 'connected';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          z3r0 <span>DSP 206</span>
        </div>

        <div className="conn">
          <div className="device-label">
            <span className="device-prefix">Device Detected:</span>
            <span className={`device-value ${device ? 'found' : 'none'}`}>
              {device ? (device.product ?? 'Dsp Process') : 'No device'}
            </span>
          </div>
          {demoMode && <span className="demo-tag">DEMO</span>}
          <span className={`dot ${demoMode ? 'demo' : status}`} />
          <span className="status-text">
            {connected
              ? 'Connected'
              : demoMode
                ? 'Demo mode'
                : status === 'error'
                  ? `Error: ${detail ?? ''}`
                  : 'Disconnected'}
          </span>
          {connected ? (
            <button className="btn" onClick={() => disconnect()}>
              Disconnect
            </button>
          ) : (
            <button className="btn primary" onClick={() => connect()} disabled={!present}>
              {present ? 'Connect' : 'No device'}
            </button>
          )}
          <button
            className={`btn ${demoMode ? 'active' : ''}`}
            onClick={() => setDemoMode(!demoMode)}
            disabled={connected}
          >
            {demoMode ? 'Exit demo' : 'Demo mode'}
          </button>
        </div>
      </header>

      <main className="strips">
        {CHANNELS.map((_, ch) => (
          <ChannelStrip key={ch} ch={ch} />
        ))}
      </main>
    </div>
  );
}

import { useState } from 'react';
import { useStore, isInput } from '../store';
import { TabletConnect } from './TabletConnect';

export type View = 'edit' | 'safety' | 'party';
const VIEWS: View[] = ['edit', 'safety', 'party'];

export function TopBar({ view, setView }: { view: View; setView: (v: View) => void }) {
  const [showTablet, setShowTablet] = useState(false);
  const status = useStore((s) => s.status);
  const detail = useStore((s) => s.detail);
  const device = useStore((s) => s.device);
  const demoMode = useStore((s) => s.demoMode);
  const present = useStore((s) => s.present);
  const connect = useStore((s) => s.connect);
  const disconnect = useStore((s) => s.disconnect);
  const setDemoMode = useStore((s) => s.setDemoMode);
  const muteAll = useStore((s) => s.muteAll);
  const anyOutMuted = useStore((s) => s.channels.some((c, ch) => !isInput(ch) && c.muted));
  const connected = status === 'connected';
  const live = connected || demoMode;

  return (
    <>
    <header className="topbar">
      <div className="brand">
        z3r0 <span>DSP 206</span>
      </div>

      <nav className="view-switch">
        {VIEWS.map((v) => (
          <button key={v} className={`view-tab ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>

      <div className="conn">
        <button
          className={`btn mute-all ${anyOutMuted ? 'engaged' : ''}`}
          onClick={() => muteAll(!anyOutMuted)}
          disabled={!live}
        >
          {anyOutMuted ? 'Unmute all' : 'Mute all'}
        </button>

        <button className="btn" onClick={() => setShowTablet(true)}>
          Tablet
        </button>

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
    {showTablet && <TabletConnect onClose={() => setShowTablet(false)} />}
    </>
  );
}

import { useEffect, useState } from 'react';
import { useStore, CHANNELS } from './store';
import { ChannelStrip } from './components/ChannelStrip';
import { FreqView } from './components/FreqView';
import { RoutingMatrix } from './components/RoutingMatrix';
import { OutputEditor } from './components/OutputEditor';
import { SafetyView } from './components/SafetyView';
import { PartyView } from './components/PartyView';
import { PresetBar } from './components/PresetBar';
import { TopBar, type View } from './components/TopBar';

const INPUTS = [0, 1];
const OUTPUTS = [2, 3, 4, 5, 6, 7];

function StageHead() {
  const selected = useStore((s) => s.selected);
  return (
    <div className="stage-head">
      <span className="stage-title">{CHANNELS[selected]}</span>
      <span className="stage-sub">Frequency response · drag node = freq + gain · wheel = Q</span>
    </div>
  );
}

export function App() {
  const [view, setView] = useState<View>('edit');
  const demoMode = useStore((s) => s.demoMode);
  const bind = useStore((s) => s.bind);
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

  return (
    <div className="app">
      <TopBar view={view} setView={setView} />
      <PresetBar />

      {view === 'edit' && (
        <div className="workspace">
          <aside className="rail">
            <div className="rail-title">Inputs</div>
            <div className="rail-cards">
              {INPUTS.map((ch) => (
                <ChannelStrip key={ch} ch={ch} />
              ))}
            </div>
            <div className="rail-title">Routing</div>
            <RoutingMatrix />
          </aside>

          <section className="stage">
            <StageHead />
            <div className="stage-main">
              <FreqView />
            </div>
            <OutputEditor />
            <div className="output-bar">
              {OUTPUTS.map((ch) => (
                <ChannelStrip key={ch} ch={ch} />
              ))}
            </div>
          </section>
        </div>
      )}

      {view === 'safety' && <SafetyView />}
      {view === 'party' && <PartyView />}
    </div>
  );
}

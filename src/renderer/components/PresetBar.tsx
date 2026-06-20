import { useState } from 'react';
import { useInteractive } from '../store';

const u = (n: number): string => `U${String(n).padStart(2, '0')}`;
const PRESETS = Array.from({ length: 32 }, (_, i) => ({ v: i, label: i === 0 ? 'F00 (Factory)' : u(i) }));
const USER_SLOTS = PRESETS.filter((p) => p.v >= 1);

export function PresetBar() {
  const interactive = useInteractive();
  const [loadSel, setLoadSel] = useState(0);
  const [slot, setSlot] = useState(1);
  const [name, setName] = useState('');

  const load = (): void => {
    if (
      !window.confirm(
        'Loading a preset replaces ALL current settings on the device. Turn amplifiers down first. Continue?',
      )
    )
      return;
    void window.dsp.dispatch('loadPreset', { presetNum: loadSel });
  };

  const store = (): void => {
    if (!window.confirm(`Overwrite user slot ${u(slot)} with the current settings?`)) return;
    const trimmed = name.trim();
    if (trimmed) void window.dsp.dispatch('setPresetName', { name: trimmed.slice(0, 20) });
    void window.dsp.dispatch('storePreset', { slot });
  };

  return (
    <div className="presetbar">
      <div className="preset-group">
        <span className="preset-label">Preset</span>
        <select
          className="param-select preset-select"
          value={loadSel}
          disabled={!interactive}
          onChange={(e) => setLoadSel(Number(e.target.value))}
        >
          {PRESETS.map((p) => (
            <option key={p.v} value={p.v}>
              {p.label}
            </option>
          ))}
        </select>
        <button className="btn small" disabled={!interactive} onClick={load}>
          Load
        </button>
      </div>

      <div className="preset-group">
        <span className="preset-label">Store to</span>
        <input
          className="preset-name"
          placeholder="Name"
          value={name}
          maxLength={20}
          disabled={!interactive}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="param-select preset-select"
          value={slot}
          disabled={!interactive}
          onChange={(e) => setSlot(Number(e.target.value))}
        >
          {USER_SLOTS.map((p) => (
            <option key={p.v} value={p.v}>
              {p.label}
            </option>
          ))}
        </select>
        <button className="btn small" disabled={!interactive} onClick={store}>
          Store…
        </button>
      </div>
    </div>
  );
}

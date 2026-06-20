import { useStore, useInteractive } from '../../store';

const GMIN = -60;
const GMAX = 20;

export function GainBlock({ ch }: { ch: number }) {
  const gainDb = useStore((s) => s.channels[ch].gainDb);
  const setGain = useStore((s) => s.setGain);
  const interactive = useInteractive();
  const label = gainDb > 0 ? `+${gainDb.toFixed(1)}` : gainDb.toFixed(1);
  // Vertical fader = a horizontal range input rotated -90deg (min→bottom, max→top), which is
  // consistent across Chromium versions, unlike writing-mode vertical sliders.
  return (
    <div className="gain">
      <span className="val">{label}</span>
      <div className="fader-track">
        <input
          className="fader"
          type="range"
          min={GMIN}
          max={GMAX}
          step={0.1}
          value={gainDb}
          disabled={!interactive}
          onChange={(e) => setGain(ch, Number(e.target.value))}
        />
      </div>
      <span className="gain-unit">dB</span>
    </div>
  );
}

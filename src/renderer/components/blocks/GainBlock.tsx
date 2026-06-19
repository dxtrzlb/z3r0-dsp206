import { useStore, useInteractive } from '../../store';

const GMIN = -60;
const GMAX = 20;

export function GainBlock({ ch }: { ch: number }) {
  const gainDb = useStore((s) => s.channels[ch].gainDb);
  const setGain = useStore((s) => s.setGain);
  const interactive = useInteractive();
  const label = gainDb > 0 ? `+${gainDb.toFixed(1)}` : gainDb.toFixed(1);
  // The native vertical slider renders min at top; invert so max (loud) is at the top.
  const sliderVal = GMIN + GMAX - gainDb;
  return (
    <div className="gain">
      <span className="val">{label}</span>
      <input
        className="fader"
        type="range"
        min={GMIN}
        max={GMAX}
        step={0.1}
        value={sliderVal}
        disabled={!interactive}
        onChange={(e) => setGain(ch, GMIN + GMAX - Number(e.target.value))}
      />
      <span className="gain-unit">dB</span>
    </div>
  );
}

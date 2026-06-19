import { useStore, useInteractive } from '../../store';

const INPUTS = ['In A', 'In B'] as const;

export function MatrixBlock({ ch }: { ch: number }) {
  const routeMask = useStore((s) => s.channels[ch].routeMask);
  const inLevel = useStore((s) => s.channels[ch].inLevel);
  const setRoute = useStore((s) => s.setRoute);
  const setInLevel = useStore((s) => s.setInLevel);
  const interactive = useInteractive();

  return (
    <div className="block">
      <div className="block-head">
        <span>Matrix</span>
      </div>
      {INPUTS.map((label, inIdx) => {
        const on = (routeMask & (inIdx === 0 ? 0x01 : 0x02)) !== 0;
        return (
          <div key={label} className="matrix-row">
            <button
              className={`route ${on ? 'on' : ''}`}
              disabled={!interactive}
              onClick={() => setRoute(ch, inIdx, !on)}
            >
              {label}
            </button>
            <input
              type="range"
              min={-60}
              max={20}
              step={0.1}
              value={inLevel[inIdx]}
              disabled={!interactive || !on}
              onChange={(e) => setInLevel(ch, inIdx, Number(e.target.value))}
            />
            <span className="val">{inLevel[inIdx].toFixed(0)}</span>
          </div>
        );
      })}
    </div>
  );
}

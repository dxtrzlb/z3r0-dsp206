import { useInteractive } from '../store';

interface ParamProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

export const fmtHz = (hz: number): string =>
  hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz` : `${Math.round(hz)} Hz`;

// Logarithmic frequency slider over 20 Hz … 20 kHz.
export function FreqParam({
  label = 'Freq',
  value,
  onChange,
}: {
  label?: string;
  value: number;
  onChange: (hz: number) => void;
}) {
  const interactive = useInteractive();
  const pos = (Math.log10(value / 20) / Math.log10(1000)) * 1000;
  const toHz = (p: number) => Math.round(20 * Math.pow(1000, p / 1000));
  return (
    <label className="param">
      <span className="param-label">{label}</span>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={pos}
        disabled={!interactive}
        onChange={(e) => onChange(toHz(Number(e.target.value)))}
      />
      <span className="param-val">{fmtHz(value)}</span>
    </label>
  );
}

export function Param({ label, value, min, max, step = 1, unit = '', format, onChange }: ParamProps) {
  const interactive = useInteractive();
  return (
    <label className="param">
      <span className="param-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={!interactive}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="param-val">
        {format ? format(value) : value}
        {unit}
      </span>
    </label>
  );
}

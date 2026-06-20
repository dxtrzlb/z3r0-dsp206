import { useMemo, useRef } from 'react';
import { useStore, useInteractive } from '../store';
import { channelResponseDb, logFreqs, freqToPos, posToFreq } from '@z3r0/core';

const W = 1000;
const H = 320;
const PAD = { l: 40, r: 14, t: 12, b: 22 };
const X0 = PAD.l;
const X1 = W - PAD.r;
const Y0 = PAD.t;
const Y1 = H - PAD.b;
const DB_MAX = 18;
const DB_MIN = -18;
const GAIN_CLAMP = 12;

const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const DB_TICKS = [12, 6, 0, -6, -12];
const SAMPLES = logFreqs(240);

// Per-channel curve colour: In A/B blue, Out 1-6 distinct.
const CH_COLORS = ['#4ea1ff', '#4ea1ff', '#e24b4a', '#378add', '#ef9f27', '#1d9e75', '#b07bff', '#ec6ec6'];

const xFor = (hz: number): number => X0 + freqToPos(hz) * (X1 - X0);
const yFor = (db: number): number => Y0 + ((DB_MAX - db) / (DB_MAX - DB_MIN)) * (Y1 - Y0);
const freqForX = (x: number): number => posToFreq((x - X0) / (X1 - X0));
const dbForY = (y: number): number => DB_MAX - ((y - Y0) / (Y1 - Y0)) * (DB_MAX - DB_MIN);
const fmtHz = (hz: number): string => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function FreqView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const ch = useStore((s) => s.selected);
  const channel = useStore((s) => s.channels[ch]);
  const setPeqBand = useStore((s) => s.setPeqBand);
  const interactive = useInteractive();
  const color = CH_COLORS[ch] ?? '#4ea1ff';

  const curve = useMemo(() => {
    const ys = channelResponseDb(channel, SAMPLES);
    return SAMPLES.map(
      (f, i) =>
        `${i === 0 ? 'M' : 'L'}${xFor(f).toFixed(1)},${yFor(clamp(ys[i], DB_MIN, DB_MAX)).toFixed(1)}`,
    ).join(' ');
  }, [channel]);

  const toSvg = (e: React.PointerEvent): { x: number; y: number } => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const onMove = (band: number) => (e: React.PointerEvent) => {
    if (!interactive || (e.buttons & 1) === 0) return;
    const { x, y } = toSvg(e);
    const hz = Math.round(clamp(freqForX(x), 20, 20000));
    const gainDb = clamp(Math.round(dbForY(y) * 10) / 10, -GAIN_CLAMP, GAIN_CLAMP);
    setPeqBand(ch, band, { hz, gainDb });
  };

  const onWheel = (band: number) => (e: React.WheelEvent) => {
    if (!interactive) return;
    const q = channel.peq[band].q;
    setPeqBand(ch, band, { q: clamp(+(q * (e.deltaY > 0 ? 0.9 : 1.1)).toFixed(2), 0.4, 24) });
  };

  return (
    <svg ref={svgRef} className="freq-graph" viewBox={`0 0 ${W} ${H}`}>
      <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} className="plot-bg" />

      {FREQ_TICKS.map((f) => (
        <line key={f} className="grid" x1={xFor(f)} x2={xFor(f)} y1={Y0} y2={Y1} />
      ))}
      {DB_TICKS.map((d) => (
        <line key={d} className={`grid ${d === 0 ? 'zero' : ''}`} x1={X0} x2={X1} y1={yFor(d)} y2={yFor(d)} />
      ))}
      {FREQ_TICKS.map((f) => (
        <text key={`fl${f}`} className="ax" x={xFor(f)} y={H - 7} textAnchor="middle">
          {fmtHz(f)}
        </text>
      ))}
      {DB_TICKS.map((d) => (
        <text key={`dl${d}`} className="ax" x={6} y={yFor(d) + 3.5}>
          {d > 0 ? `+${d}` : d}
        </text>
      ))}

      <path className="curve" d={curve} style={{ stroke: color }} />

      {channel.peq.map((b, i) =>
        b.bypass ? null : (
          <g
            key={i}
            className="eq-node"
            onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={onMove(i)}
            onWheel={onWheel(i)}
            style={{ pointerEvents: interactive ? 'all' : 'none' }}
          >
            <circle cx={xFor(b.hz)} cy={yFor(b.gainDb)} r={10} style={{ fill: color }} />
            <text x={xFor(b.hz)} y={yFor(b.gainDb) + 3.5} textAnchor="middle" className="eq-node-num">
              {i + 1}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}

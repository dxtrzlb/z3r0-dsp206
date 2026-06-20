import { useState } from 'react';
import { useStore, useInteractive, isInput, CHANNELS } from '../store';
import { PEQ_TYPES, SLOPE_LADDER, RATIO_LADDER } from '@z3r0/core';
import { Param, FreqParam } from './Param';

type Tab = 'xover' | 'eq' | 'dyn' | 'delay' | 'geq' | 'gate';
const TAB_LABEL: Record<Tab, string> = {
  xover: 'Crossover',
  eq: 'EQ',
  dyn: 'Dynamics',
  delay: 'Delay',
  geq: 'GEQ',
  gate: 'Gate',
};

export function OutputEditor() {
  const ch = useStore((s) => s.selected);
  const input = isInput(ch);
  const tabs: Tab[] = input ? ['eq', 'geq', 'gate'] : ['xover', 'eq', 'dyn', 'delay'];
  const [tab, setTab] = useState<Tab>('eq');
  const active = tabs.includes(tab) ? tab : tabs[0];

  return (
    <div className="editor">
      <div className="editor-head">
        <span className="editor-title">{CHANNELS[ch]}</span>
        <div className="editor-tabs">
          {tabs.map((t) => (
            <button key={t} className={`etab ${active === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <PolarityToggle ch={ch} />
      </div>
      <div className="editor-body">
        {active === 'xover' && <XoverTab ch={ch} />}
        {active === 'eq' && <EqTab ch={ch} />}
        {active === 'dyn' && <DynTab ch={ch} />}
        {active === 'delay' && <DelayTab ch={ch} />}
        {active === 'geq' && <GeqTab ch={ch} />}
        {active === 'gate' && <GateTab ch={ch} />}
      </div>
    </div>
  );
}

function PolarityToggle({ ch }: { ch: number }) {
  const inverted = useStore((s) => s.channels[ch].inverted);
  const setPolarity = useStore((s) => s.setPolarity);
  const interactive = useInteractive();
  return (
    <button
      className={`btn polarity ${inverted ? 'inv' : ''}`}
      disabled={!interactive}
      onClick={() => setPolarity(ch, !inverted)}
    >
      {inverted ? 'Inverse' : 'Normal'}
    </button>
  );
}

function XoverBand({ ch, kind }: { ch: number; kind: 'hpf' | 'lpf' }) {
  const band = useStore((s) => s.channels[ch][kind]);
  const setHpf = useStore((s) => s.setHpf);
  const setLpf = useStore((s) => s.setLpf);
  const interactive = useInteractive();
  const set = kind === 'hpf' ? setHpf : setLpf;
  return (
    <div className="xover-band">
      <div className="xover-band-head">
        <span>{kind === 'hpf' ? 'High-pass' : 'Low-pass'}</span>
        <button
          className={`btn small ${band.on ? 'active' : ''}`}
          disabled={!interactive}
          onClick={() => set(ch, { on: !band.on })}
        >
          {band.on ? 'On' : 'Off'}
        </button>
      </div>
      <FreqParam label="Freq" value={band.hz} onChange={(hz) => set(ch, { hz })} />
      <label className="param">
        <span className="param-label">Slope</span>
        <select
          className="param-select"
          value={band.slope}
          disabled={!interactive}
          onChange={(e) => set(ch, { slope: Number(e.target.value) })}
        >
          {SLOPE_LADDER.map((s, i) => (
            <option key={i} value={i}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function XoverTab({ ch }: { ch: number }) {
  return (
    <div className="xover-tab">
      <XoverBand ch={ch} kind="hpf" />
      <XoverBand ch={ch} kind="lpf" />
    </div>
  );
}

function EqTab({ ch }: { ch: number }) {
  const peq = useStore((s) => s.channels[ch].peq);
  const setPeqBand = useStore((s) => s.setPeqBand);
  const addPeqBand = useStore((s) => s.addPeqBand);
  const removePeqBand = useStore((s) => s.removePeqBand);
  const interactive = useInteractive();
  return (
    <div className="eq-tab">
      <div className="eq-list">
        {peq.map((b, i) => (
          <div key={i} className={`eq-band ${b.bypass ? 'bypassed' : ''}`}>
            <div className="eq-band-head">
              <span className="eq-band-num">{i + 1}</span>
              <select
                className="param-select"
                value={b.type}
                disabled={!interactive}
                onChange={(e) => setPeqBand(ch, i, { type: Number(e.target.value) })}
              >
                {PEQ_TYPES.map((t, ti) => (
                  <option key={ti} value={ti}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                className={`btn small ${b.bypass ? '' : 'active'}`}
                disabled={!interactive}
                onClick={() => setPeqBand(ch, i, { bypass: !b.bypass })}
              >
                {b.bypass ? 'Off' : 'On'}
              </button>
            </div>
            <FreqParam value={b.hz} onChange={(hz) => setPeqBand(ch, i, { hz })} />
            <Param
              label="Gain"
              value={b.gainDb}
              min={-12}
              max={12}
              step={0.1}
              unit=" dB"
              onChange={(gainDb) => setPeqBand(ch, i, { gainDb })}
            />
            <Param
              label="Q"
              value={b.q}
              min={0.4}
              max={24}
              step={0.1}
              format={(v) => v.toFixed(1)}
              onChange={(q) => setPeqBand(ch, i, { q })}
            />
          </div>
        ))}
      </div>
      <div className="eq-actions">
        <button className="btn small" disabled={!interactive} onClick={() => addPeqBand(ch)}>
          + Add band
        </button>
        <button
          className="btn small"
          disabled={!interactive || peq.length <= 1}
          onClick={() => removePeqBand(ch)}
        >
          − Remove
        </button>
      </div>
    </div>
  );
}

function DynTab({ ch }: { ch: number }) {
  const limiter = useStore((s) => s.channels[ch].limiter);
  const comp = useStore((s) => s.channels[ch].compressor);
  const setLimiter = useStore((s) => s.setLimiter);
  const setCompressor = useStore((s) => s.setCompressor);
  const interactive = useInteractive();
  return (
    <div className="dyn-tab">
      <div className="dyn-col">
        <div className="dyn-title">Limiter</div>
        <Param label="Thresh" value={limiter.threshDb} min={-40} max={0} step={0.5} unit=" dB" onChange={(threshDb) => setLimiter(ch, { threshDb })} />
        <Param label="Attack" value={limiter.attackMs} min={1} max={100} step={1} unit=" ms" onChange={(attackMs) => setLimiter(ch, { attackMs })} />
        <Param label="Release" value={limiter.releaseMs} min={10} max={1000} step={10} unit=" ms" onChange={(releaseMs) => setLimiter(ch, { releaseMs })} />
      </div>
      <div className="dyn-col">
        <div className="dyn-title">Compressor</div>
        <label className="param">
          <span className="param-label">Ratio</span>
          <select
            className="param-select"
            value={comp.ratio}
            disabled={!interactive}
            onChange={(e) => setCompressor(ch, { ratio: Number(e.target.value) })}
          >
            {RATIO_LADDER.map((r, i) => (
              <option key={i} value={i}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <Param label="Thresh" value={comp.threshDb} min={-60} max={0} step={0.5} unit=" dB" onChange={(threshDb) => setCompressor(ch, { threshDb })} />
        <Param label="Knee" value={comp.kneeDb} min={0} max={12} step={0.5} unit=" dB" onChange={(kneeDb) => setCompressor(ch, { kneeDb })} />
        <Param label="Attack" value={comp.attackMs} min={1} max={100} step={1} unit=" ms" onChange={(attackMs) => setCompressor(ch, { attackMs })} />
        <Param label="Release" value={comp.releaseMs} min={10} max={1000} step={10} unit=" ms" onChange={(releaseMs) => setCompressor(ch, { releaseMs })} />
      </div>
    </div>
  );
}

function DelayTab({ ch }: { ch: number }) {
  const ms = useStore((s) => s.channels[ch].delayMs);
  const setDelay = useStore((s) => s.setDelay);
  const interactive = useInteractive();
  const m = (ms / 1000) * 343;
  const ft = m * 3.28084;
  return (
    <div className="delay-tab">
      <label className="param">
        <span className="param-label">Delay</span>
        <input
          type="range"
          min={0}
          max={683}
          step={0.05}
          value={ms}
          disabled={!interactive}
          onChange={(e) => setDelay(ch, Number(e.target.value))}
        />
        <span className="param-val">{ms.toFixed(2)} ms</span>
      </label>
      <div className="delay-readout">
        <span>{ms.toFixed(2)} ms</span>
        <span>{m.toFixed(2)} m</span>
        <span>{ft.toFixed(2)} ft</span>
      </div>
    </div>
  );
}

function GateTab({ ch }: { ch: number }) {
  const gate = useStore((s) => s.channels[ch].gate);
  const setGate = useStore((s) => s.setGate);
  return (
    <div className="gate-tab">
      <Param label="Thresh" value={gate.threshDb} min={-80} max={0} step={0.5} unit=" dB" onChange={(threshDb) => setGate(ch, { threshDb })} />
      <Param label="Attack" value={gate.attackMs} min={1} max={100} step={1} unit=" ms" onChange={(attackMs) => setGate(ch, { attackMs })} />
      <Param label="Hold" value={gate.holdMs} min={1} max={1000} step={10} unit=" ms" onChange={(holdMs) => setGate(ch, { holdMs })} />
      <Param label="Release" value={gate.releaseMs} min={10} max={1000} step={10} unit=" ms" onChange={(releaseMs) => setGate(ch, { releaseMs })} />
    </div>
  );
}

const ISO_BANDS = [
  '20', '25', '31', '40', '50', '63', '80', '100', '125', '160', '200', '250', '315', '400', '500',
  '630', '800', '1k', '1.25k', '1.6k', '2k', '2.5k', '3.15k', '4k', '5k', '6.3k', '8k', '10k', '12.5k', '16k', '20k',
];

function GeqTab({ ch }: { ch: number }) {
  const geq = useStore((s) => s.channels[ch].geq);
  const setGeqBand = useStore((s) => s.setGeqBand);
  const interactive = useInteractive();
  return (
    <div className="geq-tab">
      {ISO_BANDS.map((label, i) => (
        <div key={i} className="geq-band">
          <div className="geq-fader-track">
            <input
              className="geq-fader"
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={geq[i]}
              disabled={!interactive}
              onChange={(e) => setGeqBand(ch, i, Number(e.target.value))}
            />
          </div>
          <span className="geq-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

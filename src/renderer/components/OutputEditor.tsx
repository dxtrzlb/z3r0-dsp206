import { useState } from 'react';
import { useStore, useInteractive, isInput, CHANNELS } from '../store';
import { PEQ_TYPES, SLOPE_LADDER } from '@z3r0/core';
import { Param, FreqParam } from './Param';

type Tab = 'xover' | 'eq';

export function OutputEditor() {
  const ch = useStore((s) => s.selected);
  const input = isInput(ch);
  const tabs: Tab[] = input ? ['eq'] : ['xover', 'eq'];
  const [tab, setTab] = useState<Tab>(input ? 'eq' : 'xover');
  const active = tabs.includes(tab) ? tab : tabs[0];

  return (
    <div className="editor">
      <div className="editor-head">
        <span className="editor-title">{CHANNELS[ch]}</span>
        <div className="editor-tabs">
          {tabs.map((t) => (
            <button key={t} className={`etab ${active === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t === 'xover' ? 'Crossover' : 'EQ'}
            </button>
          ))}
        </div>
        <PolarityToggle ch={ch} />
      </div>
      <div className="editor-body">
        {active === 'xover' && <XoverTab ch={ch} />}
        {active === 'eq' && <EqTab ch={ch} />}
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

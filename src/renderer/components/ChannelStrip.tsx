import { useStore, CHANNELS, isInput } from '../store';
import { MeterBar } from './Meters';
import { GainBlock } from './blocks/GainBlock';
import { MuteBlock } from './blocks/MuteBlock';

export function ChannelStrip({ ch }: { ch: number }) {
  const level = useStore((s) => s.meters[ch]);
  const selected = useStore((s) => s.selected === ch);
  const select = useStore((s) => s.select);
  return (
    <div
      className={`strip ${isInput(ch) ? 'input' : 'output'} ${selected ? 'selected' : ''}`}
      onClick={() => select(ch)}
    >
      <div className="strip-head">
        <span className="strip-name">{CHANNELS[ch]}</span>
        <span className="strip-tag">{isInput(ch) ? 'IN' : 'OUT'}</span>
      </div>
      <div className="strip-body">
        <div className="fader-area">
          <MeterBar level={level} />
          <GainBlock ch={ch} />
        </div>
        <MuteBlock ch={ch} />
      </div>
    </div>
  );
}

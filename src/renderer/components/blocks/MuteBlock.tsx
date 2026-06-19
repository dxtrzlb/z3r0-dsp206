import { useStore, useInteractive } from '../../store';

export function MuteBlock({ ch }: { ch: number }) {
  const muted = useStore((s) => s.channels[ch].muted);
  const setMute = useStore((s) => s.setMute);
  const interactive = useInteractive();
  return (
    <button
      className={`mute ${muted ? 'on' : ''}`}
      disabled={!interactive}
      onClick={() => setMute(ch, !muted)}
    >
      {muted ? 'MUTED' : 'MUTE'}
    </button>
  );
}

import { useStore, useInteractive } from '../store';

const OUTS = [2, 3, 4, 5, 6, 7];

export function RoutingMatrix() {
  const channels = useStore((s) => s.channels);
  const setRoute = useStore((s) => s.setRoute);
  const interactive = useInteractive();

  const maskOf = (out: number): number => channels[out].routeMask;
  const toggle = (out: number, inIdx: number): void =>
    setRoute(out, inIdx, (maskOf(out) & (inIdx === 0 ? 1 : 2)) === 0);
  const toggleSum = (out: number): void => {
    const both = (maskOf(out) & 3) === 3;
    setRoute(out, 0, !both);
    setRoute(out, 1, !both);
  };

  return (
    <div className="matrix-grid">
      <span />
      {OUTS.map((o) => (
        <span key={`h${o}`} className="mx-col">
          O{o - 1}
        </span>
      ))}

      <span className="mx-row-label">In A</span>
      {OUTS.map((o) => (
        <button
          key={`a${o}`}
          className={`mx-node a ${maskOf(o) & 1 ? 'on' : ''}`}
          disabled={!interactive}
          onClick={() => toggle(o, 0)}
          aria-label={`In A to Out ${o - 1}`}
        />
      ))}

      <span className="mx-row-label">In B</span>
      {OUTS.map((o) => (
        <button
          key={`b${o}`}
          className={`mx-node b ${maskOf(o) & 2 ? 'on' : ''}`}
          disabled={!interactive}
          onClick={() => toggle(o, 1)}
          aria-label={`In B to Out ${o - 1}`}
        />
      ))}

      <span className="mx-row-label">A+B</span>
      {OUTS.map((o) => (
        <button
          key={`s${o}`}
          className={`mx-node s ${(maskOf(o) & 3) === 3 ? 'on' : ''}`}
          disabled={!interactive}
          onClick={() => toggleSum(o)}
          aria-label={`Sum A+B to Out ${o - 1}`}
        />
      ))}
    </div>
  );
}

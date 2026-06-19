// Linear float16 level → dBFS bar. A full-height green→yellow→red gradient is
// revealed from the bottom; the unlit portion is masked from the top.
const MIN_DB = -60;

function levelToDb(level: number): number {
  if (level <= 0) return MIN_DB;
  return Math.max(MIN_DB, 20 * Math.log10(level));
}

export function MeterBar({ level }: { level: number }) {
  const db = levelToDb(level);
  const pct = ((db - MIN_DB) / -MIN_DB) * 100;
  return (
    <div className="meter">
      <div className="meter-grad" />
      <div className="meter-mask" style={{ height: `${100 - pct}%` }} />
    </div>
  );
}

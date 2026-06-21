import { useEffect, useMemo, useRef } from 'react';

// Throttle a callback: fire immediately (leading), then at most once per `ms`, and always flush the
// final call (trailing edge) so the last value is never dropped. Used to rate-limit command
// dispatch during touch drags so a gesture doesn't flood the WebSocket / the device.
export function useThrottledCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const lastRun = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useMemo(
    () =>
      (...args: A): void => {
        const now = Date.now();
        const wait = ms - (now - lastRun.current);
        pending.current = args;
        if (wait <= 0) {
          lastRun.current = now;
          if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
          }
          pending.current = null;
          fnRef.current(...args);
        } else if (!timer.current) {
          timer.current = setTimeout(() => {
            lastRun.current = Date.now();
            timer.current = null;
            if (pending.current) {
              const a = pending.current;
              pending.current = null;
              fnRef.current(...a);
            }
          }, wait);
        }
      },
    [ms],
  );
}

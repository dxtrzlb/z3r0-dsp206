// The hub owns canonical DSP state and is the fan-out point to every client (renderer + WS).
// Every mutation goes through the registry: validate -> apply (pure) -> send HID frames ->
// notify state subscribers. Takes a minimal frame sink so it's testable without node-hid.
import { dispatch, defaultState, type DspState, type CommandName } from '@z3r0/core';

export interface FrameSink {
  send(frame: number[]): void;
}

type Unsub = () => void;

export class Hub {
  private state: DspState = defaultState();
  private meters: number[] = new Array(8).fill(0);
  private stateSubs = new Set<(s: DspState) => void>();
  private meterSubs = new Set<(m: number[]) => void>();

  constructor(private readonly sink: FrameSink) {}

  getState(): DspState {
    return this.state;
  }
  getMeters(): number[] {
    return this.meters;
  }

  onState(cb: (s: DspState) => void): Unsub {
    this.stateSubs.add(cb);
    return () => void this.stateSubs.delete(cb);
  }
  onMeters(cb: (m: number[]) => void): Unsub {
    this.meterSubs.add(cb);
    return () => void this.meterSubs.delete(cb);
  }

  pushMeters(levels: number[]): void {
    this.meters = levels;
    for (const f of this.meterSubs) f(levels);
  }

  // Throws ZodError on invalid params / Error on unknown command; surfaces to the caller.
  dispatch(name: CommandName, params: unknown): { ok: true } {
    const { state, frames } = dispatch(this.state, name, params);
    this.state = state;
    for (const frame of frames) this.sink.send(frame);
    for (const f of this.stateSubs) f(state);
    return { ok: true };
  }
}

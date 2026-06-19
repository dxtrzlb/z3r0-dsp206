// The hub owns canonical DSP state. Every mutation goes through the registry:
// validate -> apply (pure) -> send HID frames -> broadcast the new state to all clients.
import { dispatch, defaultState, type DspState, type CommandName } from '@z3r0/core';
import type { DspSession } from './device/session';

export class Hub {
  private state: DspState = defaultState();
  private meters: number[] = new Array(8).fill(0);

  constructor(
    private readonly session: DspSession,
    private readonly broadcastState: (s: DspState) => void,
  ) {}

  getState(): DspState {
    return this.state;
  }
  getMeters(): number[] {
    return this.meters;
  }
  setMeters(levels: number[]): void {
    this.meters = levels;
  }

  // Throws ZodError on invalid params / Error on unknown command; surfaces to the caller.
  dispatch(name: CommandName, params: unknown): { ok: true } {
    const { state, frames } = dispatch(this.state, name, params);
    this.state = state;
    for (const f of frames) this.session.send(f);
    this.broadcastState(this.state);
    return { ok: true };
  }
}

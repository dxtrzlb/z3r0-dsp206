// Pure transport bridge to the DSP hub: REST pairing + a WebSocket that streams the hub's
// canonical state and meters and accepts command intents. No React Native imports, so this
// runs (and is unit-tested) under plain Node as well as on the device.
import type { DspState, CommandName, CommandParams } from '@z3r0/core';

export type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface HubTarget {
  ws: string; // ws://host:port
  token: string;
}

// host[:port] or a full url → http/ws bases (the hub defaults to port 7206).
export function parseHost(input: string): { http: string; ws: string } {
  let h = input.trim().replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '');
  if (!/:\d+$/.test(h)) h += ':7206';
  return { http: `http://${h}`, ws: `ws://${h}` };
}

export interface PairingPayload {
  host: string;
  code: string;
}

// Parse a scanned QR / pasted string. The desktop encodes JSON {host,code}.
export function parsePairingPayload(text: string): PairingPayload | null {
  try {
    const o = JSON.parse(text) as Partial<PairingPayload>;
    if (o && typeof o.host === 'string' && typeof o.code === 'string') {
      return { host: o.host, code: o.code };
    }
  } catch {
    // not JSON — caller may treat the raw text as a host and ask for the code separately
  }
  return null;
}

type StatusCb = (status: ConnStatus, detail?: string) => void;
type StateCb = (state: DspState) => void;
type MetersCb = (values: number[]) => void;

export class HubClient {
  private ws?: WebSocket;
  private target?: HubTarget;
  private closing = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private backoff = 500;
  private nextId = 1;
  private state?: DspState;

  private statusCbs = new Set<StatusCb>();
  private stateCbs = new Set<StateCb>();
  private metersCbs = new Set<MetersCb>();

  onStatus(cb: StatusCb): () => void {
    this.statusCbs.add(cb);
    return () => void this.statusCbs.delete(cb);
  }
  onState(cb: StateCb): () => void {
    this.stateCbs.add(cb);
    return () => void this.stateCbs.delete(cb);
  }
  onMeters(cb: MetersCb): () => void {
    this.metersCbs.add(cb);
    return () => void this.metersCbs.delete(cb);
  }

  getState(): DspState | undefined {
    return this.state;
  }

  // Exchange the 6-digit pairing code for a bearer token. Throws on a bad code / unreachable hub.
  async pair(httpBase: string, code: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${httpBase}/api/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
    } catch {
      throw new Error('Cannot reach the hub — check the address and that the desktop app is running.');
    }
    if (!res.ok) throw new Error(res.status === 401 ? 'Wrong pairing code.' : `Pairing failed (${res.status}).`);
    return ((await res.json()) as { token: string }).token;
  }

  connect(target: HubTarget): void {
    this.target = target;
    this.closing = false;
    this.open();
  }

  private setStatus(status: ConnStatus, detail?: string): void {
    for (const cb of this.statusCbs) cb(status, detail);
  }

  private open(): void {
    if (!this.target) return;
    this.setStatus('connecting');
    const ws = new WebSocket(`${this.target.ws}/ws?token=${encodeURIComponent(this.target.token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = 500;
      this.setStatus('connected');
    };
    ws.onmessage = (ev: { data: unknown }) =>
      this.onMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
    ws.onerror = () => this.setStatus('error', 'connection error');
    ws.onclose = () => {
      this.setStatus('disconnected');
      if (!this.closing) this.scheduleReconnect();
    };
  }

  private onMessage(data: string): void {
    let msg: { type?: string; state?: DspState; values?: number[] };
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.type === 'state' && msg.state) {
      this.state = msg.state;
      for (const cb of this.stateCbs) cb(msg.state);
    } else if (msg.type === 'meters' && msg.values) {
      for (const cb of this.metersCbs) cb(msg.values);
    }
    // 'hello' (schema) and 'ack' are not needed by the mirror store yet.
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 10_000);
  }

  dispatch<N extends CommandName>(name: N, params: CommandParams[N]): void {
    if (this.ws && this.ws.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify({ type: 'command', id: this.nextId++, name, params }));
    }
  }

  disconnect(): void {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = undefined;
    this.setStatus('disconnected');
  }
}

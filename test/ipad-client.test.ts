// Headless proof of the iPad app's networking: drive the pure HubClient against a real hub
// server (no React Native, no device). Mirrors the MCP e2e approach. Node lacks a stable global
// WebSocket across versions, so we back it with the `ws` package the server already uses.
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { WebSocket as NodeWebSocket } from 'ws';
import type { DspState } from '@z3r0/core';
import { Hub } from '../src/main/hub';
import { startServer, type ServerHandle } from '../src/main/server';
import { HubClient, parseHost, parsePairingPayload } from '../apps/ipad/src/hub/client';

beforeAll(() => {
  (globalThis as { WebSocket?: unknown }).WebSocket = NodeWebSocket;
});

let srv: ServerHandle | null = null;
afterEach(async () => {
  await srv?.close();
  srv = null;
});

function makeHub() {
  const frames: number[][] = [];
  const hub = new Hub({ send: (f) => frames.push(f) });
  return { hub, frames };
}

function waitFor(cond: () => boolean, timeout = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (cond()) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(t);
        reject(new Error('timeout'));
      }
    }, 10);
  });
}

describe('iPad HubClient', () => {
  it('parses hosts and pairing payloads', () => {
    expect(parseHost('192.168.1.5')).toEqual({ http: 'http://192.168.1.5:7206', ws: 'ws://192.168.1.5:7206' });
    expect(parseHost('ws://10.0.0.2:9000/x')).toEqual({ http: 'http://10.0.0.2:9000', ws: 'ws://10.0.0.2:9000' });
    expect(parsePairingPayload('{"host":"10.0.0.2:7206","code":"012345"}')).toEqual({
      host: '10.0.0.2:7206',
      code: '012345',
    });
    expect(parsePairingPayload('not json')).toBeNull();
  });

  it('pairs, connects, mirrors state, and dispatches a command that mutates the hub', async () => {
    const { hub, frames } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });

    const client = new HubClient();
    const states: DspState[] = [];
    const statuses: string[] = [];
    client.onState((s) => states.push(s));
    client.onStatus((st) => statuses.push(st));

    const { http, ws } = parseHost(`127.0.0.1:${srv.port}`);
    const token = await client.pair(http, srv.code);
    client.connect({ ws, token });

    await waitFor(() => statuses.includes('connected'));
    await waitFor(() => states.length >= 1); // hub pushes full state on WS open

    client.dispatch('setGain', { ch: 2, db: -9 });
    await waitFor(() => hub.getState().channels[2].gainDb === -9);
    await waitFor(() => client.getState()?.channels[2].gainDb === -9); // mirrored back over WS
    expect(frames.length).toBe(1);

    client.disconnect();
  });

  it('rejects a bad pairing code', async () => {
    const { hub } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    const client = new HubClient();
    const { http } = parseHost(`127.0.0.1:${srv.port}`);
    const wrong = srv.code === '000000' ? '111111' : '000000';
    await expect(client.pair(http, wrong)).rejects.toThrow(/code/i);
  });
});

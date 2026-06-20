import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { Hub } from '../src/main/hub';
import { startServer, type ServerHandle } from '../src/main/server';

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

async function pair(port: number, code: string): Promise<string> {
  const r = await fetch(`http://127.0.0.1:${port}/api/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  expect(r.status).toBe(200);
  const body = (await r.json()) as { token: string };
  return body.token;
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

describe('LAN server', () => {
  it('pairs, dispatches a command over REST, and updates hub state', async () => {
    const { hub, frames } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    const token = await pair(srv.port, srv.code);

    const res = await fetch(`http://127.0.0.1:${srv.port}/api/command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'setGain', params: { ch: 2, db: -6 } }),
    });
    expect(res.status).toBe(200);
    expect(hub.getState().channels[2].gainDb).toBe(-6);
    expect(frames.length).toBe(1);
  });

  it('rejects an invalid command with 400', async () => {
    const { hub } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    const token = await pair(srv.port, srv.code);
    const res = await fetch(`http://127.0.0.1:${srv.port}/api/command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'setGain', params: { ch: 99, db: 0 } }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated requests and bad pairing codes', async () => {
    const { hub } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    expect((await fetch(`http://127.0.0.1:${srv.port}/api/state`)).status).toBe(401);
    const wrong = srv.code === '000000' ? '111111' : '000000';
    const r = await fetch(`http://127.0.0.1:${srv.port}/api/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: wrong }),
    });
    expect(r.status).toBe(401);
  });

  it('streams hello+state over WS and broadcasts after a command', async () => {
    const { hub } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    const token = await pair(srv.port, srv.code);

    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws?token=${token}`);
    const msgs: Array<Record<string, unknown>> = [];
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    await waitFor(() => msgs.length >= 2);
    expect(msgs[0].type).toBe('hello');
    expect(msgs[1].type).toBe('state');

    ws.send(JSON.stringify({ type: 'command', id: 1, name: 'setMute', params: { ch: 2, muted: true } }));
    await waitFor(() => msgs.some((m) => m.type === 'ack' && m.id === 1));
    await waitFor(() =>
      msgs.some((m) => m.type === 'state' && (m.state as { channels: { muted: boolean }[] }).channels[2].muted),
    );
    expect(hub.getState().channels[2].muted).toBe(true);
    ws.close();
  });

  it('serves /openapi.json unauthenticated with one operation per command', async () => {
    const { hub } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    const res = await fetch(`http://127.0.0.1:${srv.port}/openapi.json`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      openapi: string;
      paths: Record<string, { post?: { operationId?: string } }>;
    };
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/api/command/setGain']?.post?.operationId).toBe('setGain');
    expect(doc.paths['/api/command/loadPreset']?.post).toBeDefined();
  });

  it('/api/schema returns params JSON-Schema per command', async () => {
    const { hub } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    const token = await pair(srv.port, srv.code);
    const res = await fetch(`http://127.0.0.1:${srv.port}/api/schema`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { commands: Array<{ name: string; params: { type: string } }> };
    const setGain = body.commands.find((c) => c.name === 'setGain');
    expect(setGain?.params).toMatchObject({ type: 'object' });
  });

  it('dispatches via the per-command route POST /api/command/{name}', async () => {
    const { hub, frames } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    const token = await pair(srv.port, srv.code);
    const res = await fetch(`http://127.0.0.1:${srv.port}/api/command/setGain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ch: 3, db: -12 }),
    });
    expect(res.status).toBe(200);
    expect(hub.getState().channels[3].gainDb).toBe(-12);
    expect(frames.length).toBe(1);
  });

  it('accepts a shared static token from DSP206_TOKEN (headless agent path)', async () => {
    const { hub } = makeHub();
    process.env.DSP206_TOKEN = 'static-test-token-1234';
    try {
      srv = await startServer(hub, { port: 0, mdns: false });
      const res = await fetch(`http://127.0.0.1:${srv.port}/api/state`, {
        headers: { authorization: 'Bearer static-test-token-1234' },
      });
      expect(res.status).toBe(200);
    } finally {
      delete process.env.DSP206_TOKEN;
    }
  });

  it('rejects a WS upgrade without a valid token', async () => {
    const { hub } = makeHub();
    srv = await startServer(hub, { port: 0, mdns: false });
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws?token=nope`);
    await expect(
      new Promise((_resolve, reject) => {
        ws.on('open', () => reject(new Error('should not open')));
        ws.on('error', () => reject(new Error('unauthorized')));
        ws.on('unexpected-response', () => reject(new Error('unauthorized')));
      }),
    ).rejects.toThrow();
  });
});

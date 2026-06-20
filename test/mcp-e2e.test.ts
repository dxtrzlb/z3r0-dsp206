// End-to-end: spawn the built MCP stdio server, point it at a live hub via the shared-token
// path, and drive it with real JSON-RPC over stdin/stdout. Skips if the package isn't built.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hub } from '../src/main/hub';
import { startServer, type ServerHandle } from '../src/main/server';

const MCP_DIST = fileURLToPath(new URL('../packages/mcp/dist/index.js', import.meta.url));
const suite = existsSync(MCP_DIST) ? describe : describe.skip;
const TOKEN = 'e2e-shared-token-abcdef';

interface RpcResponse {
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

suite('MCP <-> hub end to end', () => {
  let srv: ServerHandle;
  let hub: Hub;
  let child: ChildProcessWithoutNullStreams;
  const pending = new Map<number, (msg: RpcResponse) => void>();
  let nextId = 1;

  const rpc = (method: string, params?: unknown): Promise<RpcResponse> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`rpc timeout: ${method}`));
      }, 5000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  };
  const notify = (method: string): void => {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  };

  beforeAll(async () => {
    process.env.DSP206_TOKEN = TOKEN;
    hub = new Hub({ send: () => {} });
    srv = await startServer(hub, { port: 0, mdns: false });
    child = spawn(process.execPath, [MCP_DIST], {
      env: { ...process.env, DSP206_URL: `http://127.0.0.1:${srv.port}`, DSP206_TOKEN: TOKEN },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    createInterface({ input: child.stdout }).on('line', (line) => {
      const t = line.trim();
      if (!t) return;
      let msg: RpcResponse;
      try {
        msg = JSON.parse(t) as RpcResponse;
      } catch {
        return;
      }
      if (typeof msg.id === 'number') pending.get(msg.id)?.(msg);
    });
  });

  afterAll(async () => {
    child?.kill();
    await srv?.close();
    delete process.env.DSP206_TOKEN;
  });

  it('initializes and reports server info', async () => {
    const r = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'vitest', version: '0' },
    });
    expect((r.result?.serverInfo as { name: string }).name).toBe('z3r0-dsp206');
    notify('notifications/initialized');
  });

  it('lists one tool per command discovered from the live hub', async () => {
    const r = await rpc('tools/list');
    const names = (r.result?.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('dsp_get_state');
    expect(names).toContain('dsp_setGain');
    expect(names).toContain('dsp_loadPreset');
  });

  it('forwards a command tool call that mutates hub state', async () => {
    const r = await rpc('tools/call', { name: 'dsp_setGain', arguments: { ch: 4, db: -8 } });
    expect(r.result?.isError).toBe(false);
    expect(hub.getState().channels[4].gainDb).toBe(-8);
  });

  it('reads live state back through the dsp_get_state tool', async () => {
    const r = await rpc('tools/call', { name: 'dsp_get_state', arguments: {} });
    const text = (r.result?.content as Array<{ text: string }>)[0].text;
    const state = JSON.parse(text) as { channels: Array<{ gainDb: number }> };
    expect(state.channels[4].gainDb).toBe(-8);
  });

  it('refuses a destructive tool without confirm:true', async () => {
    const r = await rpc('tools/call', { name: 'dsp_loadPreset', arguments: { presetNum: 1 } });
    expect(r.result?.isError).toBe(true);
    const text = (r.result?.content as Array<{ text: string }>)[0].text;
    expect(text).toMatch(/confirm/i);
  });
});

// LAN network server: REST + WebSocket over the command registry, gated by a pairing token.
// Clients pair once (POST /api/pair with the code shown in the desktop app) to get a bearer token,
// then drive the DSP over REST (one-shot) or WS (live state + meter stream + command dispatch).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Bonjour, type Service } from 'bonjour-service';
import { commandList, commandSchemas, buildOpenApi, type CommandName } from '@z3r0/core';
import type { Hub } from './hub';

export interface ServerOptions {
  port?: number;
  mdns?: boolean;
}
export interface ServerHandle {
  port: number;
  code: string;
  close: () => Promise<void>;
}

const DEFAULT_PORT = 7206;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(s) });
  res.end(s);
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export async function startServer(hub: Hub, opts: ServerOptions = {}): Promise<ServerHandle> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0'); // 6-digit pairing code
  const tokens = new Set<string>();
  // Optional shared token for headless agents (MCP / Hermes): if the hub and the agent both
  // read DSP206_TOKEN from env, the agent skips interactive code pairing. Ignored if too short.
  const staticToken = process.env.DSP206_TOKEN;
  if (staticToken && staticToken.length >= 8) tokens.add(staticToken);

  const tokenOf = (auth?: string): string | undefined =>
    auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  const authed = (req: IncomingMessage): boolean => {
    const t = tokenOf(req.headers['authorization']);
    return t !== undefined && tokens.has(t);
  };

  const httpServer: Server = createServer((req, res) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';
    try {
      if (method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true });
      if (method === 'POST' && pathname === '/api/pair') {
        const body = (await readJson(req)) as { code?: string };
        if (body.code === code) {
          const token = randomUUID();
          tokens.add(token);
          return sendJson(res, 200, { token });
        }
        return sendJson(res, 401, { error: 'bad pairing code' });
      }
      if (method === 'GET' && pathname === '/openapi.json') {
        const host = req.headers.host ?? `localhost:${DEFAULT_PORT}`;
        return sendJson(res, 200, buildOpenApi({ servers: [`http://${host}`] }));
      }
      if (!authed(req)) return sendJson(res, 401, { error: 'unauthorized' });

      if (method === 'GET' && pathname === '/api/state') return sendJson(res, 200, hub.getState());
      if (method === 'GET' && pathname === '/api/meters') return sendJson(res, 200, hub.getMeters());
      if (method === 'GET' && pathname === '/api/schema')
        return sendJson(res, 200, { commands: commandSchemas() });
      if (method === 'POST' && pathname === '/api/command') {
        const body = (await readJson(req)) as { name?: CommandName; params?: unknown };
        try {
          hub.dispatch(body.name as CommandName, body.params);
          return sendJson(res, 200, { ok: true });
        } catch (e) {
          return sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) });
        }
      }
      // Per-command route — one URL per command, so the OpenAPI doc gives Hermes/LLMs a typed
      // operation per command (body = that command's params). Backs the generated /openapi.json.
      if (method === 'POST' && pathname.startsWith('/api/command/')) {
        const name = decodeURIComponent(pathname.slice('/api/command/'.length)) as CommandName;
        try {
          hub.dispatch(name, await readJson(req));
          return sendJson(res, 200, { ok: true });
        } catch (e) {
          return sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) });
        }
      }
      return sendJson(res, 404, { error: 'not found' });
    } catch (e) {
      return sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  }

  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws' || !tokens.has(url.searchParams.get('token') ?? '')) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });

  const sendWs = (ws: WebSocket, msg: unknown): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  wss.on('connection', (ws: WebSocket) => {
    sendWs(ws, { type: 'hello', schema: { commands: commandList() } });
    sendWs(ws, { type: 'state', state: hub.getState() });
    ws.on('message', (data) => {
      let msg: { type?: string; id?: unknown; name?: CommandName; params?: unknown };
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg.type === 'command') {
        try {
          hub.dispatch(msg.name as CommandName, msg.params);
          sendWs(ws, { type: 'ack', id: msg.id, ok: true });
        } catch (e) {
          sendWs(ws, { type: 'ack', id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
    });
  });

  const broadcast = (msg: unknown): void => {
    const s = JSON.stringify(msg);
    for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(s);
  };
  const offState = hub.onState((state) => broadcast({ type: 'state', state }));
  const offMeters = hub.onMeters((values) => broadcast({ type: 'meters', values }));

  await new Promise<void>((resolve) => httpServer.listen(opts.port ?? DEFAULT_PORT, resolve));
  const addr = httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : (opts.port ?? DEFAULT_PORT);

  let bonjour: Bonjour | undefined;
  let service: Service | undefined;
  if (opts.mdns !== false) {
    bonjour = new Bonjour();
    service = bonjour.publish({ name: 'z3r0 DSP 206', type: 'dsp206', port });
  }

  const close = async (): Promise<void> => {
    offState();
    offMeters();
    for (const c of wss.clients) c.terminate();
    await new Promise<void>((r) => wss.close(() => r()));
    if (bonjour) {
      service?.stop?.(() => {});
      bonjour.destroy();
    }
    await new Promise<void>((r) => httpServer.close(() => r()));
  };

  return { port, code, close };
}

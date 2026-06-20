#!/usr/bin/env node
// z3r0 DSP 206 — Model Context Protocol stdio server.
//
// A thin, zero-dependency bridge. It discovers the device's command catalog from the running
// hub (GET /api/schema) and exposes one MCP tool per command (plus state/meter readers). Tool
// calls are forwarded to the hub over REST. Transport is newline-delimited JSON-RPC 2.0 on
// stdin/stdout; all logging goes to stderr so stdout stays a clean protocol channel.
//
// Configuration (env):
//   DSP206_URL    hub base URL (default http://127.0.0.1:7206)
//   DSP206_TOKEN  shared bearer token (matches the hub's DSP206_TOKEN) — preferred, no pairing
//   DSP206_CODE   6-digit pairing code shown in the desktop app (used if no token is set)
import { createInterface } from 'node:readline';
import { buildTools, resolveTool, STATIC_TOOLS, type CommandSchema, type McpTool } from './tools.js';

const SERVER_NAME = 'z3r0-dsp206';
const SERVER_VERSION = '0.1.0';
const PROTOCOL_VERSION = '2025-06-18';

const BASE_URL = (process.env.DSP206_URL ?? 'http://127.0.0.1:7206').replace(/\/+$/, '');
const ENV_TOKEN = process.env.DSP206_TOKEN;
const ENV_CODE = process.env.DSP206_CODE ?? process.env.DSP206_PAIR_CODE;

const log = (...a: unknown[]): void => console.error('[dsp206-mcp]', ...a);

let cachedToken: string | undefined = ENV_TOKEN;
let cachedTools: McpTool[] | undefined;

async function getToken(): Promise<string | undefined> {
  if (cachedToken) return cachedToken;
  if (!ENV_CODE) return undefined;
  const res = await fetch(`${BASE_URL}/api/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: ENV_CODE }),
  });
  if (!res.ok) throw new Error(`pairing failed (HTTP ${res.status}) — check DSP206_CODE`);
  cachedToken = ((await res.json()) as { token: string }).token;
  return cachedToken;
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers['authorization'] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`cannot reach the DSP hub at ${BASE_URL} — is the desktop app running?`);
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = (data as { error?: string }).error;
    throw new Error(err ?? `HTTP ${res.status}`);
  }
  return data;
}

async function loadTools(): Promise<McpTool[]> {
  if (cachedTools) return cachedTools;
  const data = (await api('GET', '/api/schema')) as { commands: CommandSchema[] };
  cachedTools = buildTools(data.commands);
  return cachedTools;
}

interface CallResult {
  text: string;
  isError?: boolean;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<CallResult> {
  const target = resolveTool(name);
  if (!target) return { text: `Unknown tool: ${name}`, isError: true };
  try {
    if (target.kind === 'state') return { text: JSON.stringify(await api('GET', '/api/state')) };
    if (target.kind === 'meters') return { text: JSON.stringify(await api('GET', '/api/meters')) };

    const tool = (await loadTools()).find((t) => t.name === name);
    const destructive = tool?.annotations?.destructiveHint === true;
    const payload = { ...args };
    if (destructive) {
      if (payload.confirm !== true)
        return {
          text: `'${target.command}' is destructive. Re-call with confirm:true once the user has confirmed.`,
          isError: true,
        };
      delete payload.confirm;
    }
    await api('POST', `/api/command/${encodeURIComponent(target.command)}`, payload);
    return { text: `ok — ${target.command}(${JSON.stringify(payload)})` };
  } catch (e) {
    return { text: e instanceof Error ? e.message : String(e), isError: true };
  }
}

// ---- JSON-RPC 2.0 over stdio ------------------------------------------------------------
interface RpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function send(msg: object): void {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}
function reply(id: RpcMessage['id'], result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}
function fail(id: RpcMessage['id'], code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(msg: RpcMessage): Promise<void> {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      reply(id, {
        protocolVersion: typeof requested === 'string' ? requested : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          'Controls a t.racks DSP 206. Read with dsp_get_state / dsp_get_meters; change settings with dsp_<command> tools. Destructive preset tools require confirm:true.',
      });
      return;
    }
    case 'notifications/initialized':
      return; // notification: no response
    case 'ping':
      reply(id, {});
      return;
    case 'tools/list': {
      let tools: McpTool[];
      try {
        tools = await loadTools();
      } catch (e) {
        log('schema fetch failed:', e instanceof Error ? e.message : e);
        tools = STATIC_TOOLS; // still expose the readers; per-command tools appear once the hub is up
      }
      reply(id, { tools });
      return;
    }
    case 'tools/call': {
      const name = String(params?.name ?? '');
      const args = (params?.arguments as Record<string, unknown> | undefined) ?? {};
      const r = await callTool(name, args);
      reply(id, { content: [{ type: 'text', text: r.text }], isError: r.isError ?? false });
      return;
    }
    default:
      if (id !== undefined && id !== null) fail(id, -32601, `Method not found: ${method ?? ''}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: RpcMessage;
  try {
    msg = JSON.parse(trimmed) as RpcMessage;
  } catch {
    return; // ignore non-JSON noise
  }
  void handle(msg).catch((e) => {
    log('handler error:', e);
    if (msg.id !== undefined && msg.id !== null)
      fail(msg.id, -32603, e instanceof Error ? e.message : String(e));
  });
});
rl.on('close', () => process.exit(0));

log(
  `ready — hub ${BASE_URL}` +
    (cachedToken ? ' (token set)' : ENV_CODE ? ' (will pair via DSP206_CODE)' : ' (no auth configured)'),
);

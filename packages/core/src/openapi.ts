// OpenAPI 3.1 document generator for the LAN REST API.
// Lets Hermes (or any OpenAPI-aware LLM/tool) drive the DSP: one operation per registry
// command, each carrying that command's JSON-Schema request body. Generated from the same
// command registry that powers IPC/WS/MCP, so it never drifts from the real device contract.
import { commandSchemas, type CommandSchema } from './registry';

export interface OpenApiOptions {
  servers?: string[];
  version?: string;
}

const okResponse = {
  description: 'Applied',
  content: {
    'application/json': {
      schema: { type: 'object', properties: { ok: { const: true } }, required: ['ok'] },
    },
  },
};

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] },
    },
  },
});

function commandOperation(c: CommandSchema): Record<string, unknown> {
  return {
    operationId: c.name,
    summary: c.description,
    description: c.destructive
      ? `${c.description}\n\nDESTRUCTIVE: replaces or overwrites stored device data — confirm intent first.`
      : c.description,
    tags: [c.scope],
    'x-destructive': c.destructive,
    requestBody: {
      required: true,
      content: { 'application/json': { schema: c.params } },
    },
    responses: {
      '200': okResponse,
      '400': errorResponse('Invalid parameters'),
      '401': errorResponse('Unauthorized — pair first'),
    },
  };
}

export function buildOpenApi(opts: OpenApiOptions = {}): Record<string, unknown> {
  const paths: Record<string, unknown> = {
    '/api/health': {
      get: {
        operationId: 'health',
        summary: 'Liveness check',
        security: [],
        responses: { '200': okResponse },
      },
    },
    '/api/pair': {
      post: {
        operationId: 'pair',
        summary: 'Exchange the 6-digit pairing code (shown in the desktop app) for a bearer token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
            },
          },
        },
        responses: {
          '200': {
            description: 'Bearer token',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] },
              },
            },
          },
          '401': errorResponse('Bad pairing code'),
        },
      },
    },
    '/api/state': {
      get: {
        operationId: 'getState',
        summary: 'Full DSP state (every channel: gain, mute, polarity, EQ, crossover, dynamics, routing)',
        responses: { '200': { description: 'Current DSP state' } },
      },
    },
    '/api/meters': {
      get: {
        operationId: 'getMeters',
        summary: 'Live meter levels — 8 linear values 0..1 (indexes 2..7 are outputs 1..6)',
        responses: { '200': { description: 'Meter levels' } },
      },
    },
    '/api/schema': {
      get: {
        operationId: 'getSchema',
        summary: 'Machine-readable command catalog with JSON-Schema params',
        responses: { '200': { description: 'Command catalog' } },
      },
    },
  };

  for (const c of commandSchemas()) {
    paths[`/api/command/${c.name}`] = { post: commandOperation(c) };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'z3r0 DSP 206 Control API',
      version: opts.version ?? '0.1.0',
      description:
        'Control a t.racks DSP 206 over the LAN. Pair once with the 6-digit code shown in the desktop app to get a bearer token, then call commands. Destructive operations (preset load/store) are flagged with x-destructive.',
    },
    servers: (opts.servers ?? ['http://localhost:7206']).map((url) => ({ url })),
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    security: [{ bearer: [] }],
    tags: [
      { name: 'channel', description: 'Per-channel processing' },
      { name: 'global', description: 'Device-wide operations' },
    ],
    paths,
  };
}

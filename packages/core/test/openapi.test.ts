import { describe, it, expect } from 'vitest';
import { buildOpenApi } from '../src/openapi';
import { commandSchemas, commandList, paramsJsonSchema } from '../src/registry';

describe('command schemas', () => {
  it('emits JSON-Schema params for every command', () => {
    const schemas = commandSchemas();
    expect(schemas.length).toBe(commandList().length);
    for (const c of schemas) {
      expect(c.params).toMatchObject({ type: 'object' });
      expect(c.params).not.toHaveProperty('$schema'); // stripped for inline embedding
    }
  });

  it('setGain params describe the ch + db fields with their bounds', () => {
    const s = paramsJsonSchema('setGain');
    const props = s.properties as Record<string, { type: string; minimum?: number; maximum?: number }>;
    expect(props.ch).toMatchObject({ type: 'integer', minimum: 0, maximum: 7 });
    expect(props.db).toMatchObject({ type: 'number', minimum: -60, maximum: 20 });
    expect(s.required).toEqual(expect.arrayContaining(['ch', 'db']));
  });
});

describe('OpenAPI document', () => {
  const doc = buildOpenApi({ servers: ['http://dsp.local:7206'] });
  const paths = doc.paths as Record<string, { post?: Record<string, unknown>; get?: unknown }>;

  it('is a valid 3.1 doc with bearer security and the given server', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.security).toEqual([{ bearer: [] }]);
    expect(doc.servers).toEqual([{ url: 'http://dsp.local:7206' }]);
  });

  it('exposes one operation per command with its param schema as the request body', () => {
    for (const c of commandSchemas()) {
      const op = paths[`/api/command/${c.name}`]?.post as Record<string, unknown> | undefined;
      expect(op, c.name).toBeDefined();
      expect(op!.operationId).toBe(c.name);
      const body = op!.requestBody as { content: { 'application/json': { schema: unknown } } };
      expect(body.content['application/json'].schema).toEqual(c.params);
    }
  });

  it('flags destructive commands and leaves health/pair unauthenticated', () => {
    const load = paths['/api/command/loadPreset'].post as Record<string, unknown>;
    expect(load['x-destructive']).toBe(true);
    const setGain = paths['/api/command/setGain'].post as Record<string, unknown>;
    expect(setGain['x-destructive']).toBe(false);
    expect((paths['/api/pair'].post as { security: unknown[] }).security).toEqual([]);
    expect((paths['/api/health'].get as { security: unknown[] }).security).toEqual([]);
  });
});

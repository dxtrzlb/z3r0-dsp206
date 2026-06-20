import { describe, it, expect } from 'vitest';
import { buildTools, commandToTool, resolveTool, STATIC_TOOLS, type CommandSchema } from '../src/tools.js';

const setGain: CommandSchema = {
  name: 'setGain',
  scope: 'channel',
  description: 'Set a channel output gain in dB.',
  destructive: false,
  params: {
    type: 'object',
    properties: { ch: { type: 'integer' }, db: { type: 'number' } },
    required: ['ch', 'db'],
  },
};

const loadPreset: CommandSchema = {
  name: 'loadPreset',
  scope: 'global',
  description: 'Load a stored preset.',
  destructive: true,
  params: { type: 'object', properties: { presetNum: { type: 'integer' } }, required: ['presetNum'] },
};

describe('MCP tool building', () => {
  it('prefixes command names and passes the param schema straight through', () => {
    const t = commandToTool(setGain);
    expect(t.name).toBe('dsp_setGain');
    expect(t.inputSchema).toEqual(setGain.params);
    expect(t.annotations?.destructiveHint).toBeUndefined();
  });

  it('gates destructive commands behind a required confirm:true', () => {
    const t = commandToTool(loadPreset);
    expect(t.annotations?.destructiveHint).toBe(true);
    const props = t.inputSchema.properties as Record<string, { const?: unknown }>;
    expect(props.confirm).toMatchObject({ type: 'boolean', const: true });
    expect(t.inputSchema.required).toEqual(['presetNum', 'confirm']);
    expect(t.description).toMatch(/DESTRUCTIVE/);
  });

  it('builds the static readers plus one tool per command', () => {
    const tools = buildTools([setGain, loadPreset]);
    expect(tools.length).toBe(STATIC_TOOLS.length + 2);
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['dsp_get_state', 'dsp_get_meters', 'dsp_setGain', 'dsp_loadPreset']),
    );
  });

  it('resolves tool names back to their target', () => {
    expect(resolveTool('dsp_get_state')).toEqual({ kind: 'state' });
    expect(resolveTool('dsp_get_meters')).toEqual({ kind: 'meters' });
    expect(resolveTool('dsp_setGain')).toEqual({ kind: 'command', command: 'setGain' });
    expect(resolveTool('bogus')).toBeUndefined();
  });
});

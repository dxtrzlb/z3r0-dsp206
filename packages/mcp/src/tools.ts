// Pure helpers: turn the hub's /api/schema command catalog into MCP tool descriptors.
// Kept free of Node/IO so it can be unit-tested directly.

export type JsonSchema = Record<string, unknown>;

export interface CommandSchema {
  name: string;
  scope: 'channel' | 'global';
  description: string;
  destructive: boolean;
  params: JsonSchema;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: Record<string, unknown>;
}

export const TOOL_PREFIX = 'dsp_';

// Always-present read-only tools, independent of the command catalog.
export const STATIC_TOOLS: McpTool[] = [
  {
    name: 'dsp_get_state',
    description:
      'Read the full current DSP state (every channel: gain, mute, polarity, parametric EQ, crossover, dynamics, delay, routing).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Get DSP state', readOnlyHint: true },
  },
  {
    name: 'dsp_get_meters',
    description:
      'Read live meter levels: an array of 8 linear values 0..1. Index 0=In A, 1=In B, 2..7=Out 1..6.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Get meters', readOnlyHint: true },
  },
];

const CONFIRM_PROP: JsonSchema = {
  type: 'boolean',
  const: true,
  description: 'Must be true to run this destructive action. Confirm the user intends it before calling.',
};

// A destructive command gets a required `confirm: true` gate added to its input schema.
export function commandToTool(c: CommandSchema): McpTool {
  const base: JsonSchema =
    c.params && typeof c.params === 'object' ? c.params : { type: 'object', properties: {} };
  const annotations: Record<string, unknown> = { title: c.name };

  let inputSchema = base;
  if (c.destructive) {
    const props = (base.properties as Record<string, unknown> | undefined) ?? {};
    const required = Array.isArray(base.required) ? (base.required as string[]) : [];
    inputSchema = {
      ...base,
      properties: { ...props, confirm: CONFIRM_PROP },
      required: [...required, 'confirm'],
    };
    annotations.destructiveHint = true;
  }

  return {
    name: TOOL_PREFIX + c.name,
    description: c.destructive ? `${c.description} (DESTRUCTIVE — pass confirm:true)` : c.description,
    inputSchema,
    annotations,
  };
}

export function buildTools(commands: CommandSchema[]): McpTool[] {
  return [...STATIC_TOOLS, ...commands.map(commandToTool)];
}

export type ToolTarget =
  | { kind: 'state' }
  | { kind: 'meters' }
  | { kind: 'command'; command: string };

// Map a tool name back to what it does. Returns undefined for unknown tools.
export function resolveTool(name: string): ToolTarget | undefined {
  if (name === 'dsp_get_state') return { kind: 'state' };
  if (name === 'dsp_get_meters') return { kind: 'meters' };
  if (name.startsWith(TOOL_PREFIX)) return { kind: 'command', command: name.slice(TOOL_PREFIX.length) };
  return undefined;
}

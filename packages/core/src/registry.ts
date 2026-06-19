// Command registry — the single source of truth for every mutating operation.
// One declaration per command drives IPC, WS, REST, OpenAPI, MCP, and shared types.
// Each `apply` is pure: (params, state) -> { next state, HID frames to send }.
import { z } from 'zod';
import * as build from './commands';
import {
  type DspState,
  type PeqBand,
  FREQ_MIN,
  FREQ_MAX,
  defaultBand,
  patchChannel,
} from './state';

export interface CommandResult {
  state: DspState;
  frames: number[][];
}

export interface CommandDef {
  scope: 'channel' | 'global';
  description: string;
  destructive: boolean;
  params: z.ZodTypeAny;
  apply: (params: never, state: DspState) => CommandResult;
}

// Reusable field schemas.
const ch = z.number().int().min(0).max(7);
const outCh = z.number().int().min(2).max(7);
const inIdx = z.number().int().min(0).max(1);
const db = z.number().min(-60).max(20);
const peqPatch = z
  .object({
    gainDb: z.number(),
    hz: z.number(),
    q: z.number(),
    type: z.number().int(),
    bypass: z.boolean(),
  })
  .partial();

// Per-command param schemas (named so apply() can infer them).
const gainP = z.object({ ch, db });
const muteP = z.object({ ch, muted: z.boolean() });
const polarityP = z.object({ ch, inverted: z.boolean() });
const routeP = z.object({ outCh, inIdx, on: z.boolean() });
const levelP = z.object({ outCh, inIdx, db });
const peqBandP = z.object({ ch, band: z.number().int().min(0), patch: peqPatch });
const peqAddP = z.object({ ch });
const xoverP = z.object({ ch, hz: z.number().optional(), on: z.boolean().optional() });
const delayP = z.object({ ch, ms: z.number().min(0) });
const limiterP = z.object({
  ch,
  attackMs: z.number().optional(),
  releaseMs: z.number().optional(),
  threshDb: z.number().optional(),
});
const compP = z.object({
  ch,
  ratio: z.number().int().optional(),
  attackMs: z.number().optional(),
  releaseMs: z.number().optional(),
  kneeDb: z.number().optional(),
  threshDb: z.number().optional(),
});
const gateP = z.object({
  ch,
  attackMs: z.number().optional(),
  releaseMs: z.number().optional(),
  holdMs: z.number().optional(),
  threshDb: z.number().optional(),
});
const geqP = z.object({ ch, band: z.number().int().min(0).max(30), db: z.number() });
const signalP = z.object({
  signal: z.enum(['analog', 'sine', 'pink', 'white']),
  sineFreqIndex: z.number().int().min(0).optional(),
});
const presetNumP = z.object({ presetNum: z.number().int().min(0).max(31) });
const slotP = z.object({ slot: z.number().int().min(1).max(31) });
const nameP = z.object({ name: z.string().max(20) });
const muteAllP = z.object({ muted: z.boolean() });

// Preserves the precise param type per command (do NOT annotate the return as CommandDef —
// that would widen `params` to ZodTypeAny and erase the inferred param types for clients).
const cmd = <S extends z.ZodTypeAny>(def: {
  scope: 'channel' | 'global';
  description: string;
  destructive?: boolean;
  params: S;
  apply: (p: z.infer<S>, s: DspState) => CommandResult;
}) => ({ destructive: false as boolean, ...def });

export const COMMANDS = {
  setGain: cmd({
    scope: 'channel',
    description: 'Set a channel output gain in dB (-60..+20).',
    params: gainP,
    apply: (p, s) => ({
      state: patchChannel(s, p.ch, (c) => ({ ...c, gainDb: p.db })),
      frames: [build.setGain(p.ch, p.db)],
    }),
  }),
  setMute: cmd({
    scope: 'channel',
    description: 'Mute or unmute a channel.',
    params: muteP,
    apply: (p, s) => ({
      state: patchChannel(s, p.ch, (c) => ({ ...c, muted: p.muted })),
      frames: [build.setMute(p.ch, p.muted)],
    }),
  }),
  setPolarity: cmd({
    scope: 'channel',
    description: 'Set channel polarity (false = Normal, true = Inverse).',
    params: polarityP,
    apply: (p, s) => ({
      state: patchChannel(s, p.ch, (c) => ({ ...c, inverted: p.inverted })),
      frames: [build.setPolarity(p.ch, p.inverted)],
    }),
  }),
  setRoute: cmd({
    scope: 'channel',
    description: 'Route an input (0=In A, 1=In B) to an output on/off.',
    params: routeP,
    apply: (p, s) => {
      const bit = p.inIdx === 0 ? 0x01 : 0x02;
      const mask = p.on ? s.channels[p.outCh].routeMask | bit : s.channels[p.outCh].routeMask & ~bit;
      return {
        state: patchChannel(s, p.outCh, (c) => ({ ...c, routeMask: mask })),
        frames: [build.setMatrixRoute(p.outCh, mask)],
      };
    },
  }),
  setMatrixLevel: cmd({
    scope: 'channel',
    description: 'Set the matrix mix level (dB) of an input into an output.',
    params: levelP,
    apply: (p, s) => ({
      state: patchChannel(s, p.outCh, (c) => {
        const inLevel = c.inLevel.slice() as [number, number];
        inLevel[p.inIdx] = p.db;
        return { ...c, inLevel };
      }),
      frames: [build.setMatrixLevel(p.outCh, p.inIdx, p.db)],
    }),
  }),
  setPeqBand: cmd({
    scope: 'channel',
    description: 'Update a parametric EQ band (partial: gainDb/hz/q/type/bypass).',
    params: peqBandP,
    apply: (p, s) => {
      const merged: PeqBand = { ...s.channels[p.ch].peq[p.band], ...p.patch };
      return {
        state: patchChannel(s, p.ch, (c) => {
          const peq = c.peq.slice();
          peq[p.band] = merged;
          return { ...c, peq };
        }),
        frames: [build.setPeqBand(p.ch, p.band, merged)],
      };
    },
  }),
  addPeqBand: cmd({
    scope: 'channel',
    description: 'Append a new default parametric EQ band.',
    params: peqAddP,
    apply: (p, s) => {
      const band = s.channels[p.ch].peq.length;
      const nb = defaultBand(1000);
      return {
        state: patchChannel(s, p.ch, (c) => ({ ...c, peq: [...c.peq, nb] })),
        frames: [build.setPeqBand(p.ch, band, nb)],
      };
    },
  }),
  removePeqBand: cmd({
    scope: 'channel',
    description: 'Remove the last parametric EQ band (bypasses it on the device first).',
    params: peqAddP,
    apply: (p, s) => {
      const peq = s.channels[p.ch].peq;
      if (peq.length <= 1) return { state: s, frames: [] };
      const band = peq.length - 1;
      return {
        state: patchChannel(s, p.ch, (c) => ({ ...c, peq: c.peq.slice(0, -1) })),
        frames: [build.setPeqBand(p.ch, band, { ...peq[band], bypass: true })],
      };
    },
  }),
  setHpf: cmd({
    scope: 'channel',
    description: 'Set the high-pass filter frequency and on/off.',
    params: xoverP,
    apply: (p, s) => {
      const hpf = {
        hz: p.hz === undefined ? s.channels[p.ch].hpf.hz : p.hz,
        on: p.on === undefined ? s.channels[p.ch].hpf.on : p.on,
      };
      return {
        state: patchChannel(s, p.ch, (c) => ({ ...c, hpf })),
        frames: [build.setHpf(p.ch, hpf.on ? hpf.hz : FREQ_MIN)],
      };
    },
  }),
  setLpf: cmd({
    scope: 'channel',
    description: 'Set the low-pass filter frequency and on/off.',
    params: xoverP,
    apply: (p, s) => {
      const lpf = {
        hz: p.hz === undefined ? s.channels[p.ch].lpf.hz : p.hz,
        on: p.on === undefined ? s.channels[p.ch].lpf.on : p.on,
      };
      return {
        state: patchChannel(s, p.ch, (c) => ({ ...c, lpf })),
        frames: [build.setLpf(p.ch, lpf.on ? lpf.hz : FREQ_MAX)],
      };
    },
  }),
  setDelay: cmd({
    scope: 'channel',
    description: 'Set channel delay in milliseconds.',
    params: delayP,
    apply: (p, s) => ({
      state: patchChannel(s, p.ch, (c) => ({ ...c, delayMs: p.ms })),
      frames: [build.setDelay(p.ch, p.ms)],
    }),
  }),
  setLimiter: cmd({
    scope: 'channel',
    description: 'Update the limiter (partial: attackMs/releaseMs/threshDb).',
    params: limiterP,
    apply: (p, s) => {
      const cur = s.channels[p.ch].limiter;
      const limiter = {
        attackMs: p.attackMs ?? cur.attackMs,
        releaseMs: p.releaseMs ?? cur.releaseMs,
        threshDb: p.threshDb ?? cur.threshDb,
      };
      return {
        state: patchChannel(s, p.ch, (c) => ({ ...c, limiter })),
        frames: [build.setLimiter(p.ch, limiter.attackMs, limiter.releaseMs, limiter.threshDb)],
      };
    },
  }),
  setCompressor: cmd({
    scope: 'channel',
    description: 'Update the compressor (partial: ratio/attackMs/releaseMs/kneeDb/threshDb).',
    params: compP,
    apply: (p, s) => {
      const cur = s.channels[p.ch].compressor;
      const compressor = {
        ratio: p.ratio ?? cur.ratio,
        attackMs: p.attackMs ?? cur.attackMs,
        releaseMs: p.releaseMs ?? cur.releaseMs,
        kneeDb: p.kneeDb ?? cur.kneeDb,
        threshDb: p.threshDb ?? cur.threshDb,
      };
      return {
        state: patchChannel(s, p.ch, (c) => ({ ...c, compressor })),
        frames: [
          build.setCompressor(
            p.ch,
            compressor.ratio,
            compressor.attackMs,
            compressor.releaseMs,
            compressor.kneeDb,
            compressor.threshDb,
          ),
        ],
      };
    },
  }),
  setGate: cmd({
    scope: 'channel',
    description: 'Update the noise gate (partial: attackMs/releaseMs/holdMs/threshDb).',
    params: gateP,
    apply: (p, s) => {
      const cur = s.channels[p.ch].gate;
      const gate = {
        attackMs: p.attackMs ?? cur.attackMs,
        releaseMs: p.releaseMs ?? cur.releaseMs,
        holdMs: p.holdMs ?? cur.holdMs,
        threshDb: p.threshDb ?? cur.threshDb,
      };
      return {
        state: patchChannel(s, p.ch, (c) => ({ ...c, gate })),
        frames: [build.setGate(p.ch, gate.attackMs, gate.releaseMs, gate.holdMs, gate.threshDb)],
      };
    },
  }),
  setGeqBand: cmd({
    scope: 'channel',
    description: 'Set a graphic-EQ band gain (inputs only, band 0..30).',
    params: geqP,
    apply: (p, s) => ({
      state: patchChannel(s, p.ch, (c) => {
        const geq = c.geq.slice();
        geq[p.band] = p.db;
        return { ...c, geq };
      }),
      frames: [build.setGeqBand(p.ch, p.band, p.db)],
    }),
  }),
  setInputSignal: cmd({
    scope: 'global',
    description: 'Select the input source / built-in test signal (analog, sine, pink, white).',
    params: signalP,
    apply: (p, s) => {
      const sineFreqIndex = p.sineFreqIndex ?? 0;
      return {
        state: { ...s, inputSignal: { signal: p.signal, sineFreqIndex } },
        frames: [build.setInputSignal(p.signal, sineFreqIndex)],
      };
    },
  }),
  muteAll: cmd({
    scope: 'global',
    description: 'Mute or unmute every channel at once (feedback safety).',
    params: muteAllP,
    apply: (p, s) => ({
      state: { ...s, channels: s.channels.map((c) => ({ ...c, muted: p.muted })) },
      frames: s.channels.map((_, i) => build.setMute(i, p.muted)),
    }),
  }),
  loadPreset: cmd({
    scope: 'global',
    description: 'Load a stored preset (0 = factory, 1..31 = user). Replaces all settings.',
    destructive: true,
    params: presetNumP,
    apply: (p, s) => ({ state: s, frames: [build.loadPreset(p.presetNum)] }),
  }),
  storePreset: cmd({
    scope: 'global',
    description: 'Store the current settings to a user slot (1..31). Overwrites the slot.',
    destructive: true,
    params: slotP,
    apply: (p, s) => ({ state: s, frames: [build.storePreset(p.slot)] }),
  }),
  setPresetName: cmd({
    scope: 'global',
    description: 'Set the preset name (sent before storePreset).',
    params: nameP,
    apply: (p, s) => ({ state: s, frames: [build.setPresetName(p.name)] }),
  }),
} satisfies Record<string, CommandDef>;

export type CommandName = keyof typeof COMMANDS;
export type CommandParams = { [K in CommandName]: z.infer<(typeof COMMANDS)[K]['params']> };

// Validate + apply. Throws ZodError on invalid params, Error on unknown command.
export function dispatch(state: DspState, name: CommandName, rawParams: unknown): CommandResult {
  const def = COMMANDS[name];
  if (!def) throw new Error(`unknown command: ${name}`);
  const params = def.params.parse(rawParams);
  return def.apply(params as never, state);
}

// Machine-readable descriptor for clients/agents (drives OpenAPI + MCP later).
export interface CommandSchema {
  name: string;
  scope: 'channel' | 'global';
  description: string;
  destructive: boolean;
  params: unknown; // JSON Schema (filled in at R4 via zod-to-json-schema)
}

export const commandList = (): Omit<CommandSchema, 'params'>[] =>
  (Object.keys(COMMANDS) as CommandName[]).map((name) => ({
    name,
    scope: COMMANDS[name].scope,
    description: COMMANDS[name].description,
    destructive: COMMANDS[name].destructive,
  }));

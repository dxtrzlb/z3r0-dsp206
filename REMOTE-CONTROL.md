# Feature: Remote & Programmatic Control (iPad + LLM)

> Design + phased plan. Goal: control the DSP 206 from (a) a native iPad app over WiFi and
> (b) LLM agents (Claude Code, Hermes) via prompts, in addition to the existing desktop app.

## Decisions (locked)
- **Hub = the Electron desktop app.** The cabled machine's Electron main process owns the USB-HID
  handle and also hosts the network server. iPad + LLMs are clients of it. (Desktop app must be
  running for remote control to work.)
- **iPad = native app in React Native + Expo** (TypeScript, reuses the core + command schema).
- **LLM access = both** an MCP server (for Claude Code/Desktop) and a plain HTTP API + OpenAPI
  (for Hermes / any agent framework).

## The hard constraint that shapes everything
The DSP is **USB-HID, single-owner** — one process, one machine. So iPad and LLMs cannot reach the
device directly; they go *through* the hub. Hub-and-spoke:

```
                    ┌─ desktop renderer (Electron, IPC)
USB ── HUB (Electron main, owns HID) ──┼─ iPad app (RN/Expo, WS+REST over WiFi)
   (cabled machine)   server: HTTP+WS  ├─ MCP server ── Claude Code / Hermes
                                       └─ HTTP+OpenAPI ── other agents
```

## Keystone: one command registry drives every surface
Today `commands.ts` is a whitelist of frame builders. Formalize it into a **registry** where each
command is declared once:

```ts
{ name: 'setGain',
  scope: 'channel',                 // channel | global
  params: z.object({ ch: z.number().int().min(0).max(7), db: z.number().min(-60).max(20) }),
  description: 'Set channel output gain in dB',
  destructive: false,               // gates confirmation on remote/LLM surfaces
  apply: (p, state) => ({ next, frames }) }   // updates canonical state + emits HID frame(s)
```

One registry → generates all of:
- Electron **IPC** dispatch (renderer keeps working)
- **WebSocket** command handling
- **REST** routes + **OpenAPI** spec
- **MCP** tool list
- shared **TypeScript types** for the iPad app

Add a command once, it appears on every surface, validated (zod) at every boundary.

Also register **read queries** (`getState`, `getMeters`, `getHealth`) and a few **macros /
intents** for the "auto-set" use case (e.g. `setupTwoWay(xoverHz, slope)`, `flattenEq(ch)`,
`muteAll()`, `recallPreset(name)`), implemented as composite commands.

## Canonical state moves into the hub
With three clients mutating one device, the hub owns the single source of truth.
- Main holds `DspState` (channels, meters, status, preset info).
- Every mutation: `dispatch(command)` → validate → update canonical state → emit HID frame(s) →
  **broadcast** the new state (or delta) to **all** clients (renderer via IPC, iPad/agents via WS).
- The renderer's zustand store becomes a **synced mirror** of hub state, not the source of truth.
- Meters fan out on the existing ~130 ms stream to every connected client (throttled).

## Network API
- **WebSocket** (live): `client→hub {type:'command', id, name, params}`;
  `hub→client {type:'hello', schema}` on connect, then `{type:'state'|'delta'}`,
  `{type:'meters', values}`, `{type:'ack', id, ok|error}`. New clients get a full snapshot +
  the registry schema so they're self-configuring.
- **REST** (one-shot / agents): `POST /api/command {name, params}`, `GET /api/state`,
  `GET /api/schema`, `GET /openapi.json`, meters via SSE or `GET /api/meters`.

## Security (live-sound safety matters — a stray command can blow drivers)
- **LAN-only** bind; **pairing**: desktop shows a short code / QR, client exchanges it for a bearer
  token; token required on WS connect + REST.
- **Destructive ops** (`loadPreset`, `storePreset`, `muteAll`, large gain jumps) flagged in the
  registry → require explicit confirm on remote/LLM surfaces; LLM tools default to read +
  non-destructive.
- Global **safety lock** + **Mute All** always reachable; basic rate limiting.

## Discovery
- Hub advertises **mDNS/Bonjour** `_dsp206._tcp.local` (host/port); iPad app auto-finds it.
- Manual IP entry as fallback.

## Code sharing → monorepo
To share the core across Electron + MCP + iPad, restructure to workspaces:
```
packages/core    — protocol, codecs, command registry, zod schemas, TS types   (the shared heart)
apps/desktop     — Electron hub + renderer (existing app)
apps/ipad        — Expo / React Native client
packages/mcp     — MCP server (thin client of the hub REST API)
```
`packages/core` is consumed by all three so the command schema and types never diverge.

## Phased plan (hub foundation first)
- **R0 — Monorepo + extract `packages/core`.** Move protocol/commands/codecs/types into a shared
  package; desktop imports from it. No behaviour change. (Tests move with it.)
- **R1 — Command registry + canonical state in hub.** Convert builders → registry (name + zod +
  apply); main owns `DspState`; IPC dispatches through the registry; renderer store becomes a
  synced mirror. Desktop keeps working end-to-end. Add read queries + first macros.
- **R2 — Embedded HTTP+WS server in Electron main.** Expose the registry over WS + REST; full-
  state snapshot + schema on connect; meter fan-out. Pairing/token auth + LAN bind + mDNS.
- **R3 — Desktop UI as a client** (the Frequency-View redesign), built against the synced store /
  hub API. (Replaces the old Phase 5/6 UI tasks; same screens, now hub-backed.)
- **R4 — MCP server + OpenAPI.** `packages/mcp` generates tools from `/api/schema`; `/openapi.json`
  for Hermes. Destructive tools require confirm; read tools + macros for "auto-set". Returns state
  snapshots so the LLM can verify results.
- **R5 — React Native / Expo iPad app.** WS+REST client, Bonjour discovery + pairing, touch-
  optimized screens (Frequency View, output bar, routing, presets, Safety/Party). Reuses
  `packages/core` types + schema.

R2 and R3 can overlap (both just consume the registry). R4/R5 are independent once R2 lands.

## Open questions / to settle during R0–R2
- Exact macro set the LLM should expose ("auto-set certain things" — which presets/intents?).
- Pairing UX (QR vs code) and token storage on iPad.
- Whether the hub should optionally run headless later (current choice ties it to the desktop app
  being open; a headless mode is a future option, not in scope now).

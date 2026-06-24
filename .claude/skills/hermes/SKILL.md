---
name: hermes
description: >-
  Control the user's t.racks DSP 206 loudspeaker-management processor live over its LAN API
  (the hub the desktop app serves on http://127.0.0.1:7206). Use this whenever the user wants
  to read or change anything on their DSP 206 — gain, mute, polarity, parametric or graphic EQ,
  crossover / HPF / LPF, limiter, compressor, noise gate, input routing or mix levels, delay,
  test-tone signal, presets, or live meters. Triggers on casual phrasing too: "mute the subs",
  "set output 3 to -6 dB", "what's clipping?", "recall preset 2", "flatten the EQ on input A",
  "the 206", "my speaker processor", or just "the DSP". Dispatches commands as a Hermes-style
  agent over REST. Trigger even when the user doesn't say "DSP 206" explicitly but clearly means
  the connected processor.
---

# Drive the DSP 206 (Hermes agent)

This skill lets you act as the agent that drives a **t.racks DSP 206** — the same role the
external Hermes model plays via `scripts/hermes-bridge.py`, but done by you directly over the
hub's REST API. You read state, send commands, and verify the result.

## This controls real audio hardware — be careful

The DSP feeds amplifiers and speakers. A wrong value can **blow drivers, damage amps, and hurt
people's hearing**. The protocol is reverse-engineered and some units are uncalibrated, so a
command may not do exactly what its name implies. Work like a careful live-sound engineer:

- **Read before you write.** `GET /api/state` first so you know current levels and what you're about to change.
- **Confirm anything risky with the user before sending** — raising gain by a lot, unmuting, changing a crossover or limiter, re-routing, `muteAll:false`, and especially `loadPreset` / `storePreset`. Echo the exact channel and value you're about to send and wait for a yes.
- **`loadPreset` / `storePreset` have no server-side confirm gate** (that guard only exists in the MCP wrapper). Over REST they execute immediately and overwrite settings — always confirm first.
- **Move in steps**, not leaps. Verify with `GET /api/state` (or `/api/meters`) after each change.
- If you're unsure the system is at a safe level, suggest `muteAll:true` before experimenting.

## Prerequisite: the hub must be running

The desktop app is the hub — it owns the USB connection and serves the API. If it's not running,
nothing here works. Start every session with a health check:

```bash
curl -fsS http://127.0.0.1:7206/api/health    # -> {"ok":true}
```

If that fails, tell the user to launch the **z3r0 DSP 206** desktop app and click **Connect**
(and make sure the official t.racks editor is closed — only one app can own the USB device).

## Authentication

Every endpoint except `/api/health`, `/api/pair`, and `/openapi.json` needs a bearer token.
Resolve a token once and reuse it for the whole session:

1. If `$DSP206_TOKEN` is set in the environment, use it directly as the bearer token.
2. Otherwise ask the user for the **6-digit pairing code** (desktop app → **Tablet** button), then exchange it:

```bash
curl -s -X POST http://127.0.0.1:7206/api/pair \
  -H 'content-type: application/json' -d '{"code":"123456"}'
# -> {"token":"<uuid>"}
```

Use it on every call as `-H "Authorization: Bearer <token>"`. The code rotates each app launch;
the token lasts until the hub restarts.

## The dispatch loop

1. **Health check** (above). 2. **Resolve token.** 3. **Read state** to ground yourself.
4. **Dispatch** one command per change. 5. **Verify** with state/meters. 6. **Report** what changed.

```bash
TOKEN=...                                     # from $DSP206_TOKEN or /api/pair
BASE=http://127.0.0.1:7206
H="Authorization: Bearer $TOKEN"

curl -s -H "$H" $BASE/api/state               # full state (every channel)
curl -s -H "$H" $BASE/api/meters              # live levels, 8 floats 0..1 (idx 2..7 = Out 1..6)

# dispatch: POST /api/command/<name> with that command's JSON params
curl -s -X POST $BASE/api/command/setGain \
  -H "$H" -H 'content-type: application/json' -d '{"ch":2,"db":-6}'
# success -> {"ok":true} ; bad params -> {"error":"..."} (HTTP 400)
```

The authoritative, always-current catalog is `GET /api/schema` (or `/openapi.json`). Fetch it if a
command below seems missing or a param looks different — the registry is the source of truth.

## Channel map (memorize this)

One unified channel byte addresses everything:

| ch | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|----|---|---|---|---|---|---|---|---|
|    | In A | In B | Out 1 | Out 2 | Out 3 | Out 4 | Out 5 | Out 6 |

Inputs are **0–1**, outputs are **2–7**. In routing commands, `inIdx` is `0` (In A) or `1` (In B).
Meter array indexes line up with `ch`: indexes 0–1 are the inputs, 2–7 are Out 1–6.

## Command catalog

`?` = optional (omit to leave unchanged). Channel-scoped commands take `ch` per the map above.

**Levels & basics (any channel)**
- `setGain` `{ch, db}` — output gain, `db` ∈ −60..+20
- `setMute` `{ch, muted}` — `muted` is a boolean (note: the field is `muted`, not `on`)
- `setPolarity` `{ch, inverted}` — false = Normal, true = Inverse
- `setDelay` `{ch, ms}` — delay in milliseconds, `ms` ≥ 0

**EQ**
- `setPeqBand` `{ch, band, patch:{gainDb?, hz?, q?, type?, bypass?}}` — update one parametric band (partial patch)
- `addPeqBand` `{ch}` / `removePeqBand` `{ch}` — append / drop the last PEQ band
- `setGeqBand` `{ch, band, db}` — 31-band graphic EQ, `band` ∈ 0..30 (**inputs only**)

**Crossover & dynamics (outputs)**
- `setHpf` `{ch, hz?, on?, slope?}` / `setLpf` `{ch, hz?, on?, slope?}` — crossover; `slope` ∈ 0..19 (BW/BL/LK ladder, 6–48 dB/oct)
- `setLimiter` `{ch, attackMs?, releaseMs?, threshDb?}`
- `setCompressor` `{ch, ratio?, attackMs?, releaseMs?, kneeDb?, threshDb?}`

**Dynamics (inputs)**
- `setGate` `{ch, attackMs?, releaseMs?, holdMs?, threshDb?}`

**Routing (outputs, outCh ∈ 2..7)**
- `setRoute` `{outCh, inIdx, on}` — connect/disconnect an input to an output
- `setMatrixLevel` `{outCh, inIdx, db}` — that input's mix level into the output, `db` ∈ −60..+20

**Global**
- `setInputSignal` `{signal, sineFreqIndex?}` — `signal` ∈ `analog|sine|pink|white` (built-in test tone)
- `muteAll` `{muted}` — mute/unmute every channel (feedback safety)
- `loadPreset` `{presetNum}` — **DESTRUCTIVE**, replaces all settings; 0 = factory, 1..31 = user
- `storePreset` `{slot}` — **DESTRUCTIVE**, overwrites a user slot 1..31
- `setPresetName` `{name}` — ≤ 20 chars; send before `storePreset`

## Examples

**Example 1 — read what's happening**
User: "what's clipping?"
→ `GET /api/meters`, map indexes 2–7 to Out 1–6, report which are near 1.0. (No confirmation needed; this is read-only.)

**Example 2 — a level change**
User: "bring output 3 down to -6 dB"
→ Out 3 = ch 4. Read state, then `POST /api/command/setGain {"ch":4,"db":-6}`, then re-read state to confirm `channels[4].gainDb === -6`. Report done.

**Example 3 — a destructive op (confirm first)**
User: "recall preset 2"
→ This replaces every current setting. Confirm: "Loading preset 2 overwrites all current settings on the device — go ahead?" On yes: `POST /api/command/loadPreset {"presetNum":2}`.

**Example 4 — routing**
User: "send input B to output 1 as well"
→ Out 1 = outCh 2, In B = inIdx 1. `POST /api/command/setRoute {"outCh":2,"inIdx":1,"on":true}`, then read state to confirm the route mask.

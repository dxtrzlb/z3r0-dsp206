# Runbook — run on Windows & drive from Hermes

How to bring the hub up on Windows and control it from a Hermes (or any OpenAPI-aware) LLM agent.

The deterministic path uses a **shared token** (`DSP206_TOKEN`): the hub and the agent both read it from the environment, so you skip the per-launch 6-digit pairing. (Hub side: [`src/main/server.ts`](src/main/server.ts) — `DSP206_TOKEN` is accepted if ≥ 8 chars.)

---

## Phase 0 — set a shared token (one-time, PowerShell)

```powershell
$tok = [guid]::NewGuid().ToString('N')   # 32 hex chars
setx DSP206_TOKEN $tok                    # persists for FUTURE processes
$env:DSP206_TOKEN = $tok                  # also set it for THIS session
$tok                                       # copy this value
```

`setx` only affects **new** processes — launch the app from this same session (below), or relaunch it afterwards.

## Phase 1 — start the hub

Launch from the session that has `$env:DSP206_TOKEN` set, so Electron inherits it:

```powershell
# installed build (path may differ if you changed the install dir):
& "$env:LOCALAPPDATA\Programs\z3r0 DSP 206\z3r0 DSP 206.exe"
# …or from source:
cd "C:\Users\User\DSP 206"; npm run dev
```

Plug the DSP 206 in over USB, **close the official t.racks editor** (single USB owner), click **Connect**.

```powershell
curl http://127.0.0.1:7206/api/health     # -> {"ok":true}
```

## Phase 2 — verify auth + a command

Channels: **In A = 0, In B = 1, Out 1–6 = 2–7.**

```powershell
$h = @{ Authorization = "Bearer $env:DSP206_TOKEN" }
Invoke-RestMethod http://127.0.0.1:7206/api/state -Headers $h | ConvertTo-Json -Depth 4
# mute Out 1 (ch 2):
Invoke-RestMethod -Method Post http://127.0.0.1:7206/api/command/setMute `
  -Headers $h -ContentType application/json -Body '{"ch":2,"on":true}'
```

## Phase 3 — drive it from Hermes (OpenAPI)

Contract Hermes consumes:

- **Tools** = every `POST /api/command/{operationId}`; the request body is that command's params.
- **Reads** = `GET /api/state`, `GET /api/meters`.
- **Auth** = `Authorization: Bearer <DSP206_TOKEN>` on every call.
- `GET /openapi.json` is the full machine-readable catalog (no auth needed to fetch it).

The bundled adapter [`scripts/hermes-bridge.py`](scripts/hermes-bridge.py) loads that doc, exposes each command as a tool to a Hermes model on any OpenAI-compatible endpoint (LM Studio, llama.cpp, vLLM…), and forwards tool calls to the hub:

```powershell
pip install openai requests
# point it at your Hermes server, then run a prompt:
$env:HERMES_BASE_URL = "http://localhost:1234/v1"
$env:HERMES_MODEL    = "hermes-4"
python scripts/hermes-bridge.py "mute output 1, then set its gain to -6 dB"
```

It reads `DSP206_URL` / `DSP206_TOKEN` (or `DSP206_CODE` to pair) from the env — the same variables as everything else. Destructive preset tools are excluded unless you set `ALLOW_DESTRUCTIVE=1`.

## Bonus — same token wires up MCP (Claude, etc.)

```json
{ "mcpServers": { "dsp206": {
  "command": "node",
  "args": ["C:\\Users\\User\\DSP 206\\packages\\mcp\\dist\\index.js"],
  "env": { "DSP206_TOKEN": "<same token>" }
} } }
```

Build it first with `npm run build -w @z3r0/mcp`.

---

## Notes

- **No confirm gate on the raw OpenAPI/REST path.** `loadPreset` / `storePreset` are only flagged `x-destructive` in the doc; the `confirm:true` guard lives in the MCP wrapper ([`packages/mcp/src/index.ts`](packages/mcp/src/index.ts)). Over REST they execute immediately — the adapter omits them by default for this reason.
- **Hermes on another machine:** replace `127.0.0.1` with the hub's LAN IP, fetch `openapi.json` via that IP (the `servers` URL follows the request Host), and allow TCP **7206** through Windows Firewall.
- **No token?** Read the 6-digit code from the desktop app's **Tablet** button and set `DSP206_CODE` instead (`POST /api/pair {"code":"…"}` → `{token}`). The code rotates every launch, which is why the token path is better for a standing setup.

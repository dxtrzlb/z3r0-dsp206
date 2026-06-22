#!/usr/bin/env python3
"""Hermes <-> z3r0 DSP 206 bridge.

Loads the running hub's OpenAPI doc, exposes each command as a tool to a Hermes
model served on any OpenAI-compatible endpoint, and forwards the model's tool
calls to the hub over REST.

Requires:  pip install openai requests
Run:       python scripts/hermes-bridge.py "mute output 1 and set its gain to -6 dB"

Config (env):
  DSP206_URL        hub base URL            (default http://127.0.0.1:7206)
  DSP206_TOKEN      shared bearer token     (preferred; matches the hub's DSP206_TOKEN)
  DSP206_CODE       6-digit pairing code    (used to fetch a token if DSP206_TOKEN is unset)
  HERMES_BASE_URL   OpenAI-compatible URL   (default http://localhost:1234/v1)
  HERMES_MODEL      model name              (default hermes-4)
  HERMES_API_KEY    api key for that server (default "x")
  ALLOW_DESTRUCTIVE include preset load/store tools (default off)
"""
import json
import os
import sys

import requests
from openai import OpenAI

HUB = os.environ.get("DSP206_URL", "http://127.0.0.1:7206").rstrip("/")
ALLOW_DESTRUCTIVE = os.environ.get("ALLOW_DESTRUCTIVE") == "1"


def resolve_token():
    token = os.environ.get("DSP206_TOKEN")
    if token:
        return token
    code = os.environ.get("DSP206_CODE")
    if not code:
        sys.exit("set DSP206_TOKEN (or DSP206_CODE to pair) — see the desktop app's Tablet button")
    r = requests.post(f"{HUB}/api/pair", json={"code": code})
    if not r.ok:
        sys.exit(f"pairing failed (HTTP {r.status_code}) — check DSP206_CODE")
    return r.json()["token"]


def build_tools():
    spec = requests.get(f"{HUB}/openapi.json").json()
    tools, route = [], {}
    # read endpoints first, so the model can verify its own changes
    for name, path in (("getState", "/api/state"), ("getMeters", "/api/meters")):
        route[name] = ("GET", path)
        tools.append({"type": "function", "function": {
            "name": name, "description": spec["paths"][path]["get"]["summary"],
            "parameters": {"type": "object", "properties": {}}}})
    for path, ops in spec["paths"].items():
        op = ops.get("post")
        if not op or path == "/api/pair":
            continue
        if op.get("x-destructive") and not ALLOW_DESTRUCTIVE:
            continue
        name = op["operationId"]
        route[name] = ("POST", path)
        tools.append({"type": "function", "function": {
            "name": name, "description": op.get("summary", name),
            "parameters": op["requestBody"]["content"]["application/json"]["schema"]}})
    return tools, route


def call_hub(route, name, args):
    method, path = route[name]
    r = requests.request(method, f"{HUB}{path}", headers=HDR,
                         json=args if method == "POST" else None)
    try:
        return r.json()
    except ValueError:
        return {"status": r.status_code, "text": r.text}


HDR = {"Authorization": f"Bearer {resolve_token()}"}


def main():
    prompt = " ".join(sys.argv[1:]) or "Report the current state of all outputs."
    tools, route = build_tools()
    llm = OpenAI(base_url=os.environ.get("HERMES_BASE_URL", "http://localhost:1234/v1"),
                 api_key=os.environ.get("HERMES_API_KEY", "x"))
    model = os.environ.get("HERMES_MODEL", "hermes-4")

    msgs = [
        {"role": "system", "content":
         "You control a t.racks DSP 206 audio processor. Channels: In A=0, In B=1, "
         "outputs 1-6 are 2-7. Use the tools to read and change settings; verify with getState."},
        {"role": "user", "content": prompt},
    ]
    for _ in range(12):
        m = llm.chat.completions.create(model=model, messages=msgs, tools=tools).choices[0].message
        msgs.append(m.model_dump())
        if not m.tool_calls:
            print(m.content)
            return
        for tc in m.tool_calls:
            args = json.loads(tc.function.arguments or "{}")
            out = call_hub(route, tc.function.name, args)
            print(f"  -> {tc.function.name}({args}) = {out}")
            msgs.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(out)})
    print("stopped: hit the tool-call limit")


if __name__ == "__main__":
    main()

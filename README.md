# Chapter 2: The Body — Hands That Can Change the World

*From read-only senses to write actions — and the containment that makes them safe.*

Chapter 1 gave the agent **senses** — read-only tools that observe the world. The agent could list files but couldn't create, modify, or delete anything. Now it gets **hands**: write tools that change the world. Same tool interface, different consequences.

The key lesson: **the tools array is the permission model.** You control what the agent can do by controlling what tools you give it. No bash tool = no shell access. No network tool = no HTTP requests. And path validation inside the tool = structural containment. You build the walls *before* you give it hands.

```
THE BODY
  ┌────────────────────────────────────────────────────────────────┐
  │ CORTEX (Chapter 1)                                             │
  │   Task-local executive (loop) + Reasoning (LLM)                │
  └────────────────────────────────────────────────────────────────┘
  TOOLS (permission model)
    ├── list_files(path)    ← read action (safe, idempotent)
    ├── read_file(path)     ← read action (safe, idempotent)
    └── write_file(path, content) ← WRITE ACTION (irreversible!)
                                    ↕
                              ┌──────────┐
                              │ sandbox/ │  ← containment boundary
                              └──────────┘
```

---

## Setup

```bash
npm install
```

Uses the same API key as Chapter 1. If you haven't set one up:

1. Go to https://aistudio.google.com/apikey
2. Create an API key
3. Add it to `.env.local`

---

## Hands — The Agent Changes the World

*The agent can now create, write, and verify files — all inside a sandbox.*

```bash
npm run hands
npm run hands "Create hello.txt with a greeting, then read it back"
npm run hands "Create a mini website with index.html and style.css"
```

**What you're seeing:** The agent plans what to write, calls `write_file` to create files, then calls `read_file` to verify its own work. Look in `./sandbox/` — the files are real.

**What's different from Chapter 1:** The agent is no longer a passive observer. It changes the filesystem. Those writes are irreversible — once a file is created, it exists. But it's contained: the worst the agent can do is fill `./sandbox/` with files. It can't touch your home directory, it can't run shell commands, it can't access the network.

**The containment model:**

1. **Tool-level:** The tools array defines the agent's capabilities. No tool for bash, HTTP, or email = the agent literally cannot do those things. This isn't a policy it follows — it's a structural impossibility.

2. **Path-level:** Every file operation resolves the path and checks it starts with `./sandbox/`. Paths like `../../etc/passwd` are rejected before they reach the filesystem. The validation is in the tool, not the prompt.

3. **Together:** The agent has exactly three capabilities (list, read, write) and exactly one directory to use them in. This is the principle: containment isn't instructions to the LLM — it's the structure of what you give it.

---

## What you built

| Component | What it does | Chapter 1 equivalent |
|-----------|-------------|---------------------|
| `tools.ts` | Sandboxed tools: list, read, write | `tools.ts` (read-only) |
| `hands.ts` | Agent loop with write tools | `agent-loop.ts` (read-only) |
| `sandbox/` | Containment boundary | *(none — no writes)* |

The agent loop itself hasn't changed — it's the same loop from Chapter 1. What changed is the tools array. That's the point: the loop is generic. The tools define what the agent *is*.

---

## Key concepts

**Read vs. write actions.** Both use the same tool interface — JSON schema in, structured call out. The LLM doesn't know or care about the difference. What differs is the *consequence*: read actions are safe and repeatable; write actions change the world and can't be undone.

**Structural containment.** The sandbox isn't a suggestion — it's enforced in code. The LLM can't "decide" to escape it. This is different from prompt-based safety ("please don't write outside the sandbox"), which the LLM could ignore. Structural containment is the immune system — it works regardless of what the LLM wants.

**The tools array as permission model.** Compare what the agent *can't* do: run shell commands, make HTTP requests, send messages, access files outside sandbox. None of these are forbidden by policy — they're absent from the tools array. You gave the agent hands, but only hands that reach inside a box.

---

## Where this lives in NanoClaw

Container isolation (Chapter 6) is this same principle at OS level. The Docker/Apple container IS the sandbox — a filesystem the agent can write to, with no access to the host. The container boundary enforces what the tools array enforces here, but at a higher level of abstraction.

The progression: `sandbox/` directory (this chapter) → container filesystem (Chapter 6) → network isolation (Chapter 8). Same principle, bigger scope.

**Next:** Checkout the `chapter-3` branch *(semantic and episodic memory — how the agent remembers across runs)*

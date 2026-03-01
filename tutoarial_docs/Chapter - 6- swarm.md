# Chapter 6: The Genome — One Blueprint, Many Organisms

*From one agent to many — same cortex, different DNA.*

Chapters 1–5 built one agent with hardcoded globals: one sandbox, one memory dir, one identity file, one model. This means you can't run two agents concurrently without them stomping on each other's files and sharing each other's brains.

Chapter 6 extracts an `AgentConfig` — the "genome" that defines an organism — so multiple agents can run in parallel with full isolation. Different genomes produce different organisms from the same cellular machinery.

```
BEFORE (hardcoded):             AFTER (AgentConfig):
┌──────────────┐                ┌──────────────┐  ┌──────────────┐
│   agent      │                │   atlas       │  │   nova        │
│   sandbox/   │                │   agents/     │  │   agents/     │
│   memory/    │                │    atlas/     │  │    nova/      │
│   persona.md │                │     sandbox/  │  │     sandbox/  │
└──────────────┘                │     memory/   │  │     memory/   │
  one of everything             │     identity/ │  │     identity/ │
                                └──────────────┘  └──────────────┘
                                  isolated           isolated
```

---

## Setup

```bash
npm install
```

Same API key as previous chapters. If you haven't set one up:

1. Go to https://aistudio.google.com/apikey
2. Create an API key
3. Add it to `.env.local`

---

## Run

```bash
npm run parallel
```

Or with a custom prompt:

```bash
npm run parallel "Write a haiku about your identity to sandbox/haiku.txt"
```

Expected output:

```
[parallel] Running 2 agents on the same prompt:
  "Introduce yourself, then write a short file called sandbox/hello.txt with a greeting in your personal style."

[atlas] started
[atlas][1] write_file({"path":"hello.txt","content":"..."})
[atlas]    → Wrote 42 bytes to hello.txt

[nova] started
[nova][1] write_file({"path":"hello.txt","content":"..."})
[nova]    → Wrote 67 bytes to hello.txt

[atlas] done
[nova] done

============================================================
Results (3.2s total):
============================================================

--- atlas ---
Atlas here. I've written a greeting to hello.txt.

  sandbox: hello.txt

--- nova ---
Hey, it's Nova! I just dropped a greeting into hello.txt — go check it out!

  sandbox: hello.txt

Isolation check: each agent's files live in agents/{name}/sandbox/
  ls agents/atlas/sandbox/
  ls agents/nova/sandbox/
```

Verify isolation:

```bash
cat agents/atlas/sandbox/hello.txt   # calm, precise
cat agents/nova/sandbox/hello.txt    # enthusiastic, creative
```

Different files. Different styles. No cross-contamination.

---

## Existing entry points still work

```bash
npm start "What can you do?"    # uses default ./sandbox/ and ./memory/
npm run watch                    # file watcher daemon — unchanged
npm run schedule                 # scheduled tasks — unchanged
```

---

## How it works

### AgentConfig — the genome

```typescript
interface AgentConfig {
  name: string              // agent identifier (for logs)
  persona: string           // path to identity file
  memoryDir: string         // where notes.md lives
  sandboxDir: string        // isolated workspace
  model: string             // which LLM model
  tools: ChatCompletionTool[] // capabilities
  maxIterations: number     // loop cap
}
```

`createDefaultConfig(name)` creates the directory tree and returns a config:

```typescript
const atlas = createDefaultConfig('atlas')
// atlas.sandboxDir = agents/atlas/sandbox/
// atlas.memoryDir  = agents/atlas/memory/
// atlas.persona    = agents/atlas/identity.md
```

### Parameterized tools

Before: `executeAction()` always used `./sandbox/`. Now: `createActionExecutor(sandboxDir)` returns a bound executor for any directory. Same for `createMemoryExecutor(memoryDir)`.

```typescript
// Old — hardcoded
executeAction('write_file', { path: 'hello.txt', content: 'hi' })

// New — parameterized
const exec = createActionExecutor('/path/to/agents/atlas/sandbox')
exec('write_file', { path: 'hello.txt', content: 'hi' })
```

### Parallel execution

```typescript
const results = await Promise.all(
  agents.map(({ config, systemPrompt }) =>
    runAgent(prompt, systemPrompt, allTools, true, config)
  )
)
```

`Promise.all` runs all agents concurrently. Each agent has its own config pointing to its own sandbox and memory. The LLM calls happen in parallel — different organisms, same cellular machinery.

---

## Directory structure

```
agents/
  atlas/
    identity.md     ← calm, precise personality
    memory/         ← atlas's episodic memory (gitignored)
    sandbox/        ← atlas's workspace (gitignored)
  nova/
    identity.md     ← enthusiastic, creative personality
    memory/         ← nova's episodic memory (gitignored)
    sandbox/        ← nova's workspace (gitignored)
```

Each agent has its own directory tree. Isolation is tangible — you can `ls` into each agent's world.

---

## What you built

| Component | What it does |
|-----------|-------------|
| `agent-config.ts` | `AgentConfig` interface + `createDefaultConfig()` factory |
| `actions.ts` | `createActionExecutor(sandboxDir)` — parameterized sandbox |
| `memory/memory.ts` | `createMemoryExecutor(memoryDir)` — parameterized memory |
| `agent.ts` | `runAgent()` accepts optional config for isolated execution |
| `parallel-demo.ts` | `Promise.all` demo with 2 isolated agents |
| `agents/atlas/identity.md` | Atlas persona — calm and precise |
| `agents/nova/identity.md` | Nova persona — enthusiastic and creative |

---

## Key concept: what varies vs what's shared

| Shared (cellular machinery) | Varies (genome) |
|------------------------------|-----------------|
| LLM client (`llm.ts`) | Identity file path |
| Tool definitions (schemas) | Sandbox directory |
| Agent loop (`runAgent`) | Memory directory |
| System prompt template | Model choice |
| | Max iterations |

The agent loop doesn't know or care which agent it's running. It receives a config and operates on those paths. This is the same pattern as biological cells: every cell has the same machinery (ribosomes, mitochondria), but different DNA produces different organisms.

---

## Where this lives in NanoClaw

- **AgentConfig:** `groups/{name}/` — each WhatsApp group is an agent with its own config
- **Isolated sandbox:** Each group gets its own container filesystem
- **Isolated memory:** `groups/{name}/CLAUDE.md` — per-group identity and episodic memory
- **Parallel execution:** Multiple groups can have active agent runs simultaneously
- **Same cortex:** All groups use the same LLM client and agent loop

The genome pattern is how NanoClaw scales from one group to many without agents interfering with each other.

---

**Next:** Chapter 7 — The Swarm *(agent-to-agent communication)*

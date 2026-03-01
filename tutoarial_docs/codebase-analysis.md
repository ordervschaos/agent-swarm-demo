# NanoClaw Tutorial — Codebase Analysis

## What This Is

A from-scratch AI agent built in TypeScript using raw LLM API calls — no SDKs, no frameworks. Every layer is visible: the LLM call, the tool loop, memory, autonomy, multi-agent isolation. It's a teaching codebase that maps agent internals to neuroscience metaphors.

## The Ideas

### The Core Loop
The agent follows a single pattern: **perceive → think → act → observe → repeat → conclude**. The `Agent` class implements this as a cycle that sends messages to an LLM, checks if it wants to use tools, executes them, feeds observations back, and repeats until the LLM produces a final text response.

### Neuroscience Mapping
Every component maps to a brain/body analogy:
- **Cortex** — the LLM call itself (cognition)
- **Awareness** — system prompt assembled from identity + memories
- **Body** — tools (files, memory) are senses and limbs
- **Attention** — the vigilance system that detects stimuli and triggers deliberation
- **Cue/Sensor/Stimulus** — the reticular activating system

### Agent as Config
`AgentConfig` is the "genome" — same agent loop, different config = different organism. Atlas is calm and precise, Nova is enthusiastic and creative. They share code but have isolated identity, memory, and sandbox directories.

### Declarative Attention
Cues are declared, not coded. A cue bundles a sensor (clock or inbox), an agent name, and a skill file (prompt template). Adding autonomous behavior = adding an object to an array + a `.md` file. No code changes needed.

## The Architecture

```
index.ts          — one-shot deliberation (npm start "prompt")
awaken.ts         — daemon mode (npm run awaken)
agent.ts          — Agent class: the perceive-think-act-observe loop
agent-config.ts   — AgentConfig: the genome that differentiates agents
llm.ts            — LLM provider abstraction (currently Gemini)
attention.ts      — Attention class: cue monitoring and agent dispatch
cues.ts           — Declarative cue definitions
actions/
  index.ts        — Tool registry and unified executor
  files.ts        — list_files, read_file, write_file (sandboxed)
  memory.ts       — save_note, read_notes (persistent)
skills/
  heartbeat.md    — Prompt template for periodic heartbeat
  memory-review.md — Prompt template for memory consolidation
agents/
  default/        — Default agent (no identity file)
  atlas/          — Calm, precise persona
  nova/           — Enthusiastic, creative persona
```

## What's Working

| Layer | Status | Details |
|-------|--------|---------|
| LLM abstraction | Done | OpenAI-compatible client, swappable providers (Gemini, Groq, MiniMax) |
| Tool loop | Done | Full perceive → think → act → observe cycle with iteration cap |
| File tools | Done | list, read, write with sandbox confinement and path safety |
| Memory | Done | Episodic notes with timestamps, loaded into awareness on wake |
| Identity | Done | Per-agent persona files shape personality and behavior |
| Multi-agent | Done | AgentConfig genome, isolated directories per agent |
| Attention system | Done | Unified cue-based monitoring (clock + inbox sensors) |
| Skill templates | Done | `.md` files with `{{variable}}` interpolation |
| Agent routing | Done | Cues can specify which agent handles them |

## The Gaps

### No Cortex Abstraction
`agent.ts` calls `llm.chat.completions.create()` directly. A proposed `Cortex` class (documented in `temp_chapter-1a-cortex-class.md`) would separate cognition from the loop — `cortex.think(messages) → Thought`. Not yet implemented.

### No Immune System
No guardrails, content filtering, or defense mechanisms. A malicious prompt goes straight to the LLM with full tool access. The tutorial plan mentions this as a future chapter.

### No Container Isolation
The tutorial docs describe Docker container mechanics in detail (Chapter 4), but the current code runs everything in the host process. Agents share the Node.js runtime — isolation is directory-level only, not process-level.

### No Inter-Agent Communication - done
Agents can't talk to each other. There's no message bus, shared memory, or coordination primitive. Each agent deliberates in isolation. The swarm chapter (Chapter 7) is planned but not built.

### Limited Sensor Types
Only two sensors: `clock` (interval timer) and `inbox` (file watcher). No webhook, HTTP, or event-driven sensors. The `Sensor` type union is extensible but nothing else is implemented.

### No Error Recovery in Attention
If a clock cue's deliberation fails, it logs the error and moves on. No retry, no backoff, no dead letter queue. The inbox sensor is more robust (atomic rename prevents double-processing) but still lacks retry.

### No Streaming
All deliberation is synchronous — the full response comes back at once. No streaming of partial results or intermediate reasoning to the user.

### No Token/Cost Awareness
No tracking of token usage, cost, or budget limits. An agent could burn through API credits on a runaway loop with no circuit breaker beyond `maxIterations`.

### Simple Pattern Matching
The inbox sensor's glob matching is minimal — `*.txt` works but complex patterns don't. No regex, no multi-pattern, no exclusion.

### Skills Are Static
Skill files are read from disk on every cue fire but there's no skill discovery, versioning, or composition. A skill can't call other skills or chain prompts.

## How Advanced Is It

**For a teaching codebase: remarkably complete.** It covers the full agent anatomy from raw LLM call through autonomous behavior with multi-agent support. The neuroscience framing gives each piece a memorable mental model.

**As a production system: early-stage.** It lacks the defensive layers (guardrails, container isolation, error recovery, cost controls) that a real deployment needs. But that's by design — the tutorial is building toward those layers chapter by chapter.

**What stands out:**
- Zero framework dependencies — just `openai` SDK and `dotenv`
- Every abstraction earns its place and maps to a concept
- The attention system is genuinely elegant — cues are declarative and composable
- Agent isolation via config is clean and extensible

**What's notably missing:**
- Chapters 4-9 of the tutorial plan (containers, autonomy drives, immune system, swarm coordination, deployment)
- The gap between "agents can run in parallel" and "agents can coordinate" is the next big leap

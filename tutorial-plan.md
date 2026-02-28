# How to Grow an Agent Swarm — Tutorial Plan

A step-by-step tutorial that teaches agent anatomy by building one. Each chapter grows a new organ. TypeScript throughout. No agent SDKs — raw LLM calls via the OpenAI-compatible interface. The student builds every layer from scratch so nothing is hidden.

---

## Prerequisites & LLM Setup

The tutorial uses the **OpenAI-compatible API format** — a universal interface supported by Gemini, MiniMax, Groq, OpenRouter, and others. The student picks a provider and swaps the `baseURL`. The code stays the same.

**Default: Google Gemini (free tier)** — 1M tokens/min, no credit card required, solid function calling.

```typescript
import OpenAI from 'openai'

const llm = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})
const MODEL = 'gemini-2.5-flash'
```

**Alternatives** — swap two lines:

```typescript
// MiniMax (free quota, agent-native, top tool-use benchmarks)
const llm = new OpenAI({ apiKey: process.env.MINIMAX_API_KEY, baseURL: 'https://api.minimax.chat/v1' })
const MODEL = 'MiniMax-M2.1'

// Groq (free, 14,400 req/day, fastest inference)
const llm = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
const MODEL = 'llama-3.3-70b-versatile'

// OpenRouter (50 req/day free, access to many models)
const llm = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })
const MODEL = 'google/gemini-2.5-flash'
```

All code in the tutorial uses `llm` and `MODEL` — provider-agnostic. Pick one, get an API key, continue.

---

## The Mental Model

An AI agent is not just a brain — it's an entire organism. At its core is a **cortex** (the LLM plus its orchestration code), but an agent also has sensory systems, memory, a body, and infrastructure. The LLM specifically acts as the **association cortex** — it does reasoning, language, planning, and action formatting. But vision is a separate neural structure (a ViT feeding into the cortex). Audio is a separate model (Whisper). Memory is external (files loaded into the context window). The cortex has no persistence of its own.

This matters because it tells you what's one system and what's many:

```
THE CORTEX (the LLM — but more than just an LLM)
  Two levels of executive function:
  ┌─────────────────────────────────────────────────────────────────┐
  │ GLOBAL EXECUTIVE (dlPFC)    ← TypeScript code (deterministic)  │
  │   "Which tasks get attention? When to spawn? When to kill?"    │
  │     manages →                                                  │
  │ TASK-LOCAL EXECUTIVE        ← the LLM itself (probabilistic)   │
  │   "Should I call another tool? Keep going or stop?"            │
  │     manages →                                                  │
  │ REASONING (vmPFC)           ← the LLM itself                  │
  │   "What tool? What arguments? What does this result mean?"     │
  └─────────────────────────────────────────────────────────────────┘
  Action Interface (motor ctx)  ← function-calling + tools (same model)
  Speech Production (Broca's)   ← output formatting (same model)

SEPARATE NEURAL STRUCTURES (feed into the cortex)
  Visual Processing (occipital)  ← a separate ViT model + adapter
  Auditory Processing (auditory) ← Whisper (entirely separate model)

EXTERNAL TO THE BRAIN
  Memory (hippocampus analog)    ← files on disk, loaded into context
  The Body                       ← channel adapters, tools
  Infrastructure                 ← containers, scheduler
```

A raw LLM generates text — tokens in, tokens out. An **agent** is an LLM plus two layers of executive function. The **task-local executive** (built in Chapter 1) is the agent loop: reason → act → observe → repeat, with the LLM itself deciding when to stop. The **global executive** (built in Chapter 3) manages across tasks: which get attention, when to spawn, when to kill. The task-local executive is the LLM (probabilistic). The global executive is TypeScript (deterministic). You don't want your task manager to hallucinate.

Vision and audio are genuinely different models that project into the cortex's token space. Memory is genuinely external.

---

## The Arc

Start with a cortex in a terminal — already equipped with a primitive ear (stdin) and mouth (stdout). End with a swarm of walled organisms deployed to production, each with memory, skills, and a schedule. Each chapter:

1. Names the organ and its brain analog (mental model)
2. Shows the minimal TypeScript (practical)
3. Shows what the agent can do now that it couldn't before (payoff)
4. Shows where this lives in NanoClaw (grounding)

---

## Chapters

### Step 0: The Shell — Terminal Chat UI
*Build the ear and mouth before adding a brain*

Before connecting an LLM, build the interactive shell. This makes the "terminal is already a body" concept tangible: by the time Chapter 1 wires up the cortex, the ears and mouth already exist.

**Build:** A single `chat.ts` file (~40 lines). No new dependencies — only Node built-ins.

- `readline` for input — the **ear**
- `process.stdout` + ANSI codes for colored output — the **mouth**
- A braille spinner during "thinking" via `\r` line overwrites
- A `messages` array in memory (the foundation Chapter 1 builds on)

In Step 0, the handler echoes the user's message back immediately. Chapter 1 replaces those two lines with a real LLM call.

```
You: list my files

⠸ thinking...

Agent: You said: "list my files" (history: 1 message)

You: _
```

**Run:** `npx tsx chat.ts` — type a message, see the spinner, see the echo, type again, history grows. Kill with `Ctrl+C`.

**Payoff:** The shell exists as a standalone concept. The student understands what the "ear" and "mouth" are before the brain enters the picture.

---

### Chapter 1: The Cortex — Three Layers
*From a raw LLM to an agent, in three steps*

A raw LLM generates text. An agent reasons, acts, observes, and repeats. The difference is two things the student builds by hand: the **action interface** (tools) and the **task-local executive** (the loop). No SDK — the student sees every piece.

**The terminal is already a body.** Before writing a single line of agent code, the ecosystem already has a mouth and an ear: terminal stdin receives text (the ear), terminal stdout emits text (the mouth). The student types — that's a synthesized message entering the ear. The agent responds — that's speech production out the mouth. Text on a screen is the simplest possible channel. Chapter 1 uses this primitive body. Later chapters upgrade it — but the pattern is the same from the start.

**Key distinction — read actions vs write actions:** From the LLM's side, every tool call is the same — a structured function call. Looking is an action. Listening is an action. What differs is the *consequence*. **Read actions** (`list_files`, `web_search`) observe the world — safe, idempotent, no side effects. **Write actions** (`write_file`, `run_command`) change the world — irreversible, need guardrails. Chapter 1 uses only read actions. Chapter 2 adds write actions. This keeps Chapter 1 completely safe while still demonstrating the full agent loop.

#### 1a. The Raw Cortex
*Reasoning — ventromedial prefrontal cortex*

The LLM as a pure text generator. Tokens in, tokens out. It can think, but it can't DO anything.

**Build:** A single `agent.ts` file. Read a prompt from `readline` (the ear), call the LLM, print the response (the mouth). ~15 lines.

**Payoff:** The student talks to the cortex. It's smart. It can reason about anything. But it can't *do* anything — it can only describe what it would do.

---

#### 1b. The Action Interface
*Motor cortex — translating intent into structured tool calls*

Give the cortex the ability to act. Define tools as JSON schemas. The LLM returns a `tool_calls` array — structured requests to use tools.

**Payoff:** The cortex can now act. "What's in this directory?" → it generates a tool call → the student's code executes it → the result is printed. But it's one-shot: the LLM never sees the result of its own action.

---

#### 1c. The Task-Local Executive
*The agent loop — the thing that makes an LLM an agent*

The cortex can reason (1a) and act (1b), but it does each once and stops. The task-local executive is the loop: keep calling the LLM until it stops requesting tools.

**Payoff:** The agent loop. The cortex chains tool calls — reason, act, observe, reason, act, observe — until it decides it's done. This is the moment the LLM becomes an agent.

---

### Chapter 2: The Body — Hands
*Motor cortex — the agent changes the world*

In Chapter 1, the cortex gained senses — read-only tools that let it perceive. Now give it hands: tools that **change** the world.

**Build:** Add write tools — `write_file`, `bash`. Run the agent in a sandboxed directory so write actions can't escape.

**Payoff:** "Write a haiku to `poem.txt`." The agent creates the file. "Run `ls -la`." It does. The cortex can now change the world, not just observe it.

---

### Chapter 3: Memory — Four Kinds
*External to the cortex — loaded into the context window*

The cortex is smart but amnesiac. Memory is **external** to the LLM. The context window is the constraint that forces memory to be a family of four systems with different loading strategies.

**Build (4 sub-steps):**

- **Semantic memory** — `identity.md`. Loaded into system prompt every invocation.
- **Episodic memory** — `memory/notes.md`. The agent writes notes to itself. Loaded every invocation.
- **Working memory** — Conversation history. The current session is the context window.
- **Procedural memory** — Skills. Markdown files describing workflows. Loaded on demand.

**Key concept:** If the context window were infinite, you'd load everything and memory would be one thing. Because it's finite, you need four systems with four loading strategies.

---

### Chapter 4: Vigilance — The Organism Is Always Awake
*Reticular activating system — continuous wakefulness and the reflex arc*

So far the agent exists only when invoked. You run `npx tsx chat.ts`, it lives, it processes one session, it dies. Between invocations it has no existence at all. There is no organism — just a script you can run.

Now change one thing: keep a process running.

The daemon is not about autonomy. It's about **being alive**. A reflex arc doesn't make an organism autonomous — it makes it *responsive*. The agent still only acts when poked. But now it's always awake to be poked.

The biological structure this adds is the **reticular activating system** — what keeps an organism alert between deliberate actions. Without it, the organism is in deep sleep (requires external resurrection to wake). With it, the organism is continuously alive, sensitive to its environment.

The cortex doesn't change. The input source does. Instead of `stdin`, the input channel is a directory: `inbox/`. When a `.txt` file appears, the daemon fires automatically — no deliberation, just stimulus → response. The agent can't choose not to respond. That's a reflex.

**The pattern:** monitor → filter → spawn → respond. `fs.watch` is the monitor. The `.txt` filter is the filter. Running the agent in-process is the spawn. Writing to `outbox/` is the respond. In NanoClaw, WhatsApp replaces the file watcher — but the pattern is identical.

**Each task is independent.** The daemon passes `[{role:'user', content: task}]` — a single-turn conversation. No shared history. Spawn → process → release. This is the key difference from `chat.ts`: the REPL accumulates history across a session; the daemon treats each task as isolated.

**Build:** `daemon.ts` (~80 lines). `fs.watch` on `inbox/`. A `processing` Set to prevent double-processing. `renameSync` before spawning — move the file out of inbox before processing.

```
npm run daemon

# in another terminal:
echo "write a haiku about filesystems to sandbox/haiku.txt" > inbox/task.txt

[inbox] task.txt
  "write a haiku about filesystems to sandbox/haiku.txt"
[outbox] task.txt
  "Done. I wrote a haiku to sandbox/haiku.txt."
```

**Payoff:** The agent acts while the human does something else. Drop a file and walk away. The reply is waiting when you check `outbox/`. But notice: a human still dropped the file. The motivation is still external. The agent responds to stimuli — it doesn't initiate.

**Key concept:** The file watcher and the LLM are on different clocks. The LLM runs when triggered by the file watcher, not by the human. The human's role shifts from "conversation partner" to "task submitter." The agent's role shifts from "respondent" to "reflex arc." Same cortex. Different relationship. True autonomy comes next.

**NanoClaw:** `src/index.ts:startMessageLoop()` — same pattern, WhatsApp as the monitor instead of `fs.watch`. `src/index.ts:processGroupMessages()` — the spawn + release logic. The inbox is the SQLite message queue.

---

### Chapter 5: Autonomy — The Agent Acts Without Being Asked
*Internal drives — the source of motivation shifts from external to internal*

The daemon responds to stimuli. The scheduler initiates action. Same cortex, same tools, same memory. But the source of motivation has shifted.

In Chapter 4, motivation is external: human drops file → daemon fires → agent processes. The trigger lives outside the organism. In Chapter 5, motivation is internal: time elapses → internal state changes → agent initiates action. No human drops anything. No external event occurs. The organism acts because of something happening inside it — a clock, a drive, a standing order.

That's the difference between a reflex and a drive. A drive is autonomy.

The clock lives in infrastructure, not in the organism. The agent doesn't set its own schedule — the central executive does. A cron job, a timer, a scheduled task — these are external triggers that tell the central executive to create a task. The agent wakes up, does its work, and goes back to sleep. It doesn't know when it will wake again. But from the agent's perspective, the initiation came from nowhere — no human required.

**Build:** A scheduler that checks for due tasks every 60 seconds. Tasks stored in SQLite with `next_run_at`. When due, the central executive drops a file in `inbox/` (or calls the agent directly). Support cron, interval, and one-shot schedules.

**Payoff:** "Every morning at 9am, check my calendar and send me a summary." The agent acts without being asked. An agent that only reacts is a sophisticated tool. An agent that initiates action is autonomous.

**NanoClaw:** `src/task-scheduler.ts`, tasks created via IPC from inside the container (`src/ipc.ts`).

---

### Chapter 6: The Immune System
*Defense — the system that works against the cortex when necessary*

The agent never intends harm. It goes wrong when *compromised* — prompt injection, hallucination, runaway loops. Defense must sometimes oppose the cortex it serves.

**Build:**
- **Structural immunity:** Tool allowlists. Process timeout (hard kill after N minutes). System prompt guardrails.
- **Active immunity:** Iteration cap on the agent loop. Output filtering. The `<internal>` tag pattern.

**NanoClaw:** `CONTAINER_TIMEOUT`, `IDLE_TIMEOUT`, `MAX_CONCURRENT_CONTAINERS` in `src/config.ts`. Internal tag stripping in `src/router.ts:formatOutbound()`.

---

### Chapter 7: The Swarm
*From one organism to many — one central executive, N isolated organisms*

Everything so far built one agent. A swarm is N organisms sharing infrastructure but isolated from each other.

**Build:** The central executive manages multiple organisms. Each WhatsApp group gets its own agent instance, memory, session state, skills, and task schedule. The central executive routes incoming messages to the right organism.

**Payoff:** 5 WhatsApp groups, 5 agents, one process. Each has a different personality, different knowledge, different skills, running on different schedules. But they share the same cortex model, the same central executive, the same immune system constraints.

**NanoClaw:** `src/index.ts` routes by group JID. `src/db.ts:getAllRegisteredGroups()` tracks the swarm.

---

### Chapter 8: The Room
*Container isolation — walls around everything built so far*

Right now the agent lives in your house — it's a process on your machine. The `bash` tool gives it hands that can reach anywhere: your home directory, your OS, your source code. The only protection so far is the iteration cap and process timeout — guards, not walls.

The swarm has 7 agents. One compromised agent, one prompt injection, one hallucinated command — and your entire machine is exposed. At scale, a guard that's not perfect isn't good enough.

**The room is the answer.** A Docker container is a room inside your house, built before the agent woke up. The walls aren't locks — they're absence. Files that weren't passed through the fence don't exist in the container's universe.

Three things cross the fence, and only these three:

| What | Direction | Where it lands |
|------|-----------|----------------|
| `sandbox/` | read-write | `/agent/sandbox` inside the container |
| `memory/` | read-write | `/agent/memory` inside the container |
| `identity.md` | read-only | `/agent/identity.md` inside the container |

**The wall vs the guard distinction:** A guard detects a threat and responds. A wall exists before any threat. You don't need to convince the agent not to delete your OS — it can't see your OS. The walls were built before the cortex booted.

**Build:** `Dockerfile` + `container-entry.ts` (stdin→agent→stdout, runs inside) + updated `chat.ts` and `daemon.ts` (spawn container instead of running in-process). Each organism in the swarm gets its own mounted `sandbox/` and `memory/`. The container image is shared; the mounted data is isolated.

```
npm run build-container
npm run chat

You: list your files
Agent: [sees only sandbox/ contents — llm.ts, tools.ts don't exist in its universe]
```

**Payoff:** Same swarm. Same schedules. Same memory. But now every agent runs inside walls. A compromised agent can only reach what was explicitly passed through the fence.

**NanoClaw:** `src/container-runner.ts:buildVolumeMounts()` — exactly this, per group JID. Each group gets its own `sandbox/` and `memory/` mounted. The container image is shared; the mounted data is isolated.

---

### Chapter 9: Deployment — Cloudflare
*From local machine to production*

The swarm runs on your laptop. Ship it.

**Build:** Deploy the orchestrator to a Cloudflare Worker or Durable Object. The agent containers run on a VPS (or Fly.io, Railway). The orchestrator routes messages from WhatsApp → container → WhatsApp. The memory and sandbox volumes persist on the VPS.

**Payoff:** The agent runs while you sleep. WhatsApp messages arrive, the swarm processes them, replies go out. Your laptop is off.

**NanoClaw:** The production deployment for NanoClaw — this chapter documents the path from local dev to a running service.

---

## The Full Picture

```
Chapter 1a: THE RAW CORTEX (LLM — tokens in, tokens out) ✓
Chapter 1b: THE ACTION INTERFACE (tools — the cortex can act; read-only for safety) ✓
Chapter 1c: THE TASK-LOCAL EXECUTIVE (the agent loop — LLM becomes agent) ✓
Chapter 2:  THE BODY (hands — write tools, sandbox — the agent changes the world) ✓
Chapter 3:  MEMORY (semantic, episodic, working, procedural — external to cortex) ✓
Chapter 4:  VIGILANCE (daemon — continuous wakefulness; reflex arc; always alive)
Chapter 5:  AUTONOMY (scheduler — self-initiated action; internal drives)
Chapter 6:  THE IMMUNE SYSTEM (defense — structural + active)
Chapter 7:  THE SWARM (N organisms, one central executive)
Chapter 8:  THE ROOM (container isolation — walls retrofitted onto the swarm)
Chapter 9:  DEPLOYMENT (Cloudflare — from local to production)
```

The progression from 1a → 1c is the core thesis: a raw LLM is not an agent. Add tools and it can act once. Add the loop and it's an agent. Chapter 2 adds write actions — the ability to change the world. Chapter 4 adds continuous wakefulness — the organism is always alive, responding to stimuli. Chapter 5 crosses the key threshold: motivation shifts from external to internal, and the agent becomes truly autonomous. Chapters 6–7 build defense and scale. Chapter 8 adds walls only after there's a reason to need them: a swarm of autonomous agents acting on a schedule is when the blast radius becomes real. The room is infrastructure, not an organism — it doesn't change what the agent does, only what it can reach.

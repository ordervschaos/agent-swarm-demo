# How to Grow an Agent — Chapter Summary & Explanation

A step-by-step tutorial that teaches agent anatomy by building one from scratch. Each chapter grows a new organ. TypeScript throughout. No agent SDKs — raw LLM calls via the OpenAI-compatible interface. Nothing is hidden.

---

## The Arc

Start with a cortex in a terminal — already equipped with a primitive ear (stdin) and mouth (stdout). End with a swarm of isolated organisms, each with memory, skills, identity, and a schedule. The progression:

```
Step 0:     The Shell          — ear and mouth, no brain
Chapter 1a: The Raw Cortex     — reasoning, no acting
Chapter 1b: The Action Interface — acting once, no observing
Chapter 1c: The Agent Loop     — reason → act → observe → repeat
Chapter 2:  The Body           — write actions, sandbox containment
Chapter 3:  Memory             — four kinds, external to the cortex
Chapter 4:  Vigilance          — always awake, stimulus → response
Chapter 5:  Autonomy           — self-initiated action, internal drives
Chapter 6:  The Genome         — one blueprint, many organisms
```

---

## Step 0: The Shell

**Organ:** Ear (stdin) and Mouth (stdout)
**Brain analog:** Peripheral nervous system — sensory input and motor output before a cortex exists

**What it builds:** A terminal chat REPL in `chat.ts` (~40 lines). No LLM, no dependencies beyond Node built-ins.

**Key components:**
- `readline` interface — the ear. Listens for user input.
- `process.stdout` + ANSI color codes — the mouth. Prints responses.
- Braille spinner (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) — visual feedback during "thinking."
- `messages` array — in-memory conversation history. Foundation everything builds on.

**What it does:** Echoes user input back. The handler is two lines that Chapter 1a replaces with a real LLM call.

```
You: hello
⠸ thinking...
Agent: You said: "hello" (history: 1 message)
```

**Why it matters:** The terminal is already a body before the brain exists. The student sees the ear and mouth as standalone concepts. When Chapter 1 wires up the cortex, it plugs into infrastructure that already works.

**Run:** `npx tsx chat.ts`

---

## Chapter 1a: The Raw Cortex

**Organ:** Association cortex — reasoning
**Brain analog:** Ventromedial prefrontal cortex (vmPFC) — judgment, language, planning

**What it builds:** `llm.ts` — a provider-agnostic LLM client using the OpenAI-compatible API format. ~15 lines of setup.

**Key components:**
- `OpenAI` client configured with any provider (Gemini, Groq, MiniMax, OpenRouter)
- `MODEL` constant — swap one line to change the model
- The `chat.completions.create()` call — tokens in, tokens out

**What it does:** Replaces the echo handler from Step 0. User input goes to the LLM. The LLM's response comes back. Pure text generation.

```
You: what's the capital of France?
Agent: The capital of France is Paris.
```

**The key limitation:** The cortex can reason about anything but can't *do* anything. Ask it to list your files and it'll describe how it would — but it can't actually call `ls`. It's a brain in a jar.

**Why it matters:** Establishes the fundamental distinction: reasoning and acting are separate capabilities. The LLM provides reasoning. The code provides acting. Chapter 1b bridges them.

---

## Chapter 1b: The Action Interface

**Organ:** Motor cortex — translating intent into structured action
**Brain analog:** Primary motor cortex — the brain's interface to the body's muscles

**What it builds:** Tool definitions as JSON schemas + a tool executor. Added to `chat.ts`.

**Key components:**
- `tools` array — JSON schemas describing available functions (e.g., `list_files`)
- `executeAction(name, args)` — dispatches tool calls to actual implementations
- Tool calls parsed from the LLM response's `tool_calls` array

**What it does:** The LLM can now request actions. It returns structured function calls instead of just text.

```
You: what files are in this directory?
Agent: [calls list_files] → index.ts, llm.ts, package.json ...
```

**The key limitation:** One-shot execution. The LLM calls a tool and the code executes it — but the LLM never sees the result. It acts blind. It can request `list_files`, but it can't then reason about what it found.

**Critical design decision — read-only tools only.** Chapter 1b introduces only safe, idempotent read actions (`list_files`, `read_file`). No file writes, no command execution. This keeps the chapter completely safe while demonstrating the full tool-calling pattern. Write actions come in Chapter 2.

**Why it matters:** The LLM can now act, not just think. But without seeing the results of its actions, it can't chain reasoning. That's what Chapter 1c adds.

---

## Chapter 1c: The Task-Local Executive

**Organ:** Executive function — the decision to keep going or stop
**Brain analog:** Dorsolateral prefrontal cortex (dlPFC) — task management, working memory

**What it builds:** The agent loop — a `while(true)` that calls the LLM repeatedly until it stops requesting tools. This is implemented as the `deliberate()` method in `agent.ts`.

**Key components:**
- The loop: call LLM → check for tool calls → execute tools → push results → call LLM again
- `MAX_ITERATIONS` safety cap — prevents infinite loops
- Tool results fed back as `{ role: 'tool' }` messages — the LLM sees what happened
- The LLM decides when to stop (no tool calls = done)

**The pattern:**
```
reason → act → observe → reason → act → observe → ... → conclude
```

**What it does:** Multi-step task completion. The agent can now chain actions.

```
You: list the files, then read the first one
Agent: [calls list_files] → sees index.ts, llm.ts, ...
       [calls read_file("index.ts")] → sees the code
       "Here's what index.ts contains: ..."
```

**Why this is the critical moment:** This is where an LLM becomes an agent. Before: text generator that can make one tool call. After: an entity that reasons, acts, observes the result, and decides what to do next. The loop is the entire difference.

**Two levels of executive function:**
- **Task-local executive** (the LLM) — probabilistic. "Should I call another tool? Am I done?"
- **Global executive** (TypeScript) — deterministic. "Has this exceeded MAX_ITERATIONS? Kill it."

You don't want your task manager to hallucinate. The LLM handles within-task decisions. The code handles across-task decisions.

---

## Chapter 2: The Body — Hands

**Organ:** Hands — the ability to change the world, not just observe it
**Brain analog:** Primary motor cortex output pathways — effectors that alter the environment

**What it builds:** Write tools (`write_file`) + sandbox containment via `safePath()`. Implemented in `actions/files.ts`.

**Key components:**
- `write_file` tool — creates/overwrites files in the sandbox
- `safePath(sandboxDir, userPath)` — resolves paths and blocks escape attempts
- Path traversal prevention — `../../../etc/passwd` resolves inside the sandbox, not outside

**What it does:** The agent can now create files, modify the world.

```
You: write a haiku about TypeScript to sandbox/poem.txt
Agent: [calls write_file] → creates the file
       "Done. I wrote the haiku to poem.txt."
```

**The key distinction — read vs write actions:**
| Read actions (Chapter 1b) | Write actions (Chapter 2) |
|---------------------------|---------------------------|
| `list_files`, `read_file` | `write_file` |
| Observe the world | Change the world |
| Safe, idempotent | Irreversible, need guardrails |
| No side effects | Side effects are the point |

**Why sandbox containment matters:** Without `safePath()`, the agent could write anywhere — your home directory, system files, source code. The sandbox is the simplest possible containment: all paths resolve relative to a designated directory. The guard validates, not the agent.

```typescript
function safePath(sandboxDir: string, userPath: string): string {
  const resolved = resolve(sandboxDir, userPath)
  if (!resolved.startsWith(sandboxDir)) throw new Error('Path escape blocked')
  return resolved
}
```

---

## Chapter 3: Memory — Four Kinds

**Organ:** Hippocampus analog — external persistence
**Brain analog:** Hippocampal formation — encoding, storage, retrieval

**What it builds:** Four memory systems with different loading strategies. Implemented in `actions/memory.ts` and the system prompt construction in `agent.ts`.

**The four memory types:**

### 1. Semantic Memory — `identity.md`
- **What:** Human-curated identity and personality
- **Loading:** Always injected into the system prompt, every invocation
- **Who writes it:** The human (read-only to the agent)
- **Example:** "You are Atlas — calm, precise, methodical"

### 2. Episodic Memory — `memory/notes.md`
- **What:** Agent-curated notes about past interactions
- **Loading:** Loaded into system prompt if it exists
- **Who writes it:** The agent, via `save_note` tool
- **Example:** "User prefers haiku format. Learned 2024-01-15."
- **Tools:** `save_note(content)`, `read_notes()`

### 3. Working Memory — the `messages` array
- **What:** Current conversation history
- **Loading:** Exists only during the session
- **Who writes it:** Accumulated automatically as the conversation progresses
- **Lifetime:** Lost when the session ends

### 4. Procedural Memory — skill files (`.md`)
- **What:** Step-by-step workflows and instructions
- **Loading:** On demand, when a specific skill is needed
- **Who writes it:** The human (templates)
- **Example:** `skills/heartbeat.md`, `skills/memory-review.md`

**Why four systems instead of one?** The context window is finite. If it were infinite, you'd load everything and memory would be one thing. Because it's finite, you need four systems with four loading strategies:
- Always load (semantic) — small, critical
- Always load if exists (episodic) — grows over time, may need summarization
- Session-scoped (working) — current context only
- Load on demand (procedural) — loaded when a specific skill triggers

---

## Chapter 4: Vigilance — The Organism Is Always Awake

**Organ:** Reticular activating system — continuous wakefulness
**Brain analog:** Brainstem reticular formation — what keeps an organism alert between deliberate actions

**What it builds:** The `Attention` class in `attention.ts` + the `awaken.ts` daemon entry point + cue definitions in `cues.ts`.

**Key components:**
- `Attention` class — unified vigilance system
- Two sensor types:
  - **Clock sensors** — periodic wakefulness (e.g., heartbeat every 30 seconds)
  - **Inbox sensors** — reactive wakefulness (`fs.watch` on inbox directories)
- `Cue` definitions — declarative descriptions of what to attend to
- `awaken.ts` — the daemon entry point that starts the Attention system

**The cue structure:**
```typescript
interface Cue {
  name: string
  agent?: string           // which agent handles this (default if omitted)
  trigger: { type: 'clock', every: number } | { type: 'inbox', path: string }
  skill?: string           // procedural memory to load
  prompt: string           // what to tell the agent
}
```

**What it does:** Keeps the agent alive between invocations. Instead of running once and dying, the agent monitors for stimuli and responds automatically.

```
$ npm run awaken

[attention] watching atlas inbox: agents/atlas/inbox/
[attention] watching nova inbox: agents/nova/inbox/
[attention] clock tick — checking cues...

# In another terminal:
$ echo "Hello Atlas" > agents/atlas/inbox/task.txt

[attention] inbox: agents/atlas/inbox/task.txt → atlas
[atlas] deliberating...
[atlas] done.
```

**The reflex arc pattern:** Stimulus → response. No deliberation about whether to respond. The agent can't choose not to respond — that's a reflex. The daemon detects a file, spawns the agent, the agent processes, done. Same as blinking when something flies at your eye.

**Key distinction from autonomy:** Vigilance is not autonomy. The agent still only acts when poked. But now it's always awake *to be poked*. Without vigilance, the organism is in deep sleep — it requires external resurrection (you running `npx tsx chat.ts`) to wake. With vigilance, it's continuously alive, sensitive to its environment.

**Run:** `npm run awaken`

---

## Chapter 5: Autonomy — The Agent Acts Without Being Asked

**Organ:** Internal drives — self-initiated action
**Brain analog:** Hypothalamus + limbic system — drives, motivation, the source of "wanting"

**What it builds:** Clock-based cues in the Attention system that fire without any external trigger.

**Key components:**
- Clock cues with intervals (e.g., `{ type: 'clock', every: 6 }` = every 30 seconds at 5s ticks)
- Skill files loaded as procedural memory when cues fire
- Standing orders — the agent initiates because of internal state, not external stimulus

**The shift:**
| Chapter 4 (Vigilance) | Chapter 5 (Autonomy) |
|------------------------|----------------------|
| External trigger (file drop) | Internal trigger (clock) |
| Human initiates | Agent initiates |
| Reflex — stimulus → response | Drive — time → action |
| Responsive | Autonomous |

**What it does:** The agent acts on a schedule. No human drops a file. No external event occurs. Time elapses, the clock ticks, a cue fires, the agent wakes and acts.

**Example cues:**
```typescript
{ name: 'heartbeat', trigger: { type: 'clock', every: 6 },
  skill: 'heartbeat', prompt: 'Run your heartbeat check.' }

{ name: 'memory-review', trigger: { type: 'clock', every: 60 },
  skill: 'memory-review', prompt: 'Review and consolidate your memories.' }
```

**Why this is the autonomy threshold:** An agent that only reacts is a sophisticated tool — it waits for you to use it. An agent that initiates action is autonomous — it acts because of something happening inside it. The motivation source has shifted from external to internal. Same cortex. Same tools. Same memory. Different source of "wanting."

---

## Chapter 6: The Genome — One Blueprint, Many Organisms

**Organ:** DNA — the blueprint that defines an organism before it's born
**Brain analog:** Genetic code — same cellular machinery, different expression

**What it builds:** `AgentConfig` interface in `agent-config.ts` + parameterized tool executors + inter-agent messaging in `actions/messaging.ts`.

**Key components:**
- `AgentConfig` — bundles everything that makes an agent unique:
  ```typescript
  interface AgentConfig {
    name: string
    persona: string           // path to identity.md
    memoryDir: string         // where notes live
    sandboxDir: string        // isolated workspace
    model: string             // which LLM
    tools: ChatCompletionTool[]
    maxIterations: number
  }
  ```
- `createDefaultConfig(name)` — factory that creates the directory tree under `agents/{name}/`
- `createToolExecutor(sandboxDir, memoryDir, agentName)` — returns a closure bound to specific paths
- Inter-agent messaging:
  - `send_message(to, message)` — drops a file in the target agent's inbox
  - `list_agents()` — discover other agents in the system

**The isolation pattern:**
```
agents/
  atlas/
    identity.md     ← calm, precise personality
    memory/         ← atlas's episodic memory
    sandbox/        ← atlas's workspace
    inbox/          ← messages from other agents
  nova/
    identity.md     ← enthusiastic, creative personality
    memory/         ← nova's episodic memory
    sandbox/        ← nova's workspace
    inbox/          ← messages from other agents
```

**What varies vs what's shared:**
| Shared (cellular machinery) | Varies (genome) |
|------------------------------|-----------------|
| LLM client (`llm.ts`) | Identity file |
| Tool definitions (schemas) | Sandbox directory |
| Agent loop (`deliberate()`) | Memory directory |
| Attention system | Model choice |
| | Max iterations |

**How agents communicate:** File-based messaging through inbox directories. When Atlas sends a message to Nova, a `.txt` file appears in `agents/nova/inbox/`. Nova's inbox cue detects it, spawns Nova, Nova reads the message and acts. Asynchronous, decoupled, observable (you can `ls` the inboxes).

**Why this matters:** Chapters 1–5 built one agent with hardcoded paths. You couldn't run two agents without them stomping on each other's files and sharing each other's brains. The genome extracts everything agent-specific into a config object. Same loop, same tools, same LLM — different identity, different workspace, different memory. Different DNA, same cellular machinery.

**Run:** `npm run awaken` (creates agents lazily as their cues fire)

---

## The Full Picture

```
Step 0:     THE SHELL            stdin/stdout — ear and mouth exist before the brain
Chapter 1a: THE RAW CORTEX       LLM call — tokens in, tokens out — reasoning without acting
Chapter 1b: THE ACTION INTERFACE  tool calling — the cortex can act (read-only for safety)
Chapter 1c: THE AGENT LOOP       while(true) — reason → act → observe → repeat — LLM becomes agent
Chapter 2:  THE BODY             write_file + safePath — the agent changes the world
Chapter 3:  MEMORY               semantic + episodic + working + procedural — four loading strategies
Chapter 4:  VIGILANCE            Attention class — always awake, reflex arc, stimulus → response
Chapter 5:  AUTONOMY             clock cues — self-initiated action, motivation shifts internal
Chapter 6:  THE GENOME           AgentConfig — one blueprint, many isolated organisms
```

**The thesis:** A raw LLM is not an agent. Add tools and it can act once (1b). Add the loop and it's an agent (1c). Give it hands and it changes the world (2). Give it memory and it persists across sessions (3). Keep it awake and it responds to stimuli (4). Give it drives and it acts on its own (5). Extract its DNA and you can run many from the same machinery (6).

---

## File Map

| File | Chapter | Purpose |
|------|---------|---------|
| `llm.ts` | 1a | LLM client setup (provider-agnostic) |
| `agent.ts` | 1c, 6 | Agent class with `deliberate()` loop |
| `agent-config.ts` | 6 | `AgentConfig` interface + `createDefaultConfig()` |
| `attention.ts` | 4, 5 | `Attention` class — vigilance system |
| `cues.ts` | 4, 5 | Cue definitions (clock + inbox sensors) |
| `awaken.ts` | 4 | Daemon entry point |
| `index.ts` | 1a | One-shot agent execution entry point |
| `actions/index.ts` | 1b, 6 | Tool registry + parameterized executor factory |
| `actions/files.ts` | 1b, 2 | File I/O tools (read + write + sandbox) |
| `actions/memory.ts` | 3 | Episodic memory tools (save_note, read_notes) |
| `actions/messaging.ts` | 6 | Inter-agent communication |
| `memory/persona.md` | 3 | Default agent's semantic memory |
| `agents/*/identity.md` | 6 | Per-agent semantic memory |
| `skills/*.md` | 3 | Procedural memory templates |

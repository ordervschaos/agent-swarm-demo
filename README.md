# Chapter 3: Memory — The Agent Remembers

*From amnesiac to persistent — and why memory splits into types.*

The agent from Chapters 1-2 can think, act, and write files — but it's amnesiac. Every run starts blank. The context window is finite, so you can't load everything. This forces a choice: what goes in the prompt? That choice creates **memory types**.

Memory isn't one system. It's multiple systems forced into existence by the constraint of the context window. You can't fit everything, so you split: some things are always loaded (identity), some things are loaded when relevant (notes), some things live in external storage and get retrieved on demand. Each type has different tradeoffs — who curates it, when it loads, how much context it burns.

```
MEMORY
  ┌────────────────────────────────────────────────────────────────┐
  │ SYSTEM PROMPT                                                   │
  │   ┌──────────────┐  ┌──────────────────────────────┐           │
  │   │ identity.md  │  │ memory/notes.md              │           │
  │   │ (semantic)   │  │ (episodic)                   │           │
  │   │ human-curated│  │ agent-curated                │           │
  │   │ loaded every │  │ loaded if exists             │           │
  │   │ run          │  │ written via save_note tool   │           │
  │   └──────────────┘  └──────────────────────────────┘           │
  └────────────────────────────────────────────────────────────────┘
  TOOLS
    ├── list_files, read_file, write_file  ← sandbox (workspace)
    ├── save_note(content)                 ← write to memory
    └── read_notes()                       ← read from memory
```

---

## Setup

```bash
npm install
```

Uses the same API key as Chapters 1-2. If you haven't set one up:

1. Go to https://aistudio.google.com/apikey
2. Create an API key
3. Add it to `.env.local`

---

## Identity — Semantic Memory

*A file loaded into the system prompt that defines who the agent is.*

```bash
npm run identity
npm run identity "Who are you?"
```

**What you're seeing:** The agent reads `identity.md` at startup and injects it into the system prompt. Ask "who are you?" — it answers as Atlas, with the personality defined in the file. Same cortex, same loop, same tools — different identity.

**Try this:** Open `identity.md` and change the name to "Nova" and the personality to "enthusiastic and uses lots of exclamation marks." Run again. Different agent. The cortex (LLM) didn't change. The identity (memory) did.

**The lesson:** Semantic memory is content loaded into the system prompt from a file. It's **human-curated** — you wrote `identity.md`, not the agent. It burns context every run (the entire file sits in the prompt). But it gives the agent a stable identity, rules, and knowledge that persists across sessions.

This is `CLAUDE.md` in NanoClaw. Every group has one. The human writes it, the agent reads it every run.

---

## Learned Facts — Episodic Memory

*Memory the agent writes itself, persisted across runs.*

```bash
npm run remember "My name is Alex and I live in London. Remember this for next time."
cat memory/notes.md
npm run remember "What's my name and where do I live?"
```

**What you're seeing:** The first run, the agent uses `save_note` to write your info to `memory/notes.md`. The second run, it loads that file at startup and knows your name without being told again.

**How it works:**
1. At startup, check if `memory/notes.md` exists → load into system prompt as "Your notes from previous sessions"
2. The agent also loads `identity.md` (semantic + episodic combined)
3. `save_note(content)` appends a timestamped line to `memory/notes.md`
4. `read_notes()` returns the file contents

**The lesson:** Episodic memory is persistent storage the agent reads AND writes. It's **agent-curated** — the agent decides what to save. This is fundamentally different from semantic memory: no human in the loop. The agent builds its own knowledge over time.

The tradeoff: agent-curated memory can drift, accumulate noise, or save irrelevant things. Human-curated memory is stable but requires a human to maintain it. Real systems use both.

---

## What you built

| Component | What it does | Memory type |
|-----------|-------------|-------------|
| `identity.md` | Agent name, personality, rules | Semantic (human-curated) |
| `memory/notes.md` | Agent-written facts from past sessions | Episodic (agent-curated) |
| `identity.ts` | Agent loop with identity loaded | Reads semantic memory |
| `remember.ts` | Agent loop with identity + notes + memory tools | Reads + writes episodic memory |

---

## Key concepts

**Four memory types** (two built here, two in later chapters):

| Type | Who curates | When loaded | Example |
|------|------------|-------------|---------|
| **Semantic** | Human | Every run | `identity.md`, `CLAUDE.md` |
| **Episodic** | Agent | Every run (if exists) | `memory/notes.md`, auto-memory |
| **Working** | Agent | During a single run | The conversation messages array |
| **Retrieval** | System | On demand (search) | Vector DB, file search *(Chapter 7)* |

**The context window constraint.** Everything the agent knows must fit in the context window. You can't load a 500-page manual into every prompt. This constraint forces you to split memory into types: what's always loaded (semantic), what's loaded when available (episodic), what's already in the conversation (working), and what's fetched on demand (retrieval).

**Human-curated vs. agent-curated.** Semantic memory (`identity.md`) is stable — a human wrote it and it doesn't change between runs. Episodic memory (`notes.md`) grows — the agent adds to it every session. This distinction matters: human-curated memory is reliable but doesn't scale; agent-curated memory scales but can accumulate noise.

**Workspace ≠ memory.** The sandbox (`./sandbox/`) is the agent's workspace — files it creates for the current task. Memory (`./memory/`) persists across runs. Same filesystem, different purposes. In NanoClaw, the container filesystem is the workspace; `CLAUDE.md` and auto-memory are the memory.

---

## Where this lives in NanoClaw

- **Semantic memory:** `groups/{name}/CLAUDE.md` — each group has a human-curated identity file. The agent reads it every run. You edit it to change the agent's behavior.
- **Episodic memory:** Agent auto-memory — the agent saves facts about users, preferences, and context across conversations. Loaded into the system prompt each run.
- **Working memory:** The conversation messages array — everything said in the current session. Lost when the session ends.
- **Retrieval memory:** Coming in Chapter 7 — searching past conversations, documents, and external knowledge on demand.

**Next:** Chapter 4 *(coming soon)*

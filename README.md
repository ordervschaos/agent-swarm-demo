# Chapter 4: Autonomy — The Agent Acts Without Being Asked

*From reactive to autonomous — same cortex, different input source.*

So far the agent only acts when a human types. It's reactive — input comes from stdin, output goes to stdout, and nothing happens without a prompt. Now change one thing: the input source.

Instead of `stdin`, the input channel is a directory: `inbox/`. When a `.txt` file appears, the daemon reads it as the task, runs the agent in-process, and writes the reply to `outbox/`. The human drops a file and walks away.

```
BEFORE (chat.ts):              AFTER (daemon.ts):
Human types → agent responds   File drops → agent responds
Human is the trigger           fs.watch is the trigger
```

The cortex doesn't change. The tools don't change. Memory doesn't change. The only thing that changes is **what triggers the agent**.

---

## Setup

```bash
npm install
```

Same API key as Chapters 1-3.

---

## Run

```bash
npm run daemon
```

Then in another terminal:

```bash
echo "write a haiku about filesystems to sandbox/haiku.txt" > inbox/task.txt
```

The daemon picks it up, runs the agent, writes the reply to `outbox/task.txt`. Walk away and come back — it'll be done.

```
[daemon] watching inbox/ for .txt files
[daemon] replies will appear in outbox/

[inbox] task.txt
  "write a haiku about filesystems to sandbox/haiku.txt"
  [1] write_file({"path":"haiku.txt","content":"..."})
[outbox] task.txt
  "Done. I wrote a haiku to sandbox/haiku.txt."
```

---

## Each task is independent

The daemon passes `[{role:'user', content: task}]` — a single-turn conversation with no prior history. Spawn → process → release.

This is the key difference from `chat.ts`:

| `chat.ts` (interactive) | `daemon.ts` (autonomous) |
|------------------------|--------------------------|
| Accumulates history across a session | Each task is stateless |
| Human is always in the loop | No human needed |
| One conversation at a time | Can queue multiple tasks |

Memory still persists — `identity.md` and `memory/notes.md` are loaded for every task. The agent knows who it is and what it's learned. But the conversation history from the last task is gone.

---

## How it works

```
fs.watch(inbox/)
    │
    │  task.txt appears
    ▼
renameSync(inbox/task.txt → inbox/._task.txt)   ← atomic claim
readFileSync → task string
    │
    ▼
runAgent(task)
  ├── load identity.md
  ├── load memory/notes.md
  ├── messages = [{ system }, { user: task }]
  └── agent loop (reason → act → observe → repeat)
    │
    ▼
writeFileSync(outbox/task.txt, reply)
rmSync(inbox/._task.txt)                        ← clean up
```

**Why `renameSync` before reading?** `fs.watch` can fire multiple events for the same file (one for create, one for write). The rename is atomic — whichever event gets there first claims the file. The second event finds the file gone and returns early.

**Why process existing files on startup?** If a file was dropped while the daemon wasn't running, it would be missed by `fs.watch`. The startup scan catches it.

---

## What you built

| Component | What it does |
|-----------|-------------|
| `daemon.ts` | Watches inbox/, runs agent per task, writes to outbox/ |
| `inbox/` | Drop `.txt` files here to queue tasks |
| `outbox/` | Replies appear here with the same filename |

From Chapters 1-3, unchanged:
- `llm.ts` — the LLM client
- `tools.ts` — sandbox + memory tools
- `identity.md` — who the agent is
- `memory/notes.md` — what the agent has learned

---

## Key concept: two clocks

The file watcher and the LLM are on different clocks. The LLM runs when triggered by the file watcher, not by the human. The human's role shifts from "conversation partner" to "task submitter." The agent's role shifts from "respondent" to "worker."

Same cortex. Same walls. Different relationship.

This is the central pattern of autonomous agents. In NanoClaw, WhatsApp replaces `fs.watch` — a message arrives, the orchestrator drops it in a queue, the agent picks it up. The inbox is a SQLite table. The outbox is the WhatsApp send API. The pattern is identical.

---

## Where this lives in NanoClaw

- `src/index.ts:startMessageLoop()` — the message loop (WhatsApp = file watcher)
- `src/index.ts:processGroupMessages()` — spawn + release logic
- `src/db.ts` — the inbox (SQLite message queue, not files)

**Next:** Chapter 5 — The Clock *(give the agent a schedule)*

# Chapter 5: The Clock — The Agent Acts on a Schedule

*From reactive to proactive — same cortex, different trigger.*

Chapter 4's vigilance loop watches `inbox/` and waits. It only acts when something arrives. Now change one thing: **the trigger**.

Instead of `fs.watch`, the trigger is a clock. The agent has standing orders — tasks defined in code, each with a schedule. A poll loop wakes every few seconds, finds tasks that are due, and runs the agent. No human needed, no file dropped. Time is enough.

```
BEFORE (vigilance.ts):          AFTER (clock.ts):
File drops → agent responds     Clock ticks → agent runs
fs.watch is the trigger         setInterval is the trigger
Reactive — waits for input      Proactive — acts on schedule
```

The cortex doesn't change. The tools don't change. Memory doesn't change. The only thing that changes is **what triggers the agent**.

---

## Setup

```bash
npm install
```

Same API key as Chapters 1-4.

---

## Run

```bash
npm run clock
```

Expected output:

```
[clock] started — 2 task(s) configured
  heartbeat: every 30s
  memory-review: every 120s

[clock] running "heartbeat"
  prompt: "Write the current timestamp and a one-line status to sandbox/heartbeat.txt"
    [1] write_file({"path":"heartbeat.txt","content":"..."})
[clock] "heartbeat" done in 2.3s
  reply: "Done. I've written the timestamp and status to sandbox/heartbeat.txt."

[clock] running "memory-review"
  prompt: "Read your notes and write a one-paragraph summary to sandbox/summary.txt"
    [1] read_notes({})
    [2] write_file({"path":"summary.txt","content":"..."})
[clock] "memory-review" done in 3.1s
  reply: "Done. I've written a summary of my notes to sandbox/summary.txt."
```

Both tasks run immediately on startup. Then:
- `heartbeat` runs again every 30s
- `memory-review` runs again every 2 minutes

Check the output files:

```bash
cat sandbox/heartbeat.txt
cat sandbox/summary.txt
```

---

## How it works

```
setInterval(tick, TICK_MS)
    │
    │  every 5s: wake up
    ▼
tick()
  for each task:
    if now >= nextRun[id]:
      runAgent(task.prompt)
      nextRun[id] = now + task.every
```

**One loop, not one timer per task.** A common mistake is `setInterval(runTask, every)` for each task individually. That works until you have 20 tasks — then you have 20 independent timers, no coordination, and concurrent LLM calls that pile up. One central loop checks all tasks and runs them sequentially.

**Run immediately on startup.** `nextRun` starts at `0` for every task, so the first `tick()` call (before `setInterval` fires) runs everything. The user sees output right away instead of waiting for the first interval.

**Sequential runs prevent pile-up.** `tick()` awaits each `runAgent` call before moving to the next task. If the LLM is slow, tasks queue up naturally rather than spawning concurrent requests.

---

## The tasks array

```typescript
const TASKS: Task[] = [
  {
    id: 'heartbeat',
    prompt: 'Write the current timestamp and a one-line status to sandbox/heartbeat.txt',
    every: 30_000,   // 30s
  },
  {
    id: 'memory-review',
    prompt: 'Read your notes and write a one-paragraph summary to sandbox/summary.txt',
    every: 2 * 60_000,  // 2 min
  },
]
```

Standing orders. The agent doesn't decide what to do or when — the task array decides. The agent just executes.

To add a task: push to the array. To change frequency: change `every`. No cron syntax, no config files, no UI.

---

## What you built

| Component | What it does |
|-----------|-------------|
| `clock.ts` | Defines tasks, runs poll loop, invokes agent on schedule |
| `TASKS` array | Standing orders — what to do and how often |
| `nextRun` map | In-memory schedule state — when each task runs next |
| `tick()` | Checks all tasks, runs due ones sequentially |

From Chapters 1-4, unchanged:
- `llm.ts` — the LLM client
- `actions.ts` — sandbox tools (senses + limbs)
- `memory.ts` — episodic memory tools
- `persona.md` — who the agent is
- `memory/notes.md` — what the agent has learned

---

## Key concept: proactive vs reactive

The vigilance loop (Chapter 4) is reactive — it responds to events. The clock is proactive — it initiates action on its own schedule. Both use the same agent loop. The difference is entirely in what calls `runAgent`.

| `vigilance.ts` (reactive) | `clock.ts` (proactive) |
|---------------------------|------------------------|
| Trigger: file appears | Trigger: time elapses |
| Task source: human drops a file | Task source: hardcoded task array |
| Waits for input | Acts without input |
| Stateless per task | Stateless per task (same) |

An agent that only reacts is a tool. An agent that acts on a schedule is autonomous.

---

## Where this lives in NanoClaw

`src/task-scheduler.ts:startSchedulerLoop()` — the identical pattern:

```typescript
const loop = async () => {
  const dueTasks = getDueTasks()          // ← query DB instead of checking nextRun map
  for (const task of dueTasks) {
    await runTask(task, deps)             // ← sequential, same as here
  }
  setTimeout(loop, SCHEDULER_POLL_INTERVAL)
}
loop()
```

The differences are cosmetic:
- SQLite (`getDueTasks()`) replaces the in-memory `nextRun` map — persists across restarts
- `setTimeout(loop, interval)` re-schedules each iteration (drift-free) vs `setInterval` (fixed cadence)
- Tasks come from the DB, not a hardcoded array — can be added/paused at runtime

The core pattern is the same: **one loop, sequential execution, clock as trigger**.

---

**Next:** Chapter 6 — The Immune System *(rate limits, retries, circuit breakers)*

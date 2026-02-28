/**
 * Chapter 5: The Clock — The Agent Acts on a Schedule
 *
 * Defines tasks as { id, prompt, every } — standing orders.
 * A poll loop wakes every TICK_MS, finds due tasks, runs the agent,
 * updates nextRun, then sleeps.
 *
 * The cortex doesn't change. The input source doesn't change.
 * The trigger does: it's now a clock, not a human or a file.
 *
 * Run: npm run clock
 */

import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { loadPersona, buildSystemPrompt, allTools, runAgent } from './agent.js'
import { loadNotes } from './memory.js'

// --- Config ---

const TICK_MS = 5_000           // how often the loop wakes to check for due tasks
const SANDBOX = resolve('sandbox')

if (!existsSync(SANDBOX)) mkdirSync(SANDBOX, { recursive: true })

// --- Tasks ---
// Each task is a standing order: run `prompt` every `every` milliseconds.

interface Task {
  id: string
  prompt: string
  every: number   // ms
}

const TASKS: Task[] = [
  {
    id: 'heartbeat',
    prompt: 'Write the current timestamp and a one-line status to sandbox/heartbeat.txt',
    every: 30_000,  // 30s
  },
  {
    id: 'memory-review',
    prompt: 'Read your notes and write a one-paragraph summary to sandbox/summary.txt',
    every: 2 * 60_000,  // 2 min
  },
]

// --- Next-run tracking (in-memory map, keyed by task id) ---
// Set to 0 so every task runs immediately on the first tick.

const nextRun: Record<string, number> = {}
for (const task of TASKS) {
  nextRun[task.id] = 0
}

// --- Poll loop ---
// One interval, not one timer per task. Each tick iterates all tasks and runs
// any that are due. Tasks run sequentially — no concurrent LLM calls.

async function tick() {
  const now = Date.now()

  for (const task of TASKS) {
    if (now < nextRun[task.id]) continue

    console.log(`\n[clock] running "${task.id}"`)
    console.log(`  prompt: "${task.prompt}"`)

    const start = Date.now()
    try {
      const identity = loadPersona()
      const notes = loadNotes()
      const systemPrompt = buildSystemPrompt(identity, notes)
      const reply = await runAgent(task.prompt, systemPrompt, allTools)
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[clock] "${task.id}" done in ${elapsed}s`)
      console.log(`  reply: "${reply.length > 100 ? reply.slice(0, 100) + '...' : reply}"`)
    } catch (e: any) {
      console.error(`[clock] "${task.id}" error: ${e.message}`)
    }

    nextRun[task.id] = Date.now() + task.every
  }
}

// --- Main ---

console.log(`[clock] started — ${TASKS.length} task(s) configured`)
for (const t of TASKS) {
  console.log(`  ${t.id}: every ${t.every / 1000}s`)
}
console.log()

// Run immediately, then on every tick
tick()
setInterval(tick, TICK_MS)

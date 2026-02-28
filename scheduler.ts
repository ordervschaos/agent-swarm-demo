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
 * Run: npm run scheduler
 */

import { existsSync, mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { llm, MODEL } from './llm.js'
import {
  listFilesTool, readFileTool, writeFileTool,
  saveNoteTool, readNotesTool,
  executeTool, loadNotes,
} from './tools.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

// --- Config ---

const TICK_MS  = 5_000           // how often the loop wakes to check for due tasks
const IDENTITY = resolve('identity.md')
const SANDBOX  = resolve('sandbox')

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

// --- Agent loop (single task, no shared history) ---

async function runAgent(prompt: string): Promise<string> {
  const identity = existsSync(IDENTITY) ? readFileSync(IDENTITY, 'utf-8') : ''
  const notes = loadNotes()

  let systemPrompt = identity ? `${identity}\n\n---\n\n` : ''
  systemPrompt += `You are a helpful agent. Use your tools to accomplish tasks. All file paths are relative to the sandbox directory. When you have the final answer, respond with text (no tool call).`
  if (notes) systemPrompt += `\n\n---\n\nYour notes from previous sessions:\n${notes}`

  const tools = [listFilesTool, readFileTool, writeFileTool, saveNoteTool, readNotesTool]
  const MAX_ITERATIONS = 15
  let iterations = 0

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ]

  while (true) {
    const response = await llm.chat.completions.create({ model: MODEL, tools, messages })
    const message = response.choices[0].message

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? ''
    }

    if (++iterations > MAX_ITERATIONS) {
      return '[max iterations reached]'
    }

    messages.push(message)

    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments)
      console.log(`    [${iterations}] ${call.function.name}(${JSON.stringify(args)})`)
      const result = executeTool(call.function.name, args)
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }
}

// --- Poll loop ---
// One interval, not one timer per task. Each tick iterates all tasks and runs
// any that are due. Tasks run sequentially — no concurrent LLM calls.

async function tick() {
  const now = Date.now()

  for (const task of TASKS) {
    if (now < nextRun[task.id]) continue

    console.log(`\n[scheduler] running "${task.id}"`)
    console.log(`  prompt: "${task.prompt}"`)

    const start = Date.now()
    try {
      const reply = await runAgent(task.prompt)
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[scheduler] "${task.id}" done in ${elapsed}s`)
      console.log(`  reply: "${reply.length > 100 ? reply.slice(0, 100) + '...' : reply}"`)
    } catch (e: any) {
      console.error(`[scheduler] "${task.id}" error: ${e.message}`)
    }

    nextRun[task.id] = Date.now() + task.every
  }
}

// --- Main ---

console.log(`[scheduler] started — ${TASKS.length} task(s) configured`)
for (const t of TASKS) {
  console.log(`  ${t.id}: every ${t.every / 1000}s`)
}
console.log()

// Run immediately, then on every tick
tick()
setInterval(tick, TICK_MS)

/**
 * Chapter 4: Autonomy — The Agent Acts Without Being Asked
 *
 * Watches inbox/ for .txt files. When one appears, runs the agent in-process
 * and writes the reply to outbox/. Each task is independent — no shared history.
 *
 * The cortex doesn't change. The input source does.
 * Instead of a human typing, the input channel is a directory.
 *
 * Run:   npm run daemon
 * Then (in another terminal):
 *   echo "write a haiku about filesystems to sandbox/haiku.txt" > inbox/task.txt
 */

import { watch, readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { llm, MODEL } from './llm.js'
import {
  listFilesTool, readFileTool, writeFileTool,
  saveNoteTool, readNotesTool,
  executeTool, loadNotes,
} from './tools.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

const INBOX    = resolve('inbox')
const OUTBOX   = resolve('outbox')
const IDENTITY = resolve('identity.md')

for (const dir of [INBOX, OUTBOX]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Tracks filenames currently being processed — prevents double-firing from fs.watch
const processing = new Set<string>()

// --- Agent loop (single task, no shared history) ---

async function runAgent(task: string): Promise<string> {
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
    { role: 'user', content: task },
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
      console.log(`  [${iterations}] ${call.function.name}(${JSON.stringify(args)})`)
      const result = executeTool(call.function.name, args)
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }
}

// --- File handler ---

async function handleFile(filename: string) {
  if (!filename.endsWith('.txt')) return
  if (processing.has(filename)) return

  const src = resolve(INBOX, filename)
  const tmp = resolve(INBOX, `._${filename}`)

  // Rename before reading — atomic claim prevents double-processing if watch fires twice
  try {
    renameSync(src, tmp)
  } catch {
    return  // another event already grabbed it
  }

  processing.add(filename)

  const task = readFileSync(tmp, 'utf-8').trim()
  console.log(`\n[inbox] ${filename}`)
  console.log(`  "${task.length > 80 ? task.slice(0, 80) + '...' : task}"`)

  try {
    const reply = await runAgent(task)
    writeFileSync(resolve(OUTBOX, filename), reply)
    console.log(`[outbox] ${filename}`)
    console.log(`  "${reply.length > 80 ? reply.slice(0, 80) + '...' : reply}"`)
  } catch (e: any) {
    const msg = `[error] ${e.message}`
    writeFileSync(resolve(OUTBOX, filename), msg)
    console.error(`[error] ${filename}: ${e.message}`)
  } finally {
    processing.delete(filename)
    try { rmSync(tmp) } catch {}
  }
}

// --- Main ---

console.log(`[daemon] watching inbox/ for .txt files`)
console.log(`[daemon] replies will appear in outbox/\n`)

// Process any files already in inbox on startup
for (const f of readdirSync(INBOX)) {
  if (f.endsWith('.txt')) handleFile(f)
}

// Watch for new files
watch(INBOX, (_, filename) => {
  if (filename) handleFile(filename)
})

/**
 * Chapter 4: Vigilance — The Agent Watches and Responds
 *
 * Watches inbox/ for .txt files. When one appears, runs the agent in-process
 * and writes the reply to outbox/. Each task is independent — no shared history.
 *
 * The cortex doesn't change. The input source does.
 * Instead of a human typing, the input channel is a directory.
 *
 * Run:   npm run vigilance
 * Then (in another terminal):
 *   echo "write a haiku about filesystems to sandbox/haiku.txt" > inbox/task.txt
 */

import { watch, readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { loadPersona, buildSystemPrompt, allTools, runAgent } from './agent.js'
import { loadNotes } from './memory.js'

const INBOX  = resolve('inbox')
const OUTBOX = resolve('outbox')

for (const dir of [INBOX, OUTBOX]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Tracks filenames currently being processed — prevents double-firing from fs.watch
const processing = new Set<string>()

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
    const identity = loadPersona()
    const notes = loadNotes()
    const systemPrompt = buildSystemPrompt(identity, notes)
    const reply = await runAgent(task, systemPrompt, allTools)
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

console.log(`[vigilance] watching inbox/ for .txt files`)
console.log(`[vigilance] replies will appear in outbox/\n`)

// Process any files already in inbox on startup
for (const f of readdirSync(INBOX)) {
  if (f.endsWith('.txt')) handleFile(f)
}

// Watch for new files
watch(INBOX, (_, filename) => {
  if (filename) handleFile(filename)
})

---
name: chapter-5-autonomy
description: Build Chapter 5 of the agent tutorial — Autonomy (the daemon). Use when the student says "build chapter 5", "make the agent autonomous", "build the daemon", or wants the agent to act without being asked. Requires Chapter 4 (The Room, containers) to already exist.
---

# Chapter 5: Autonomy — The Agent Acts Without Being Asked

The cortex doesn't change. The input source does. Instead of `stdin`, the input channel is a directory: `inbox/`. When a `.txt` file appears, the agent processes it and writes the reply to `outbox/`.

And because the room already exists (Chapter 4), the daemon gets walls for free. There's no in-process version — we go straight to `container-daemon.ts`. The daemon never ran without walls. It never needed to.

## Prerequisites

- Chapter 4 (The Room) complete: `Dockerfile`, `container-entry.ts`, `tutorial-agent` image built
- `inbox/`, `outbox/`, `sandbox/`, `memory/` directories (created at startup)

## The pattern

**monitor → filter → spawn → respond**

- `fs.watch` on `inbox/` — the monitor
- `.txt` filter — the filter
- `spawn('docker', ...)` — the spawn
- write to `outbox/` — the respond

In NanoClaw, WhatsApp replaces the file watcher — but the pattern is identical.

## Create `container-daemon.ts`

```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })
import { watch, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { resolve } from 'path'
import { spawn } from 'child_process'

const INBOX    = resolve('inbox')
const OUTBOX   = resolve('outbox')
const DONE     = resolve('inbox/.done')
const SANDBOX  = resolve('sandbox')
const MEMORY   = resolve('memory')
const IDENTITY = resolve('identity.md')

for (const dir of [INBOX, OUTBOX, DONE, SANDBOX, MEMORY]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

async function runInContainer(task: string, jobId: string): Promise<string> {
  const knownKeys = ['GEMINI_API_KEY', 'MINIMAX_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY']
  const envFlags = knownKeys.flatMap(k => process.env[k] ? ['--env', `${k}=${process.env[k]}`] : [])

  return new Promise((done, reject) => {
    const docker = spawn('docker', [
      'run', '--rm', '--interactive',
      '--name', `tutorial-agent-${jobId}`,
      ...envFlags,
      '--volume', `${SANDBOX}:/agent/sandbox`,
      '--volume', `${MEMORY}:/agent/memory`,
      '--volume', `${IDENTITY}:/agent/identity.md:ro`,
      'tutorial-agent',
    ])

    // Single-turn: wrap task as a one-message conversation
    docker.stdin.write(JSON.stringify([{ role: 'user', content: task }]))
    docker.stdin.end()

    const chunks: string[] = []
    docker.stdout.on('data', chunk => chunks.push(chunk.toString()))
    docker.stderr.on('data', chunk => process.stderr.write(chunk))

    docker.on('close', code => {
      if (code !== 0) reject(new Error(`Container exited ${code}`))
      else done(chunks.join('').trim())
    })
  })
}

async function processFile(filename: string): Promise<void> {
  const inPath = resolve(INBOX, filename)
  if (!existsSync(inPath)) return

  const task = readFileSync(inPath, 'utf-8').trim()
  if (!task) return

  const jobId = `${filename.replace('.txt', '')}-${Date.now()}`

  console.log(`\n[inbox] ${filename}`)
  console.log(`  "${task}"`)

  renameSync(inPath, resolve(DONE, filename))  // move before running — prevent double-processing

  const reply = await runInContainer(task, jobId)

  writeFileSync(resolve(OUTBOX, filename), reply)
  console.log(`[outbox] ${filename}`)
  console.log(`  "${reply.slice(0, 120)}${reply.length > 120 ? '...' : ''}"`)
}

const processing = new Set<string>()

watch(INBOX, async (_, filename) => {
  if (!filename?.endsWith('.txt')) return
  if (processing.has(filename)) return

  processing.add(filename)
  try {
    await processFile(filename)
  } finally {
    processing.delete(filename)
  }
})

console.log('[container-daemon] watching inbox/ — each task runs in an isolated container')
console.log('[container-daemon] try: echo "list my files" > inbox/task.txt')
console.log()
```

## Add script to `package.json`

```json
"container-daemon": "node --no-deprecation --import tsx/esm container-daemon.ts",
```

## Run

```bash
npm run build-container        # if not already built
npm run container-daemon       # start the daemon

# in another terminal:
echo "write a haiku about filesystems to sandbox/haiku.txt" > inbox/task.txt
cat outbox/task.txt
cat sandbox/haiku.txt
```

## What the student sees

```
[container-daemon] watching inbox/ — each task runs in an isolated container

[inbox] task.txt
  "write a haiku about filesystems to sandbox/haiku.txt"
[outbox] task.txt
  "Done. I wrote a haiku to sandbox/haiku.txt."
```

The daemon is already running when the file drops in. The agent didn't wait to be asked. And it was never running without walls.

## What to tell the student

- **Same cortex, different input source.** The `container-entry.ts` is unchanged — same agent loop, same tools. Only the trigger changed: a file drop instead of a keypress.
- **Walled from day one.** The daemon never had an in-process version. The room came first, so autonomy is already isolated. This is the natural order: establish the execution environment, then vary the trigger.
- **Each task is independent.** The daemon passes `[{role:'user', content: task}]` — a single-turn conversation. No shared history. Spawn → process → release. Compare with `chat.ts`: the REPL accumulates history across a session; the daemon treats each task as isolated.
- **`renameSync` before spawning** — the file is moved out of inbox *before* processing, not after. This prevents double-processing if `fs.watch` fires twice (which it does, reliably, on macOS).
- **The `processing` Set** — `fs.watch` is not atomic. Multiple events can fire for one file creation. The Set ensures only one handler runs at a time.
- **The host is still pure orchestration.** `container-daemon.ts` imports nothing from `llm.ts` or `tools.ts` — just like `chat.ts`. The same principle: the host spawns rooms and routes I/O.
- **This is the central executive pattern.** `fs.watch` is the monitor. The `.txt` filter is the filter. `spawn('docker', ...)` is the spawn. Writing to `outbox/` is the respond. In NanoClaw, WhatsApp replaces the file watcher — but the pattern is identical.
- **In NanoClaw:** `src/index.ts:startMessageLoop()` — same pattern, WhatsApp as the monitor. `src/index.ts:processGroupMessages()` — the spawn + release logic. `src/container-runner.ts` — the Docker spawn.

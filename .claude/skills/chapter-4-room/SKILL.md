---
name: chapter-4-room
description: Build Chapter 4 of the agent tutorial — The Room (container isolation). Use when the student says "build chapter 4", "build the room", "add containers", or wants the agent to run in an isolated Docker container. Requires Chapter 3 (memory, tools.ts, identity.md) to already exist.
---

# Chapter 4: The Room — Container Isolation

The container is not part of the agent. It's infrastructure. The agent doesn't know it's in a container — the walls were built before the cortex booted.

The walls aren't permission checks. They're absence: files that don't exist in the container's universe were simply never mounted. The agent can't access `llm.ts` or `tools.ts` — not because it's forbidden, but because those files don't exist from the container's perspective.

This applies to interactive sessions too. A human watching doesn't make bash safe — the agent can chain dangerous tool calls faster than a human can react. So `chat.ts` becomes a thin shell on the host. The host is pure orchestration. The intelligence runs inside.

## Prerequisites

- `tools.ts`, `llm.ts`, `identity.md` (Chapters 1-3)
- Docker installed and running

## What to build

Three files: `.dockerignore`, `Dockerfile`, `container-entry.ts`. Plus update `chat.ts` to spawn the container instead of running the agent in-process.

Key architectural point: **`chat.ts` imports nothing from `llm.ts` or `tools.ts`**. The host is pure orchestration — it spawns rooms and routes I/O. The intelligence runs inside the container.

## Create `.dockerignore`

```
node_modules/
.env*
inbox/
outbox/
sandbox/
memory/
temp_*.md
*.log
essay/
```

## Create `Dockerfile`

```dockerfile
FROM node:22-alpine
WORKDIR /agent

COPY package*.json ./
RUN npm install

# Copy agent source — NOT identity.md or memory/ (those are mounted at runtime)
COPY llm.ts tools.ts container-entry.ts ./

CMD ["node", "--no-deprecation", "--import", "tsx/esm", "container-entry.ts"]
```

`identity.md` is NOT copied in — it's mounted at runtime so each "group" can have its own identity. Memory is also mounted so it persists across container runs.

## Create `container-entry.ts`

This runs INSIDE the container. Reads conversation history from stdin as JSON, runs agent loop, writes reply to stdout.

```typescript
import { createInterface } from 'readline'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { llm, MODEL } from './llm.js'
import {
  listFilesTool, readFileTool, writeFileTool,
  saveNoteTool, readNotesTool,
  executeTool, loadNotes,
} from './tools.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

const lines: string[] = []
const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => lines.push(line))

rl.on('close', async () => {
  const history = JSON.parse(lines.join('\n')) as { role: 'user' | 'assistant'; content: string }[]
  if (!history.length) process.exit(0)

  const identity = existsSync(resolve('identity.md'))
    ? readFileSync(resolve('identity.md'), 'utf-8')
    : ''
  const notes = loadNotes()

  let systemPrompt = `${identity}

---

You are a helpful agent. Use your tools to accomplish the task. All file paths are relative to the sandbox directory.`
  if (notes) systemPrompt += `\n\n---\n\nYour notes from previous sessions:\n${notes}`

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ]

  const tools = [listFilesTool, readFileTool, writeFileTool, saveNoteTool, readNotesTool]
  const MAX_ITERATIONS = 15
  let iterations = 0

  while (true) {
    const response = await llm.chat.completions.create({ model: MODEL, tools, messages })
    const message = response.choices[0].message

    if (!message.tool_calls || message.tool_calls.length === 0) {
      process.stdout.write((message.content ?? '') + '\n')
      break
    }

    if (++iterations > MAX_ITERATIONS) {
      process.stdout.write('[max iterations reached]\n')
      break
    }

    messages.push(message)

    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments)
      const result = executeTool(call.function.name, args)
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }
})
```

## Update `chat.ts`

Replace the in-process agent loop with a thin Docker shell. The host tracks conversation history; the container executes each turn.

```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })
import * as readline from 'readline'
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { spawn } from 'child_process'

const GREEN = '\x1b[32m'
const DIM   = '\x1b[2m'
const RESET = '\x1b[0m'
const BOLD  = '\x1b[1m'

const SANDBOX  = resolve('sandbox')
const MEMORY   = resolve('memory')
const IDENTITY = resolve('identity.md')

for (const dir of [SANDBOX, MEMORY]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Conversation history — user + assistant turns only.
// The container builds the system prompt from mounted identity.md + notes each turn.
const history: { role: 'user' | 'assistant'; content: string }[] = []

function runInContainer(messages: typeof history): Promise<string> {
  const knownKeys = ['GEMINI_API_KEY', 'MINIMAX_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY']
  const envFlags = knownKeys.flatMap(k => process.env[k] ? ['--env', `${k}=${process.env[k]}`] : [])

  return new Promise((done, reject) => {
    const docker = spawn('docker', [
      'run', '--rm', '--interactive',
      ...envFlags,
      '--volume', `${SANDBOX}:/agent/sandbox`,
      '--volume', `${MEMORY}:/agent/memory`,
      '--volume', `${IDENTITY}:/agent/identity.md:ro`,
      'tutorial-agent',
    ])

    docker.stdin.write(JSON.stringify(messages))
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${BOLD}You:${RESET} `,
})

function spin(): () => void {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let i = 0
  const id = setInterval(() => {
    process.stdout.write(`\r${DIM}${frames[i++ % frames.length]} thinking...${RESET}`)
  }, 80)
  return () => {
    clearInterval(id)
    process.stdout.write('\r\x1b[K')
  }
}

rl.on('line', async (input) => {
  const text = input.trim()
  if (!text) { rl.prompt(); return }

  history.push({ role: 'user', content: text })
  const stop = spin()

  try {
    const reply = await runInContainer(history)
    history.push({ role: 'assistant', content: reply })
    stop()
    console.log(`${GREEN}Agent:${RESET} ${reply}\n`)
  } catch (e: any) {
    stop()
    console.log(`${DIM}[error] ${e.message}${RESET}\n`)
    history.pop()
  }

  rl.prompt()
})

rl.on('close', () => process.exit(0))

console.log(`${DIM}[chat] agent runs in container — walls up${RESET}\n`)
rl.prompt()
```

## Add scripts to `package.json`

```json
"chat": "node --no-deprecation --import tsx/esm chat.ts",
"build-container": "docker build -t tutorial-agent .",
```

## Run

```bash
npm run build-container        # build the image (once, or after code changes)
npm run chat                   # start the interactive REPL

# walls up — the agent sees only mounted paths
You: list your files
Agent: [sees only sandbox/ contents]
```

## What the student sees

The reply lists only sandbox contents. It cannot see `llm.ts`, `tools.ts`, or any host files. The walls are real — and they apply to the interactive REPL, not just background tasks.

## What to tell the student

- **The container is not the agent.** It's infrastructure. The agent doesn't know it's in a container — the walls were built before it booted.
- **Absence, not denial.** The agent can't reach `llm.ts` not because it's forbidden, but because the file doesn't exist in its universe. It was never mounted.
- **The wall applies to interactive sessions.** A human watching doesn't make bash safe — the agent can chain dangerous tool calls faster than a human can react. `chat.ts` spawns a container per turn, keeping the wall up throughout the session.
- **The host is pure orchestration.** `chat.ts` no longer imports `llm.ts` or `tools.ts`. It spawns rooms and routes I/O. The intelligence runs inside.
- **Conversation history travels on the host.** `chat.ts` tracks user + assistant turns locally and passes the full history to the container on each turn as JSON. The container rebuilds the system prompt from mounted files each time. The host owns the conversation state; the container owns the execution.
- **Volume mounts are the interface.** `sandbox/` is read-write (workspace). `memory/` is read-write (persistence). `identity.md` is read-only. Nothing else is visible.
- **In NanoClaw:** `src/container-runner.ts:buildVolumeMounts()` — exactly this, but per group JID. Each group gets its own sandbox and memory mounted. The container image is shared; the mounted data is isolated.

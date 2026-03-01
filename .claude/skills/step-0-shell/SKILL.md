---
name: step-0-shell
description: Build Step 0 of the agent tutorial — the terminal chat shell. Use when the student says "build step 0", "build the shell", or wants to start the tutorial from scratch with just a readline REPL and no LLM.
---

# Step 0: The Shell

Build the interactive terminal shell — ear (readline) and mouth (colored stdout) — with no LLM. This is the foundation every later chapter builds on.

## What to build

**One file:** `chat.ts`
**No new packages.** Node built-ins only.

## Setup

Check if `package.json` exists. If not, create it:

```json
{
  "name": "tutorial",
  "private": true,
  "type": "module",
  "scripts": {
    "chat": "node --no-deprecation --import tsx/esm chat.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.0"
  }
}
```

If it exists, add the `"chat"` script if missing.

Run `npm install` to install `tsx`.

## Create `chat.ts`

```typescript
import * as readline from 'readline'

// ANSI color codes
const GREEN = '\x1b[32m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${BOLD}You:${RESET} `,
})

const messages: { role: 'user' | 'assistant'; content: string }[] = []

function spin(): () => void {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let i = 0
  const id = setInterval(() => {
    process.stdout.write(`\r${DIM}${frames[i++ % frames.length]} thinking...${RESET}`)
  }, 80)
  return () => {
    clearInterval(id)
    process.stdout.write('\r\x1b[K') // clear spinner line
  }
}

rl.on('line', async (input) => {
  const text = input.trim()
  if (!text) { rl.prompt(); return }

  messages.push({ role: 'user', content: text })

  const stop = spin()

  // Step 0: echo back. Chapter 1 replaces these two lines with a real LLM call.
  await new Promise((r) => setTimeout(r, 600))
  const reply = `You said: "${text}" (history: ${messages.length} message${messages.length === 1 ? '' : 's'})`

  stop()

  messages.push({ role: 'assistant', content: reply })
  console.log(`${GREEN}Agent:${RESET} ${reply}\n`)

  rl.prompt()
})

rl.on('close', () => process.exit(0))

rl.prompt()
```

## Run

```bash
npm run chat
# or: npx tsx chat.ts
```

## What the student sees

```
You: hello

Agent: You said: "hello" (history: 1 message)

You: how are you

Agent: You said: "how are you" (history: 2 messages)

You:
```

The spinner animates during the 600ms fake delay. Kill with `Ctrl+C`.

## What to tell the student

- `readline` is the ear — it reads from stdin and calls the handler on each line
- `process.stdout` + ANSI codes is the mouth — colored output
- `messages` is the conversation state — Chapter 1 will pass this to the LLM
- The spinner uses `\r` to overwrite the current line — no extra library needed
- Chapter 1 replaces the two echo lines with `llm.chat.completions.create(...)`

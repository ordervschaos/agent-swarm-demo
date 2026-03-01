---
name: chapter-1a-cortex
description: Build Chapter 1a of the agent tutorial — the raw cortex. Use when the student says "build chapter 1a", "build the raw cortex", "connect the LLM", or wants to replace the echo stub with a real LLM call. Requires Step 0 shell to already exist, or build it first.
---

# Chapter 1a: The Raw Cortex

Replace the echo stub with a real LLM call. The shell already exists (Step 0). Now wire in the brain.

The cortex is a pure text generator — tokens in, tokens out. It can reason about anything. But it can't DO anything — it can only describe what it would do. That limitation is the setup for Chapter 1b.

## Prerequisites

- `chat.ts` exists (Step 0 shell)
- Need an API key. Default: Google Gemini (free tier, no credit card). See setup below.

## Setup: provider + API key

**Create `llm.ts`:**

```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })
import OpenAI from 'openai'

// --- Pick your provider. Swap these two lines. ---

// Google Gemini (free tier — 1M tokens/min, no credit card)
export const llm = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})
export const MODEL = 'gemini-2.5-flash'

// // MiniMax (free quota, top tool-use benchmarks)
// export const llm = new OpenAI({ apiKey: process.env.MINIMAX_API_KEY, baseURL: 'https://api.minimax.chat/v1' })
// export const MODEL = 'MiniMax-M2.1'

// // Groq (free, 14,400 req/day, fastest inference)
// export const llm = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
// export const MODEL = 'llama-3.3-70b-versatile'

// // OpenRouter (50 req/day free, access to many models)
// export const llm = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })
// export const MODEL = 'google/gemini-2.5-flash'
```

**Create `.env.local`** (if it doesn't exist):
```
GEMINI_API_KEY=your_key_here
```

Tell the student: get a free Gemini key at https://aistudio.google.com/apikey

**Update `package.json`** — add the `openai` and `dotenv` dependencies and update scripts:

```json
{
  "name": "tutorial",
  "private": true,
  "type": "module",
  "scripts": {
    "chat": "node --no-deprecation --import tsx/esm chat.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.0",
    "openai": "^4.80.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0"
  }
}
```

Run `npm install`.

## Modify `chat.ts` — replace the echo stub

Find these two lines in the `rl.on('line', ...)` handler:

```typescript
  // Step 0: echo back. Chapter 1 replaces these two lines with a real LLM call.
  await new Promise((r) => setTimeout(r, 600))
  const reply = `You said: "${text}" (history: ${messages.length} message${messages.length === 1 ? '' : 's'})`
```

Replace them with:

```typescript
  const response = await llm.chat.completions.create({
    model: MODEL,
    messages,
  })
  const reply = response.choices[0].message.content ?? ''
  messages.push({ role: 'assistant', content: reply })
```

Also add these imports at the top of `chat.ts`:

```typescript
import { llm, MODEL } from './llm.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'
```

And change the `messages` array type:

```typescript
const messages: ChatCompletionMessageParam[] = []
```

Remove the `assistant` push in the handler body (it's now in the LLM block above) and the manual `messages.push({ role: 'assistant'... })` line that was there before.

## Full updated handler body (for clarity)

```typescript
rl.on('line', async (input) => {
  const text = input.trim()
  if (!text) { rl.prompt(); return }

  messages.push({ role: 'user', content: text })

  const stop = spin()

  const response = await llm.chat.completions.create({
    model: MODEL,
    messages,
  })
  const reply = response.choices[0].message.content ?? ''
  messages.push({ role: 'assistant', content: reply })

  stop()

  console.log(`${GREEN}Agent:${RESET} ${reply}\n`)

  rl.prompt()
})
```

## Run

```bash
npm run chat
```

## What the student sees

Real LLM responses. Multi-turn — the full `messages` array is sent each time, so the agent remembers the conversation. But it can't DO anything — ask it to "list the files in this directory" and it will describe how it *would* do it, not actually do it.

## What to tell the student

- The LLM sees the full `messages` array every call — that's why it remembers the conversation
- It can reason about anything but can only produce text — it can't act
- "I would run `ls` to check the directory" — but it can't run `ls`
- The cortex needs hands. That's Chapter 1b.

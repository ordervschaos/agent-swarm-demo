---
name: chapter-1b-tools
description: Build Chapter 1b of the agent tutorial — the action interface. Use when the student says "build chapter 1b", "add tools", "add function calling", or wants to give the cortex the ability to act. Requires Chapter 1a (real LLM in chat.ts) to already exist.
---

# Chapter 1b: The Action Interface

Give the cortex the ability to act. Define a tool as a JSON schema. The LLM returns a `tool_calls` array. The student parses those calls, executes the tools, feeds results back.

This is the LLM's **motor cortex** — translating fuzzy intent into structured tool calls. Looking is an action. What differs from write actions is the *consequence* — read actions are safe and idempotent. We use `list_files` here; it observes without changing anything.

**Key limitation of 1b:** The LLM makes one tool call, sees the result once, then stops. It never chains. That's Chapter 1c.

## Prerequisites

- `chat.ts` with real LLM (Chapter 1a)
- `llm.ts` with provider config

## What changes

`chat.ts` gets a `tools` array and tool_calls handling added to the LLM call in the line handler.

## Changes to `chat.ts`

Add import at the top:

```typescript
import { readdirSync } from 'fs'
```

Add the tool definition (before the `rl` setup):

```typescript
const tools = [{
  type: 'function' as const,
  function: {
    name: 'list_files',
    description: 'List files in a directory',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path (defaults to ".")' },
      },
    },
  },
}]
```

Replace the LLM call in the `rl.on('line', ...)` handler:

**Before (Chapter 1a):**
```typescript
  const response = await llm.chat.completions.create({
    model: MODEL,
    messages,
  })
  const reply = response.choices[0].message.content ?? ''
  messages.push({ role: 'assistant', content: reply })
```

**After (Chapter 1b):**
```typescript
  const response = await llm.chat.completions.create({
    model: MODEL,
    tools,
    messages,
  })
  const message = response.choices[0].message

  let reply: string

  if (message.tool_calls && message.tool_calls.length > 0) {
    // The LLM requested a tool — execute it and show the result
    const call = message.tool_calls[0]
    const args = JSON.parse(call.function.arguments)
    const result = readdirSync(args.path || '.').join('\n') || '(empty)'
    console.log(`${DIM}[tool] list_files(${JSON.stringify(args)})${RESET}`)
    reply = result
  } else {
    reply = message.content ?? ''
  }
  messages.push({ role: 'assistant', content: reply })
```

## Run

```bash
npm run chat
```

## What the student sees

```
You: what files are in this directory?

[tool] list_files({})
Agent: chat.ts
llm.ts
package.json
...

You: what would happen if I deleted package.json?

Agent: Deleting package.json would remove the project's dependency manifest...

You:
```

The agent now *uses* the tool — it doesn't just describe using it.

## What to tell the student

- `tools` is the list of capabilities you're giving the cortex — JSON schemas, not code
- `tool_calls` is the cortex's structured request: "I want to call this function with these arguments"
- **You** parse the call and execute it — the LLM can't run code; it only generates the request
- This is one-shot: the LLM calls a tool, you show the result, done. It never sees the result of its own action in context. That's Chapter 1c.
- The quality of tool calls varies between models — this is why benchmarks compare tool use. It's not a plugin; it's the cortex's ability to translate fuzzy intent into precise structured calls.

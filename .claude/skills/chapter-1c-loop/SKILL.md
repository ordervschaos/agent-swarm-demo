---
name: chapter-1c-loop
description: Build Chapter 1c of the agent tutorial — the task-local executive (agent loop). Use when the student says "build chapter 1c", "add the agent loop", "make it chain tool calls", or wants the LLM to reason-act-observe repeatedly until done. Requires Chapter 1b (tools in chat.ts) to already exist.
---

# Chapter 1c: The Task-Local Executive

Add the agent loop. The cortex can reason (1a) and act (1b), but it does each once and stops. The task-local executive is the `while` loop: keep calling the LLM until it stops requesting tools.

**The LLM decides** "I need another action" or "I'm done." **The student** builds the loop that respects that decision.

This is the moment the LLM becomes an agent.

## Prerequisites

- `chat.ts` with tools (Chapter 1b)
- `llm.ts` with provider config

## What changes

The LLM call block in `chat.ts` gains a `while(true)` loop. Tool results are fed back as `tool` messages so the LLM can chain calls.

## Changes to `chat.ts`

Replace the entire LLM block in the `rl.on('line', ...)` handler:

**Before (Chapter 1b):**
```typescript
  const response = await llm.chat.completions.create({
    model: MODEL,
    tools,
    messages,
  })
  const message = response.choices[0].message

  let reply: string

  if (message.tool_calls && message.tool_calls.length > 0) {
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

**After (Chapter 1c — the agent loop):**
```typescript
  const MAX_ITERATIONS = 10
  let iterations = 0
  let reply = ''

  while (true) {
    const response = await llm.chat.completions.create({ model: MODEL, tools, messages })
    const message = response.choices[0].message

    if (!message.tool_calls || message.tool_calls.length === 0) {
      reply = message.content ?? ''
      messages.push({ role: 'assistant', content: reply })
      break  // LLM said "I'm done"
    }

    if (++iterations > MAX_ITERATIONS) {
      reply = '[max iterations reached]'
      break  // YOU said "enough"
    }

    messages.push(message)  // assistant message with tool_calls

    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments)
      const result = readdirSync(args.path || '.').join('\n') || '(empty)'
      console.log(`${DIM}[${iterations}] list_files(${JSON.stringify(args)}) → ${result.split('\n').length} files${RESET}`)
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }
```

Also update the spinner stop + output section (after the loop):

```typescript
  stop()

  if (iterations > 0) {
    console.log(`${DIM}[${iterations} tool call${iterations === 1 ? '' : 's'}]${RESET}`)
  }
  console.log(`${GREEN}Agent:${RESET} ${reply}\n`)
```

## Run

```bash
npm run chat
```

## What the student sees

```
You: list every directory here and show me what's inside each one

[1] list_files({}) → 5 files
[2] list_files({"path":"sandbox"}) → 3 files
[3] list_files({"path":"memory"}) → 1 files
[3 tool calls]
Agent: Here's what I found:
  - sandbox/: sample.md, output.txt, notes.txt
  - memory/: notes.md
  ...

You:
```

The agent chains tool calls — reason, act, observe, reason, act, observe — until it decides it's done.

## What to tell the student

- The loop runs until the LLM returns a message with **no tool_calls** — it decided it's done
- The `MAX_ITERATIONS` cap is yours — a safety net if the LLM loops infinitely
- Each tool result is pushed as a `{ role: 'tool' }` message — the LLM sees its own output in the next iteration
- The **task-local executive** (this loop) and the **reasoning** are the same model. The LLM doesn't have a separate module for "should I keep going?" — it's the same forward pass.
- Agent SDKs (Claude Agent SDK, OpenAI Agents SDK) give you this loop for free. You just built what's inside that black box.
- This is the architecture: an LLM plus a loop. Everything after this makes the agent *better*. The loop is what makes it an *agent*.

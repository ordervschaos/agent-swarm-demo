---
name: chapter-2-body
description: Build Chapter 2 of the agent tutorial — The Body (write actions + sandbox). Use when the student says "build chapter 2", "add write tools", "give the agent hands", or wants the agent to create files and run commands. Requires Chapter 1c (agent loop in chat.ts) to already exist.
---

# Chapter 2: The Body — Hands

Give the cortex hands: tools that **change** the world, not just observe it.

The key distinction: read actions (Chapter 1b) are safe and idempotent — call them a thousand times, nothing changes. Write actions are irreversible — once you write that file or run that command, it's done. This is where sandboxing matters.

The sandbox is a directory (`./sandbox/`) that acts as the agent's workspace. All file paths are resolved relative to it, and a path-safety check prevents escaping it (`../../../etc/passwd`).

## Prerequisites

- `chat.ts` with agent loop (Chapter 1c)
- `llm.ts` with provider config

## What to build

**Create `tools.ts`** — all tool definitions + execution in one place.
**Update `chat.ts`** — import from `tools.ts` instead of inline `readdirSync`.

## Create `tools.ts`

```typescript
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, relative } from 'path'

const SANDBOX = resolve('sandbox')

/** Resolve a path and verify it's inside the sandbox. Throws if not. */
function safePath(input: string): string {
  const resolved = resolve(SANDBOX, input)
  if (!resolved.startsWith(SANDBOX)) {
    throw new Error(`Path escapes sandbox: ${input}`)
  }
  return resolved
}

// Ensure sandbox exists on import
if (!existsSync(SANDBOX)) mkdirSync(SANDBOX, { recursive: true })

export const listFilesTool = {
  type: 'function' as const,
  function: {
    name: 'list_files',
    description: 'List files in a directory inside the sandbox',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path relative to sandbox (defaults to ".")' },
      },
    },
  },
}

export const readFileTool = {
  type: 'function' as const,
  function: {
    name: 'read_file',
    description: 'Read the contents of a file inside the sandbox',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to sandbox' },
      },
      required: ['path'],
    },
  },
}

export const writeFileTool = {
  type: 'function' as const,
  function: {
    name: 'write_file',
    description: 'Write content to a file inside the sandbox. Creates parent directories if needed.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to sandbox' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
}

export function executeTool(name: string, args: Record<string, string>): string {
  try {
    if (name === 'list_files') {
      const dir = safePath(args.path || '.')
      return readdirSync(dir).join('\n') || '(empty directory)'
    }
    if (name === 'read_file') {
      return readFileSync(safePath(args.path), 'utf-8')
    }
    if (name === 'write_file') {
      const filePath = safePath(args.path)
      const parent = resolve(filePath, '..')
      if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
      writeFileSync(filePath, args.content)
      return `Wrote ${args.content.length} bytes to ${args.path}`
    }
    return `Unknown tool: ${name}`
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}
```

## Update `chat.ts`

Remove the inline `import { readdirSync } from 'fs'` and the inline `tools` array.

Add at the top:
```typescript
import { listFilesTool, readFileTool, writeFileTool, executeTool } from './tools.js'
```

Replace the inline `tools` const with:
```typescript
const tools = [listFilesTool, readFileTool, writeFileTool]
```

In the agent loop, replace the inline tool execution:

**Before:**
```typescript
      const args = JSON.parse(call.function.arguments)
      const result = readdirSync(args.path || '.').join('\n') || '(empty)'
      console.log(`${DIM}[${iterations}] list_files(${JSON.stringify(args)}) → ${result.split('\n').length} files${RESET}`)
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
```

**After:**
```typescript
      const args = JSON.parse(call.function.arguments)
      const result = executeTool(call.function.name, args)
      console.log(`${DIM}[${iterations}] ${call.function.name}(${JSON.stringify(args)})${RESET}`)
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
```

## Run

```bash
npm run chat
```

## What the student sees

```
You: write a haiku to sandbox/poem.txt

[1] write_file({"path":"poem.txt","content":"..."})
Agent: Done. I wrote a haiku to sandbox/poem.txt.

You: read it back

[1] read_file({"path":"poem.txt"})
Agent: Here's the haiku:
  Silent keys at rest...

You: list everything in the sandbox

[1] list_files({})
Agent: poem.txt

You:
```

The agent can now create and read files. `sandbox/poem.txt` exists on disk after the first message.

## What to tell the student

- `safePath()` is the guard — it resolves the path and checks it starts with `SANDBOX`. This prevents `../../etc/passwd` escapes.
- Read actions (list, read) are safe to call repeatedly. Write actions (write_file) change the world — once done, it's done.
- The sandbox is a directory, not a permission system. The agent can't escape it because the paths outside it are never passed to `fs` functions.
- In NanoClaw, the Docker container is the sandbox — the agent writes freely inside the container, and the container filesystem is discarded when it exits (or persisted via mounts for the files that should survive).
- `executeTool()` is the dispatch layer — it maps LLM-generated function names to real code. This is the bridge between the LLM's structured output and your filesystem.

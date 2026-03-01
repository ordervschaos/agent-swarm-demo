---
name: chapter-3-memory
description: Build Chapter 3 of the agent tutorial — Memory (semantic + episodic). Use when the student says "build chapter 3", "add memory", "make the agent remember", or wants the agent to persist identity and learned facts across sessions. Requires Chapter 2 (tools.ts, agent loop in chat.ts) to already exist.
---

# Chapter 3: Memory — The Agent Remembers

The agent from Chapters 1-2 is amnesiac — every run starts blank. Now give it two kinds of memory:

- **Semantic memory** (`identity.md`) — who the agent is. Human-curated. Loaded every run. Burns context, so every byte earns its place.
- **Episodic memory** (`memory/notes.md`) — what the agent has learned. Agent-curated. Written by the agent, loaded if it exists.

Memory is **external to the LLM**. It lives in files on disk, loaded into the context window at startup. The cortex doesn't persist anything — it's the files that persist.

## Prerequisites

- `chat.ts` with agent loop and tools (Chapters 1-3)
- `tools.ts` with sandbox tools
- `llm.ts` with provider config

## Part A: Semantic Memory (Identity)

### Create `identity.md`

```markdown
# Identity

You are **Atlas**, a calm and precise assistant.

## Personality
- You speak clearly and directly, without filler words.
- You prefer concrete answers over vague ones.
- When unsure, you say so — you never bluff.

## Rules
- Always greet users by saying your name first.
- When creating files, add a comment at the top with the date.
- Keep responses under 3 sentences unless the user asks for detail.
```

Tell the student: this file defines who the agent is. Edit it to change the name, personality, and rules. The cortex doesn't change — only the identity does.

### Add memory tools to `tools.ts`

Add these imports at the top of `tools.ts`:
```typescript
import { appendFileSync } from 'fs'
```

Add the memory directory constant after `SANDBOX`:
```typescript
const MEMORY_DIR = resolve('memory')
const NOTES_FILE = resolve(MEMORY_DIR, 'notes.md')
```

Add these tool definitions:
```typescript
export const saveNoteTool = {
  type: 'function' as const,
  function: {
    name: 'save_note',
    description: 'Save a note to persistent memory. Use this when the user tells you something worth remembering for future sessions.',
    parameters: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'The note to save' },
      },
      required: ['content'],
    },
  },
}

export const readNotesTool = {
  type: 'function' as const,
  function: {
    name: 'read_notes',
    description: 'Read all saved notes from persistent memory.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  },
}
```

Add these cases to `executeTool()`:
```typescript
    if (name === 'save_note') {
      if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true })
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const line = `- [${timestamp}] ${args.content}\n`
      appendFileSync(NOTES_FILE, line)
      return `Saved note to memory.`
    }
    if (name === 'read_notes') {
      if (!existsSync(NOTES_FILE)) return 'No notes yet.'
      return readFileSync(NOTES_FILE, 'utf-8') || 'No notes yet.'
    }
```

Add this helper function (used by `chat.ts` to load notes at startup):
```typescript
/** Load notes from memory file, or return null if none exist. */
export function loadNotes(): string | null {
  if (!existsSync(NOTES_FILE)) return null
  const content = readFileSync(NOTES_FILE, 'utf-8').trim()
  return content || null
}
```

## Part B: Update `chat.ts` — load memory at startup

Add these imports at the top:
```typescript
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { listFilesTool, readFileTool, writeFileTool, saveNoteTool, readNotesTool, executeTool, loadNotes } from './tools.js'
```

Replace the `tools` array:
```typescript
const tools = [listFilesTool, readFileTool, writeFileTool, saveNoteTool, readNotesTool]
```

Add memory loading before the `messages` array declaration:
```typescript
const identity = readFileSync(resolve('identity.md'), 'utf-8')
const notes = loadNotes()

let systemPrompt = `${identity}

---

You are a helpful agent. Use your tools to accomplish tasks. All file paths are relative to the sandbox directory. When you have the final answer, respond with text (no tool call).

When the user tells you something worth remembering for future sessions (their name, preferences, facts about them), use the save_note tool to record it. Be selective — only save things that would be useful to know next time.`

if (notes) {
  systemPrompt += `\n\n---\n\nYour notes from previous sessions:\n${notes}`
}
```

Change the `messages` initialization to include the system prompt:
```typescript
const messages: ChatCompletionMessageParam[] = [
  { role: 'system', content: systemPrompt },
]
```

Add a startup log line before `rl.prompt()`:
```typescript
const noteCount = notes ? notes.trim().split('\n').length : 0
console.log(`${DIM}[memory] identity loaded (${identity.length} bytes)${noteCount ? `, ${noteCount} note(s)` : ', no notes'}${RESET}\n`)
```

## Run

```bash
npm run chat
```

## What the student sees

**First session:**
```
[memory] identity loaded (414 bytes), no notes

You: what's your name?
Agent: I'm Atlas, a calm and precise assistant. How can I help you?

You: my name is Jordan and I prefer code over prose. remember this.
[1 tool call]
Agent: Noted, Jordan. I'll keep your preference for code in mind.

You:
```

**Second session:**
```
[memory] identity loaded (414 bytes), 2 note(s)

You: do you know my name?
Agent: Yes — you're Jordan, and you prefer code over prose.

You:
```

The agent remembers across sessions without being told again.

## What to tell the student

- **Semantic memory** (`identity.md`) is human-curated — you wrote it, the agent reads it. Stable, reliable, doesn't drift.
- **Episodic memory** (`memory/notes.md`) is agent-curated — the agent decides what to save. Grows over time, can accumulate noise. Human-readable: open the file, fix a wrong fact, it takes effect immediately.
- The distinction matters: human-curated memory is reliable but doesn't scale; agent-curated memory scales but can drift.
- **Working memory** is the `messages` array in the current session — lost when the process exits.
- **Workspace ≠ memory**: `sandbox/` is the task workspace. `memory/` persists across runs. Same filesystem, different purposes.
- In NanoClaw: `groups/{name}/CLAUDE.md` is semantic memory. Agent auto-memory is episodic. The container filesystem is the workspace.
- Edit `identity.md`, change the name to "Nova" and the personality to "enthusiastic". Run again. Different agent. The cortex didn't change — the identity did.

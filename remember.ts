/**
 * Learned Facts — Episodic Memory
 *
 * The agent loads identity.md (semantic memory) AND memory/notes.md (episodic memory)
 * at startup. It also has save_note and read_notes tools to write new memories.
 *
 * The lesson: episodic memory = persistent storage the agent reads AND writes.
 * Agent-curated (not human-curated like identity). This is auto-memory in NanoClaw.
 *
 * Run: npm run remember "My name is Alex and my timezone is PST. Remember this for next time."
 * Then: npm run remember "What's my name?"
 * Check: cat memory/notes.md
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { llm, MODEL } from './llm.js'
import {
  listFilesTool, readFileTool, writeFileTool,
  saveNoteTool, readNotesTool,
  executeTool, loadNotes,
} from './tools.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

// --- Load identity (semantic memory) ---

const identityPath = resolve('identity.md')
const identity = readFileSync(identityPath, 'utf-8')

console.log(`[memory] Loaded identity from identity.md (${identity.length} bytes)`)

// --- Load episodic memory ---

const notes = loadNotes()
if (notes) {
  console.log(`[memory] Loaded ${notes.split('\n').length} note(s) from memory/notes.md`)
} else {
  console.log(`[memory] No previous notes found — starting fresh.`)
}

console.log()

// --- Agent loop ---

const tools = [listFilesTool, readFileTool, writeFileTool, saveNoteTool, readNotesTool]
const MAX_ITERATIONS = 15
const prompt = process.argv[2] || 'My name is Alex and my timezone is PST. Remember this for next time.'

let systemPrompt = `${identity}

---

You are a helpful agent. Use your tools to accomplish tasks. All file paths are relative to the sandbox directory. When you have the final answer, respond with text (no tool call).

When the user tells you something worth remembering for future sessions (their name, preferences, facts about them), use the save_note tool to record it. Be selective — only save things that would be useful to know next time.`

if (notes) {
  systemPrompt += `

---

Your notes from previous sessions:
${notes}`
}

const messages: ChatCompletionMessageParam[] = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: prompt },
]

console.log(`You: ${prompt}\n`)

let iterations = 0

while (true) {
  const response = await llm.chat.completions.create({
    model: MODEL,
    tools,
    messages,
  })

  const message = response.choices[0].message

  if (!message.tool_calls || message.tool_calls.length === 0) {
    console.log(`Agent: ${message.content}`)
    break
  }

  if (++iterations > MAX_ITERATIONS) {
    console.log(`[loop] Hit max iterations (${MAX_ITERATIONS}). Stopping.`)
    break
  }

  messages.push(message)

  for (const call of message.tool_calls) {
    const args = JSON.parse(call.function.arguments)
    console.log(`[${iterations}] ${call.function.name}(${JSON.stringify(args)})`)

    const result = executeTool(call.function.name, args)
    console.log(`    → ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}\n`)

    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: result,
    })
  }
}

console.log(`\n--- Done in ${iterations} iteration(s) ---`)

/**
 * Identity — Semantic Memory
 *
 * The agent loads identity.md at startup and injects it into the system prompt.
 * Same agent loop from Chapter 2, same sandbox tools. No memory tools needed —
 * identity is pre-loaded, not tool-accessed.
 *
 * The lesson: semantic memory = content loaded into the system prompt from a file.
 * Human-curated, burns context every run. This is CLAUDE.md in NanoClaw.
 *
 * Run: npm run identity
 * Try: npm run identity "Who are you?"
 * Try: Edit identity.md (change the name/personality), then run again.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { llm, MODEL } from './llm.js'
import { listFilesTool, readFileTool, writeFileTool, executeTool } from './tools.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

// --- Load identity (semantic memory) ---

const identityPath = resolve('identity.md')
const identity = readFileSync(identityPath, 'utf-8')

console.log(`[memory] Loaded identity from identity.md (${identity.length} bytes)\n`)

// --- Agent loop ---

const tools = [listFilesTool, readFileTool, writeFileTool]
const MAX_ITERATIONS = 15
const prompt = process.argv[2] || 'Introduce yourself and tell me what you can do.'

const systemPrompt = `${identity}

---

You are a helpful agent. Use your tools to accomplish tasks. All file paths are relative to the sandbox directory. When you have the final answer, respond with text (no tool call).`

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

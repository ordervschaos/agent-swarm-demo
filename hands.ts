/**
 * Hands — The Agent Changes the World
 *
 * Chapter 1 gave the agent senses (read tools). Now it gets hands (write tools).
 * Same agent loop from Chapter 1, but the tools array now includes write_file.
 *
 * The containment: all file operations are sandboxed to ./sandbox/.
 * The tools array is the permission model — no bash tool means no escape.
 *
 * Run: npm run hands
 * Try: npm run hands "Create a file called hello.txt with a greeting, then read it back"
 * Try: npm run hands "Create a mini website with index.html and style.css"
 */

import { llm, MODEL } from './llm.js'
import { listFilesTool, readFileTool, writeFileTool, executeTool } from './tools.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

const tools = [listFilesTool, readFileTool, writeFileTool]

// --- The agent loop (same as Chapter 1, new tools) ---

const MAX_ITERATIONS = 15
const prompt = process.argv[2] || 'Create a file called hello.txt with a friendly greeting, then read it back to verify it worked.'

const messages: ChatCompletionMessageParam[] = [
  { role: 'system', content: 'You are a helpful agent. Use your tools to accomplish the task. All file paths are relative to the sandbox directory. When you have the final answer, respond with text (no tool call).' },
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

  // No tool calls → the LLM decided it's done. Print and exit.
  if (!message.tool_calls || message.tool_calls.length === 0) {
    console.log(`Agent: ${message.content}`)
    break
  }

  // Safety: cap iterations so a confused LLM can't loop forever.
  if (++iterations > MAX_ITERATIONS) {
    console.log(`[loop] Hit max iterations (${MAX_ITERATIONS}). Stopping.`)
    break
  }

  // The LLM wants more tools. Add its message to history, execute each tool,
  // feed results back, and loop.
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
console.log(`Check ./sandbox/ to see the files the agent created.`)

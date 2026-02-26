/**
 * The Task-Local Executive (The Agent Loop)
 *
 * The cortex can reason (raw-cortex) and act (action-interface), but it does
 * each once and stops. The task-local executive is the loop: keep calling the
 * LLM until IT decides to stop requesting tools. The LLM decides "I need
 * another action" or "I'm done." YOU build the loop that respects that decision.
 *
 * This is the moment the LLM becomes an agent.
 *
 * Run: npm run agent-loop
 * Try: npm run agent-loop "What directories exist here? List the contents of each one."
 */

import { llm, MODEL } from './llm.js'
import { listFilesTool, executeTool } from './tools.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

const tools = [listFilesTool]

// --- The agent loop ---

const MAX_ITERATIONS = 10
const prompt = process.argv[2] || 'What directories exist here? List the contents of each one.'

const messages: ChatCompletionMessageParam[] = [
  { role: 'system', content: 'You are a helpful agent. Use your tools to accomplish the task. When you have the final answer, respond with text (no tool call).' },
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

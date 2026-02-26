/**
 * The Action Interface
 *
 * Give the cortex the ability to act. Define tools as JSON schemas. The LLM
 * returns structured tool calls. YOU parse them, execute them, feed results back.
 *
 * It can act — but only once. One tool call, then it stops.
 *
 * (We use a read-only tool here for safety. The interface is the same whether
 * the tool reads or writes — the LLM generates a structured call either way.)
 *
 * Run: npm run action-interface
 */

import { llm, MODEL } from './llm.js'
import { listFilesTool, executeTool } from './tools.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

const tools = [listFilesTool]

const prompt = process.argv[2] || 'What files are in the current directory?'

const messages: ChatCompletionMessageParam[] = [
  { role: 'user', content: prompt },
]

console.log(`You: ${prompt}\n`)

// Single LLM call — one shot
const response = await llm.chat.completions.create({
  model: MODEL,
  tools,
  messages,
})

const message = response.choices[0].message

if (message.tool_calls && message.tool_calls.length > 0) {
  // The LLM wants to use a tool. Let's execute it.
  for (const call of message.tool_calls) {
    const args = JSON.parse(call.function.arguments)
    console.log(`[tool] ${call.function.name}: ${JSON.stringify(args)}`)

    const result = executeTool(call.function.name, args)
    console.log(result)
  }
  // That's it. The cortex saw your question, generated a tool call, we ran it.
  // But we never fed the result BACK to the LLM. It acted, but it's blind
  // to the result. It can't chain: "ok, now look inside that subdirectory."
  console.log('\n--- End. The cortex acted once, but never saw the result. ---')
  console.log('--- It can\'t chain actions. For that, it needs the loop (agent-loop). ---')
} else {
  // No tool call — the LLM just answered directly
  console.log(`Agent: ${message.content}`)
}

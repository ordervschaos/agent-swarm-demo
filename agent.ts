/**
 * Agent — tool arrays, persona loading, system prompt, and the run loop.
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { llm, MODEL } from './llm.js'
import { listFilesTool, readFileTool, writeFileTool, executeAction } from './actions.js'
import { saveNoteTool, readNotesTool, executeMemoryTool } from './memory/memory.js'
import type { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/index'

export const MAX_ITERATIONS = 15
export const actionTools: ChatCompletionTool[] = [listFilesTool, readFileTool, writeFileTool]
export const memoryTools: ChatCompletionTool[] = [saveNoteTool, readNotesTool]
export const allTools: ChatCompletionTool[] = [...actionTools, ...memoryTools]

function executeTool(name: string, args: Record<string, string>): string {
  return executeAction(name, args) ?? executeMemoryTool(name, args) ?? `Unknown tool: ${name}`
}

/** Load persona.md from the given path (defaults to ./memory/persona.md). Returns '' if missing. */
export function loadPersona(path?: string): string {
  const p = path ?? resolve('memory/persona.md')
  return existsSync(p) ? readFileSync(p, 'utf-8') : ''
}

/** Build the system prompt. Always includes memory instruction; appends notes if present. */
export function buildSystemPrompt(identity: string, notes: string | null): string {
  let prompt = identity ? `${identity}\n\n---\n\n` : ''
  prompt += `You are a helpful agent. Use your tools to accomplish tasks. All file paths are relative to the sandbox directory. When you have the final answer, respond with text (no tool call).\n\nWhen the user tells you something worth remembering for future sessions, use save_note to record it.`
  if (notes) prompt += `\n\n---\n\nYour notes from previous sessions:\n${notes}`
  return prompt
}

/** Run the agent loop for a single task. Returns the final text response. */
export async function runAgent(
  prompt: string,
  systemPrompt: string,
  tools: ChatCompletionTool[],
  verbose = false
): Promise<string> {
  let iterations = 0

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ]

  while (true) {
    const response = await llm.chat.completions.create({ model: MODEL, tools, messages })
    const message = response.choices[0].message

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? ''
    }

    if (++iterations > MAX_ITERATIONS) {
      return `[max iterations reached]`
    }

    messages.push(message)

    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments)
      if (verbose) {
        console.log(`[${iterations}] ${call.function.name}(${JSON.stringify(args)})`)
      }
      const result = executeTool(call.function.name, args)
      if (verbose) {
        console.log(`    → ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}\n`)
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }
}

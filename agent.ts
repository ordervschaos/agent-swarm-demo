/**
 * Agent — the single object you instantiate to run an agent.
 *
 *   const agent = new Agent('atlas')
 *   const reply = await agent.run('Write a haiku')
 *
 * The constructor wires up config, persona, memory, tools, and system prompt.
 * The caller just calls .run(prompt).
 */

import { existsSync, readFileSync } from 'fs'
import { llm, MODEL } from './llm.js'
import { allTools, createToolExecutor, loadNotes } from './actions/index.js'
import { createDefaultConfig } from './agent-config.js'
import type { AgentConfig } from './agent-config.js'
import type { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/index'

const MAX_ITERATIONS = 15

/** Load a persona file. Returns '' if missing. */
function loadPersona(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

/** Build the system prompt from identity + notes. */
function buildSystemPrompt(identity: string, notes: string | null): string {
  let prompt = identity ? `${identity}\n\n---\n\n` : ''
  prompt += `You are a helpful agent. Use your tools to accomplish tasks. All file paths are relative to the sandbox directory. When you have the final answer, respond with text (no tool call).\n\nWhen the user tells you something worth remembering for future sessions, use save_note to record it.`
  if (notes) prompt += `\n\n---\n\nYour notes from previous sessions:\n${notes}`
  return prompt
}

export class Agent {
  readonly config: AgentConfig
  private systemPrompt: string
  private tools: ChatCompletionTool[]
  private executeTool: (name: string, args: Record<string, string>) => string
  verbose = false

  /**
   * Create an agent.
   * @param nameOrConfig — a string name (uses createDefaultConfig) or a full AgentConfig.
   */
  constructor(nameOrConfig: string | AgentConfig) {
    this.config = typeof nameOrConfig === 'string'
      ? createDefaultConfig(nameOrConfig)
      : nameOrConfig

    // Wire up identity + memory → system prompt
    const identity = loadPersona(this.config.persona)
    const notes = loadNotes(this.config.memoryDir)
    this.systemPrompt = buildSystemPrompt(identity, notes)

    // Wire up tools + executor
    this.tools = this.config.tools.length ? this.config.tools : allTools
    this.executeTool = createToolExecutor(this.config.sandboxDir, this.config.memoryDir)
  }

  /** Run the agent on a single prompt. Returns the final text response. */
  async run(prompt: string): Promise<string> {
    const maxIter = this.config.maxIterations || MAX_ITERATIONS
    const model = this.config.model || MODEL
    let iterations = 0

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt },
    ]

    const label = `[${this.config.name}]`

    while (true) {
      const response = await llm.chat.completions.create({
        model,
        tools: this.tools,
        messages,
      })
      const message = response.choices[0].message

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return message.content ?? ''
      }

      if (++iterations > maxIter) {
        return `[max iterations reached]`
      }

      messages.push(message)

      for (const call of message.tool_calls) {
        const args = JSON.parse(call.function.arguments)
        if (this.verbose) {
          console.log(`${label}[${iterations}] ${call.function.name}(${JSON.stringify(args)})`)
        }
        const result = this.executeTool(call.function.name, args)
        if (this.verbose) {
          console.log(`${label}    → ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}\n`)
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    }
  }
}

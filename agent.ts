/**
 * Agent — the perceive → think → act → observe loop.
 *
 *   const agent = new Agent('atlas')
 *   const reply = await agent.process('Write a haiku')
 *
 * The constructor assembles the organs (memory, hands).
 * The process() method is the life cycle.
 */

import { existsSync, readFileSync } from 'fs'
import { llm, MODEL } from './llm.js'
import { createToolExecutor, loadNotes } from './actions/index.js'
import { createDefaultConfig } from './agent-config.js'
import type { AgentConfig } from './agent-config.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

const MAX_ITERATIONS = 15

export class Agent {
  readonly config: AgentConfig
  private systemPrompt: string
  private performAction: (name: string, args: Record<string, string>) => string
  verbose = false

  constructor(nameOrConfig: string | AgentConfig) {
    this.config = typeof nameOrConfig === 'string'
      ? createDefaultConfig(nameOrConfig)
      : nameOrConfig

    this.systemPrompt = this.buildSystemPrompt()
    this.performAction = createToolExecutor(this.config.sandboxDir, this.config.memoryDir)
  }

  // ── The life cycle ──────────────────────────────────────────────

  async process(prompt: string): Promise<string> {
    const messages = this.perceive(prompt)
    const maxIter = this.config.maxIterations || MAX_ITERATIONS

    for (let iteration = 1; iteration <= maxIter; iteration++) {
      // Think: turn the message history into a response
      const thought = await this.think(messages)
      const message = thought.choices[0].message

      // If the agent responded with plain text, we're done
      const wantsToAct = message.tool_calls && message.tool_calls.length > 0
      if (!wantsToAct) return message.content ?? ''

      // Act: execute each tool call, observe the results
      messages.push(message)
      for (const call of message.tool_calls!) {
        const observation = this.act(call.function.name, call.function.arguments)
        messages.push({ role: 'tool', tool_call_id: call.id, content: observation })
      }
    }

    return '[max iterations reached]'
  }

  // ── Organs ──────────────────────────────────────────────────────

  /** Think: send everything the agent knows to the LLM, get back a response. */
  private async think(messages: ChatCompletionMessageParam[]) {
    return llm.chat.completions.create({
      model: this.config.model || MODEL,
      tools: this.config.tools,
      messages,
    })
  }

  /** Perceive: assemble the initial context the agent will see. */
  private perceive(prompt: string): ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt },
    ]
  }

  /** Act: execute a tool call and return what happened. */
  private act(name: string, rawArgs: string): string {
    const args = JSON.parse(rawArgs)
    if (this.verbose) this.log(`${name}(${JSON.stringify(args)})`)

    const result = this.performAction(name, args)
    if (this.verbose) this.log(`→ ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`)

    return result
  }

  // ── Assembly (constructor helpers) ──────────────────────────────

  /** Build the system prompt from persona file + saved notes. */
  private buildSystemPrompt(): string {
    const identity = this.loadPersona()
    const notes = loadNotes(this.config.memoryDir)

    let prompt = identity ? `${identity}\n\n---\n\n` : ''
    prompt += [
      'You are a helpful agent. Use your tools to accomplish tasks.',
      'All file paths are relative to the sandbox directory.',
      'When you have the final answer, respond with text (no tool call).',
      '',
      'When the user tells you something worth remembering for future sessions, use save_note to record it.',
    ].join('\n')
    if (notes) prompt += `\n\n---\n\nYour notes from previous sessions:\n${notes}`

    return prompt
  }

  private loadPersona(): string {
    const path = this.config.persona
    return existsSync(path) ? readFileSync(path, 'utf-8') : ''
  }

  private log(text: string) {
    console.log(`[${this.config.name}] ${text}`)
  }
}

/**
 * Agent — the perceive → think → act → observe loop.
 *
 *   const agent = new Agent('atlas')
 *   const reply = await agent.deliberate('Write a haiku')
 *
 * The constructor is the agent waking up: recalling identity and memories.
 * deliberate() is the cognitive cycle: think → act → observe → repeat → conclude.
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
  private awareness: string
  private performAction: (name: string, args: Record<string, string>) => string
  verbose = false

  constructor(nameOrConfig: string | AgentConfig) {
    this.config = typeof nameOrConfig === 'string'
      ? createDefaultConfig(nameOrConfig)
      : nameOrConfig

    // Waking up
    const identity = this.recallIdentity()
    const memories = this.recallMemories()
    this.awareness = this.formAwareness(identity, memories)

    this.performAction = createToolExecutor(this.config.sandboxDir, this.config.memoryDir)
  }

  // ── Deliberation ─────────────────────────────────────────────────

  async deliberate(prompt: string): Promise<string> {
    const messages = this.perceive(prompt)
    const maxCycles = this.config.maxIterations || MAX_ITERATIONS

    for (let cycle = 1; cycle <= maxCycles; cycle++) {
      const thought = await this.think(messages)
      const message = thought.choices[0].message

      // Has the agent reached a conclusion?
      const wantsToAct = message.tool_calls && message.tool_calls.length > 0
      if (!wantsToAct) return this.conclude(message.content, cycle)

      // Not yet — act, observe, and think again
      messages.push(message)
      for (const call of message.tool_calls!) {
        const observation = this.act(call.function.name, call.function.arguments)
        messages.push({ role: 'tool', tool_call_id: call.id, content: observation })
      }
    }

    return this.conclude(null, maxCycles)
  }

  /** The agent has reached a conclusion — or run out of deliberation cycles. */
  private conclude(content: string | null, cycles: number): string {
    if (this.verbose) this.log(`concluded after ${cycles} cycle(s)`)
    return content ?? '[deliberation limit reached]'
  }

  /** Perceive: take in new input from the outside world. */
  private perceive(prompt: string): ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: this.awareness },
      { role: 'user', content: prompt },
    ]
  }

  /** Think: reason about everything the agent knows so far. */
  private async think(messages: ChatCompletionMessageParam[]) {
    return llm.chat.completions.create({
      model: this.config.model || MODEL,
      tools: this.config.tools,
      messages,
    })
  }

  /** Act: do something and observe what happened. */
  private act(name: string, rawArgs: string): string {
    const args = JSON.parse(rawArgs)
    if (this.verbose) this.log(`${name}(${JSON.stringify(args)})`)

    const result = this.performAction(name, args)
    if (this.verbose) this.log(`→ ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`)

    return result
  }

  // ── Waking up ──────────────────────────────────────────────────

  /** Who am I? Load persona / identity file. */
  private recallIdentity(): string {
    const path = this.config.persona
    return existsSync(path) ? readFileSync(path, 'utf-8') : ''
  }

  /** What do I remember? Load notes from previous sessions. */
  private recallMemories(): string | null {
    return loadNotes(this.config.memoryDir)
  }

  /** Combine identity + memories into the context the agent thinks from. */
  private formAwareness(identity: string, memories: string | null): string {
    let awareness = identity ? `${identity}\n\n---\n\n` : ''
    awareness += [
      'You are a helpful agent. Use your tools to accomplish tasks.',
      'All file paths are relative to the sandbox directory.',
      'When you have the final answer, respond with text (no tool call).',
      '',
      'When the user tells you something worth remembering for future sessions, use save_note to record it.',
    ].join('\n')
    if (memories) awareness += `\n\n---\n\nYour notes from previous sessions:\n${memories}`

    return awareness
  }

  private log(text: string) {
    console.log(`[${this.config.name}] ${text}`)
  }
}

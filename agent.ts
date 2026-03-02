/**
 * Agent — the perceive -> think -> act -> observe loop.
 *
 *   const agent = new Agent('atlas')
 *   const reply = await agent.deliberate('Write a haiku')
 *
 * The constructor is the agent waking up: recalling identity and memories.
 * deliberate() is the cognitive cycle: think -> act -> observe -> repeat -> conclude.
 */

import { existsSync, readFileSync } from 'fs'
import { llm, MODEL } from './llm.js'
import { createToolExecutor, allTools, loadNotes } from './actions/index.js'
import { createDefaultConfig } from './agent-config.js'
import { discoverSkills } from './skills.js'
import type { AgentConfig } from './agent-config.js'
import type { ChatCompletionMessageParam } from 'openai/resources/index'

const MAX_ITERATIONS = 15

export type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; name: string; result: string }
  | { type: 'response'; text: string; cycles: number }

export class Agent {
  readonly config: AgentConfig
  private awareness: string
  private performAction: (name: string, args: Record<string, string>) => Promise<string>
  verbose = false
  onEvent?: (event: AgentEvent) => void

  constructor(name: string) {
    this.config = createDefaultConfig(name)

    // Leaders get delegation tools + the ability to spawn workers
    if (this.config.canDelegate) {
      this.config.tools = allTools({ canDelegate: true })
    }

    // Waking up
    const identity = this.recallIdentity()
    const memories = this.recallMemories()
    this.awareness = this.formAwareness(identity, memories)

    const agentFactory = this.config.canDelegate
      ? (n: string) => new Agent(n)
      : undefined

    this.performAction = createToolExecutor(
      this.config.sandboxDir,
      this.config.memoryDir,
      this.config.name,
      { agentFactory, agentMessagesDir: this.config.agentMessagesDir },
    )
  }

  // -- Deliberation -------------------------------------------------------

  async deliberate(prompt: string): Promise<string> {
    const messages = this.perceive(prompt)
    const maxCycles = this.config.maxIterations || MAX_ITERATIONS

    for (let cycle = 1; cycle <= maxCycles; cycle++) {
      const thought = await this.think(messages)
      const message = thought.choices[0].message

      // Has the agent reached a conclusion?
      const wantsToAct = message.tool_calls && message.tool_calls.length > 0
      if (!wantsToAct) return this.conclude(message.content, cycle)

      // The agent is still thinking — share its reasoning
      if (message.content) {
        this.log(`thinking: ${message.content}`)
        this.emit({ type: 'thinking', text: message.content })
      }

      // Carry out the intended actions
      messages.push(message)
      for (const call of message.tool_calls!) {
        const args = JSON.parse(call.function.arguments)
        this.log(`acting: ${call.function.name}`)
        this.emit({ type: 'tool_start', name: call.function.name, args })
        const observation = await this.act(call.function.name, call.function.arguments)
        this.emit({ type: 'tool_end', name: call.function.name, result: observation })
        messages.push({ role: 'tool', tool_call_id: call.id, content: observation })
      }
    }

    return this.conclude(null, maxCycles)
  }

  /** The agent has reached a conclusion — or run out of deliberation cycles. */
  private conclude(content: string | null, cycles: number): string {
    if (this.verbose) this.log(`concluded after ${cycles} cycle(s)`)
    const text = content ?? '[deliberation limit reached]'
    this.emit({ type: 'response', text, cycles })
    return text
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
  private async act(name: string, rawArgs: string): Promise<string> {
    const args = JSON.parse(rawArgs)
    this.log(`${name}(${JSON.stringify(args)})`)

    const result = await this.performAction(name, args)
    this.log(`-> ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`)

    return result
  }

  // -- Waking up ----------------------------------------------------------

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

    const delegationInstructions = this.config.canDelegate
      ? [
          '',
          'You are a leader agent. You can delegate tasks to worker agents using delegate_task.',
          'Use list_team to see available agents, then delegate subtasks to the most appropriate one.',
          'The worker will execute the task fully and return their result to you.',
          'Synthesize worker results into a final answer. Only do work yourself if delegation is unnecessary.',
          'Instruct workers to use send_message to share their output with other agents who need it.',
        ]
      : []

    awareness += [
      'You are a helpful agent. Use your tools to accomplish tasks.',
      'All file paths are relative to the sandbox directory.',
      'When you have the final answer, respond with text (no tool call).',
      '',
      'When the user tells you something worth remembering for future sessions, use save_note to record it.',
      '',
      'You can communicate with other agents using send_message, read_messages, and list_agents.',
      'Use list_agents to discover available agents, then send_message to reach them.',
      'Use read_messages to check for messages from other agents. Messages are consumed after reading.',
      '',
      'You have skills you can invoke with run_skill, or list with list_skills.',
      ...delegationInstructions,
    ].join('\n')

    // Skill catalog
    const skills = discoverSkills('skills')
    if (skills.length > 0) {
      awareness += '\n\nAvailable skills:\n'
      awareness += skills.map(s => `- ${s.name}: ${s.description || '(no description)'}`).join('\n')
    }

    if (memories) awareness += `\n\n---\n\nYour notes from previous sessions:\n${memories}`

    return awareness
  }

  private emit(event: AgentEvent) {
    this.onEvent?.(event)
  }

  private log(text: string) {
    if (!this.onEvent && this.verbose) console.log(`[${this.config.name}] ${text}`)
  }
}

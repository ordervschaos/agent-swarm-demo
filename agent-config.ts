/**
 * AgentConfig — The Genome
 *
 * Defines everything that makes one agent different from another:
 * name, identity, memory, sandbox, model, tools, iteration cap.
 *
 * Different configs → different organisms from the same cellular machinery.
 * This is the prerequisite for running multiple agents in parallel.
 */

import { existsSync, mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { allTools } from './actions/index.js'
import type { ChatCompletionTool } from 'openai/resources/index'

export interface AgentConfig {
  name: string              // agent identifier (for logs, container names)
  persona: string           // path to identity.md / persona.md
  memoryDir: string         // where notes.md lives
  sandboxDir: string        // isolated workspace
  inboxDir: string          // where incoming messages land
  model: string             // which LLM model ('' = use default from llm.ts)
  tools: ChatCompletionTool[] // capabilities
  maxIterations: number     // loop cap
  canDelegate: boolean      // can this agent delegate tasks to others?
  agentMessagesDir: string  // inter-agent messages (separate from daemon-watched inbox)
}

/**
 * Create a default config for an agent.
 * Creates the agent's directories under agents/{name}/ if they don't exist.
 * Merges overrides from agents/{name}/config.json if present.
 */
export function createDefaultConfig(name: string): AgentConfig {
  const agentRoot = resolve('agents', name)
  const memoryDir = resolve(agentRoot, 'memory')
  const sandboxDir = resolve(agentRoot, 'sandbox')
  const inboxDir = resolve(agentRoot, 'inbox')
  const persona = resolve(agentRoot, 'identity.md')
  const agentMessagesDir = resolve(agentRoot, 'agent-messages')

  for (const dir of [memoryDir, sandboxDir, inboxDir, agentMessagesDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  const config: AgentConfig = {
    name,
    persona,
    memoryDir,
    sandboxDir,
    inboxDir,
    model: '',
    tools: allTools(),
    maxIterations: 15,
    canDelegate: false,
    agentMessagesDir,
  }

  // Merge overrides from config.json if it exists
  const configPath = resolve(agentRoot, 'config.json')
  if (existsSync(configPath)) {
    const overrides = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (overrides.canDelegate !== undefined) config.canDelegate = overrides.canDelegate
    if (overrides.model) config.model = overrides.model
    if (overrides.maxIterations) config.maxIterations = overrides.maxIterations
  }

  return config
}

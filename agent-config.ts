/**
 * AgentConfig — The Genome
 *
 * Defines everything that makes one agent different from another:
 * name, identity, memory, sandbox, model, tools, iteration cap.
 *
 * Different configs → different organisms from the same cellular machinery.
 * This is the prerequisite for running multiple agents in parallel.
 */

import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { allTools } from './actions/index.js'
import type { ChatCompletionTool } from 'openai/resources/index'

export interface AgentConfig {
  name: string              // agent identifier (for logs, container names)
  persona: string           // path to identity.md / persona.md
  memoryDir: string         // where notes.md lives
  sandboxDir: string        // isolated workspace
  model: string             // which LLM model ('' = use default from llm.ts)
  tools: ChatCompletionTool[] // capabilities
  maxIterations: number     // loop cap
}

/**
 * Create a default config for an agent.
 * Creates the agent's directories under agents/{name}/ if they don't exist.
 */
export function createDefaultConfig(name: string): AgentConfig {
  const agentRoot = resolve('agents', name)
  const memoryDir = resolve(agentRoot, 'memory')
  const sandboxDir = resolve(agentRoot, 'sandbox')
  const persona = resolve(agentRoot, 'identity.md')

  for (const dir of [memoryDir, sandboxDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  return {
    name,
    persona,
    memoryDir,
    sandboxDir,
    model: '',
    tools: allTools,
    maxIterations: 15,
  }
}

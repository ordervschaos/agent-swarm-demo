/**
 * Actions registry — collects all tool definitions and creates a single executor.
 *
 * To add a new action category:
 *   1. Create actions/foo.ts with `tools` array and `createHandler()`
 *   2. Import it here and add to `actionModules`
 */

import { resolve } from 'path'
import * as files from './files.js'
import * as memory from './memory.js'
import * as messaging from './messaging.js'
import * as skills from './skills.js'
import * as delegation from './delegation.js'
import * as web from './web.js'
import * as jobs from './jobs.js'
import * as gmail from './gmail.js'
import type { ChatCompletionTool } from 'openai/resources/index'
import type { AgentFactory } from './delegation.js'

export { loadNotes } from './memory.js'

type SyncHandler = (name: string, args: Record<string, string>) => string | null
type AsyncHandler = (name: string, args: Record<string, string>) => Promise<string | null>

interface ActionModule {
  tools: ChatCompletionTool[]
  createHandler: (...args: any[]) => SyncHandler | AsyncHandler
}

const baseModules: ActionModule[] = [files, memory, messaging, skills, web, jobs, gmail]

/** All tool definitions, collected from every action module. */
export function allTools(options?: { canDelegate?: boolean }): ChatCompletionTool[] {
  const modules = options?.canDelegate ? [...baseModules, delegation] : baseModules
  return modules.flatMap(m => m.tools)
}

/** Create a single tool executor bound to the agent's directories. */
export function createToolExecutor(
  sandboxDir: string,
  memoryDir: string,
  agentName: string,
  options?: { skillsDir?: string; agentFactory?: AgentFactory; agentMessagesDir?: string },
): (name: string, args: Record<string, string>) => Promise<string> {
  const skillsDir = options?.skillsDir ?? 'skills'
  const agentMessagesDir = options?.agentMessagesDir ?? resolve('agents', agentName, 'agent-messages')

  const syncHandlers: SyncHandler[] = [
    files.createHandler(sandboxDir),
    memory.createHandler(memoryDir),
    messaging.createHandler(agentName, agentMessagesDir),
    skills.createHandler(skillsDir),
  ]

  const asyncHandlers: AsyncHandler[] = [
    web.createHandler(),
    jobs.createHandler(),
    gmail.createHandler(),
  ]

  // Delegation handler is async — only added for leaders
  if (options?.agentFactory) {
    asyncHandlers.push(delegation.createHandler(options.agentFactory))
  }

  return async (name, args) => {
    // Try async handlers first (web, delegation)
    for (const handler of asyncHandlers) {
      const result = await handler(name, args)
      if (result !== null) return result
    }

    // Try sync handlers
    for (const handler of syncHandlers) {
      const result = handler(name, args)
      if (result !== null) return result
    }
    return `Unknown tool: ${name}`
  }
}

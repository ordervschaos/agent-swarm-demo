/**
 * Actions registry — collects all tool definitions and creates a single executor.
 *
 * To add a new action category:
 *   1. Create actions/foo.ts with `tools` array and `createHandler()`
 *   2. Import it here and add to `actionModules`
 */

import * as files from './files.js'
import * as memory from './memory.js'
import * as messaging from './messaging.js'
import * as skills from './skills.js'
import * as delegation from './delegation.js'
import * as workspace from './workspace.js'
import type { ChatCompletionTool } from 'openai/resources/index'
import type { AgentFactory } from './delegation.js'

export { loadNotes } from './memory.js'

type SyncHandler = (name: string, args: Record<string, string>) => string | null
type AsyncHandler = (name: string, args: Record<string, string>) => Promise<string | null>

interface ActionModule {
  tools: ChatCompletionTool[]
  createHandler: (...args: any[]) => SyncHandler | AsyncHandler
}

const baseModules: ActionModule[] = [files, memory, messaging, skills, workspace]

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
  options?: { skillsDir?: string; agentFactory?: AgentFactory; workspaceDir?: string },
): (name: string, args: Record<string, string>) => Promise<string> {
  const skillsDir = options?.skillsDir ?? 'skills'

  const syncHandlers: SyncHandler[] = [
    files.createHandler(sandboxDir),
    memory.createHandler(memoryDir),
    messaging.createHandler(agentName),
    skills.createHandler(skillsDir),
    ...(options?.workspaceDir ? [workspace.createHandler(options.workspaceDir)] : []),
  ]

  // Delegation handler is async — only added for leaders
  const asyncHandler: AsyncHandler | null = options?.agentFactory
    ? delegation.createHandler(options.agentFactory)
    : null

  return async (name, args) => {
    // Try async delegation handler first (if present)
    if (asyncHandler) {
      const result = await asyncHandler(name, args)
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

/**
 * Actions registry — collects all tool definitions and creates a single executor.
 *
 * To add a new action category:
 *   1. Create actions/foo.ts with `tools` array and `createHandler()`
 *   2. Import it here and add to `actionModules`
 */

import * as files from './files.js'
import * as memory from './memory.js'
import type { ChatCompletionTool } from 'openai/resources/index'

export { loadNotes } from './memory.js'

type Handler = (name: string, args: Record<string, string>) => string | null

interface ActionModule {
  tools: ChatCompletionTool[]
  createHandler: (...args: any[]) => Handler
}

const actionModules: ActionModule[] = [files, memory]

/** All tool definitions, collected from every action module. */
export const allTools: ChatCompletionTool[] = actionModules.flatMap(m => m.tools)

/** Create a single tool executor bound to the agent's directories. */
export function createToolExecutor(
  sandboxDir: string,
  memoryDir: string,
): (name: string, args: Record<string, string>) => string {
  const handlers: Handler[] = [
    files.createHandler(sandboxDir),
    memory.createHandler(memoryDir),
  ]

  return (name, args) => {
    for (const handler of handlers) {
      const result = handler(name, args)
      if (result !== null) return result
    }
    return `Unknown tool: ${name}`
  }
}

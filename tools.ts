/**
 * Tool definitions and execution.
 *
 * Tools are JSON schemas that tell the LLM what structured actions it can request.
 * executeTool() is the dispatch — it receives the LLM's structured call and runs it.
 *
 * This tool is read-only — it can't modify anything.
 */

import { readdirSync } from 'fs'

export const listFilesTool = {
  type: 'function' as const,
  function: {
    name: 'list_files',
    description: 'List files in a directory',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path (defaults to ".")' }
      },
    },
  },
}

export function executeTool(name: string, args: Record<string, string>): string {
  try {
    if (name === 'list_files') return readdirSync(args.path || '.').join('\n')
    return `Unknown tool: ${name}`
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

/**
 * Actions — what the agent can do in the sandbox.
 *
 * Senses: list_files, read_file — perceive the state of the world.
 * Limbs:  write_file            — change the state of the world.
 *
 * All operations are confined to ./sandbox/ via safePath().
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, relative } from 'path'

const SANDBOX = resolve('sandbox')

/** Resolve a path and verify it's inside the sandbox. Throws if not. */
function safePath(input: string): string {
  const resolved = resolve(SANDBOX, input)
  const rel = relative(SANDBOX, resolved)
  if (rel.startsWith('..') || resolve(resolved) !== resolved && rel.startsWith('/')) {
    throw new Error(`Path escapes sandbox: ${input}`)
  }
  if (!resolved.startsWith(SANDBOX)) {
    throw new Error(`Path escapes sandbox: ${input}`)
  }
  return resolved
}

// Ensure sandbox exists on import
if (!existsSync(SANDBOX)) mkdirSync(SANDBOX, { recursive: true })

// --- Tool definitions ---

export const listFilesTool = {
  type: 'function' as const,
  function: {
    name: 'list_files',
    description: 'List files in a directory inside the sandbox',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path relative to sandbox (defaults to ".")' }
      },
    },
  },
}

export const readFileTool = {
  type: 'function' as const,
  function: {
    name: 'read_file',
    description: 'Read the contents of a file inside the sandbox',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to sandbox' }
      },
      required: ['path'],
    },
  },
}

export const writeFileTool = {
  type: 'function' as const,
  function: {
    name: 'write_file',
    description: 'Write content to a file inside the sandbox. Creates parent directories if needed.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to sandbox' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
}

// --- Execution ---

/** Execute a sandbox action. Returns null if the tool name is not recognized. */
export function executeAction(name: string, args: Record<string, string>): string | null {
  try {
    if (name === 'list_files') {
      const dir = safePath(args.path || '.')
      return readdirSync(dir).join('\n') || '(empty directory)'
    }
    if (name === 'read_file') {
      return readFileSync(safePath(args.path), 'utf-8')
    }
    if (name === 'write_file') {
      const filePath = safePath(args.path)
      const parent = resolve(filePath, '..')
      if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
      writeFileSync(filePath, args.content)
      return `Wrote ${args.content.length} bytes to ${args.path}`
    }
    return null
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

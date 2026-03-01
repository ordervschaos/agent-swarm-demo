/**
 * Actions — what the agent can do in the sandbox.
 *
 * Senses: list_files, read_file — perceive the state of the world.
 * Limbs:  write_file            — change the state of the world.
 *
 * createActionExecutor(sandboxDir) returns a bound executor for a specific sandbox.
 * The default executeAction() uses ./sandbox/ for backward compat.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, relative } from 'path'

/** Resolve a path and verify it's inside the sandbox. Throws if not. */
function safePath(sandbox: string, input: string): string {
  const resolved = resolve(sandbox, input)
  const rel = relative(sandbox, resolved)
  if (rel.startsWith('..') || resolve(resolved) !== resolved && rel.startsWith('/')) {
    throw new Error(`Path escapes sandbox: ${input}`)
  }
  if (!resolved.startsWith(sandbox)) {
    throw new Error(`Path escapes sandbox: ${input}`)
  }
  return resolved
}

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

/** Create a bound action executor for a specific sandbox directory. */
export function createActionExecutor(sandboxDir: string): (name: string, args: Record<string, string>) => string | null {
  if (!existsSync(sandboxDir)) mkdirSync(sandboxDir, { recursive: true })

  return (name: string, args: Record<string, string>): string | null => {
    try {
      if (name === 'list_files') {
        const dir = safePath(sandboxDir, args.path || '.')
        return readdirSync(dir).join('\n') || '(empty directory)'
      }
      if (name === 'read_file') {
        return readFileSync(safePath(sandboxDir, args.path), 'utf-8')
      }
      if (name === 'write_file') {
        const filePath = safePath(sandboxDir, args.path)
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
}

/** Default executor using ./sandbox/ — backward compat for existing entry points. */
const defaultSandbox = resolve('sandbox')
if (!existsSync(defaultSandbox)) mkdirSync(defaultSandbox, { recursive: true })
const defaultExecutor = createActionExecutor(defaultSandbox)

/** Execute a sandbox action using the default ./sandbox/. Returns null if unrecognized. */
export function executeAction(name: string, args: Record<string, string>): string | null {
  return defaultExecutor(name, args)
}

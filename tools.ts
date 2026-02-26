/**
 * Tool definitions and execution — now with write actions.
 *
 * Chapter 1's tools were read-only (list_files). Now we add read_file and write_file.
 * All paths are sandboxed to ./sandbox/ — the agent cannot escape this directory.
 *
 * The tools array IS the permission model. No tool = no capability.
 * Path validation inside the tool = structural containment.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, relative } from 'path'

// --- Sandbox ---

const SANDBOX = resolve('sandbox')

/** Resolve a path and verify it's inside the sandbox. Throws if not. */
function safePath(input: string): string {
  const resolved = resolve(SANDBOX, input)
  const rel = relative(SANDBOX, resolved)
  if (rel.startsWith('..') || resolve(resolved) !== resolved && rel.startsWith('/')) {
    throw new Error(`Path escapes sandbox: ${input}`)
  }
  // Double-check: resolved path must start with sandbox path
  if (!resolved.startsWith(SANDBOX)) {
    throw new Error(`Path escapes sandbox: ${input}`)
  }
  return resolved
}

// Ensure sandbox exists on import
if (!existsSync(SANDBOX)) mkdirSync(SANDBOX, { recursive: true })

// --- Tool definitions (JSON schemas for the LLM) ---

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

// --- Tool execution ---

export function executeTool(name: string, args: Record<string, string>): string {
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
      // Create parent directories if needed
      const parent = resolve(filePath, '..')
      if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
      writeFileSync(filePath, args.content)
      return `Wrote ${args.content.length} bytes to ${args.path}`
    }
    return `Unknown tool: ${name}`
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

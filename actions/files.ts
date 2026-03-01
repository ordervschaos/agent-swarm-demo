/**
 * File actions — perceive and modify the sandbox filesystem.
 *
 * list_files, read_file: senses
 * write_file: limb
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

export const tools = [
  {
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
  },
  {
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
  },
  {
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
  },
]

// --- Handler ---

export function createHandler(sandboxDir: string): (name: string, args: Record<string, string>) => string | null {
  if (!existsSync(sandboxDir)) mkdirSync(sandboxDir, { recursive: true })

  return (name, args) => {
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

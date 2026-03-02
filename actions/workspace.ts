/**
 * Workspace actions — shared filesystem accessible to all agents.
 *
 * Unlike the per-agent sandbox (actions/files.ts), the workspace is a common
 * directory where agents can collaborate by reading and writing shared files.
 *
 * workspace_list, workspace_read: senses
 * workspace_write: limb
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, relative } from 'path'

/** Resolve a path and verify it's inside the workspace. Throws if not. */
function safePath(workspace: string, input: string): string {
  const resolved = resolve(workspace, input)
  const rel = relative(workspace, resolved)
  if (rel.startsWith('..') || resolve(resolved) !== resolved && rel.startsWith('/')) {
    throw new Error(`Path escapes workspace: ${input}`)
  }
  if (!resolved.startsWith(workspace)) {
    throw new Error(`Path escapes workspace: ${input}`)
  }
  return resolved
}

// --- Tool definitions ---

export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'workspace_list',
      description: 'List files in the shared workspace directory (visible to all agents)',
      parameters: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Directory path relative to workspace (defaults to ".")' }
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'workspace_read',
      description: 'Read a file from the shared workspace (visible to all agents)',
      parameters: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' }
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'workspace_write',
      description: 'Write a file to the shared workspace (visible to all agents). Creates parent directories if needed.',
      parameters: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
]

// --- Handler ---

export function createHandler(workspaceDir: string): (name: string, args: Record<string, string>) => string | null {
  if (!existsSync(workspaceDir)) mkdirSync(workspaceDir, { recursive: true })

  return (name, args) => {
    try {
      if (name === 'workspace_list') {
        const dir = safePath(workspaceDir, args.path || '.')
        if (!existsSync(dir)) return '(directory does not exist)'
        return readdirSync(dir).join('\n') || '(empty directory)'
      }
      if (name === 'workspace_read') {
        return readFileSync(safePath(workspaceDir, args.path), 'utf-8')
      }
      if (name === 'workspace_write') {
        const filePath = safePath(workspaceDir, args.path)
        const parent = resolve(filePath, '..')
        if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
        writeFileSync(filePath, args.content)
        return `Wrote ${args.content.length} bytes to workspace/${args.path}`
      }
      return null
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }
}

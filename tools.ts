/**
 * Tool definitions — sandbox tools from Chapter 2 + memory tools.
 *
 * Sandbox tools (list_files, read_file, write_file) operate on ./sandbox/.
 * Memory tools (save_note, read_notes) operate on ./memory/.
 * Two separate directories: workspace ≠ memory.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs'
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
  if (!resolved.startsWith(SANDBOX)) {
    throw new Error(`Path escapes sandbox: ${input}`)
  }
  return resolved
}

// Ensure sandbox exists on import
if (!existsSync(SANDBOX)) mkdirSync(SANDBOX, { recursive: true })

// --- Memory ---

const MEMORY_DIR = resolve('memory')
const NOTES_FILE = resolve(MEMORY_DIR, 'notes.md')

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

export const saveNoteTool = {
  type: 'function' as const,
  function: {
    name: 'save_note',
    description: 'Save a note to persistent memory. Use this when the user tells you something worth remembering for future sessions.',
    parameters: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'The note to save' },
      },
      required: ['content'],
    },
  },
}

export const readNotesTool = {
  type: 'function' as const,
  function: {
    name: 'read_notes',
    description: 'Read all saved notes from persistent memory.',
    parameters: {
      type: 'object' as const,
      properties: {},
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
      const parent = resolve(filePath, '..')
      if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
      writeFileSync(filePath, args.content)
      return `Wrote ${args.content.length} bytes to ${args.path}`
    }
    if (name === 'save_note') {
      if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true })
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const line = `- [${timestamp}] ${args.content}\n`
      appendFileSync(NOTES_FILE, line)
      return `Saved note to memory.`
    }
    if (name === 'read_notes') {
      if (!existsSync(NOTES_FILE)) return 'No notes yet.'
      return readFileSync(NOTES_FILE, 'utf-8') || 'No notes yet.'
    }
    return `Unknown tool: ${name}`
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

/** Load notes from memory file, or return null if none exist. */
export function loadNotes(): string | null {
  if (!existsSync(NOTES_FILE)) return null
  const content = readFileSync(NOTES_FILE, 'utf-8').trim()
  return content || null
}

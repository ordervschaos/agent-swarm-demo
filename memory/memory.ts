/**
 * Memory — persistent episodic storage.
 *
 * save_note: append to notes.md — agent writes what it learns.
 * read_notes: read all saved notes — agent recalls what it learned.
 *
 * createMemoryExecutor(memoryDir) returns a bound executor for a specific memory dir.
 * The default functions use ./memory/ for backward compat.
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

// --- Tool definitions ---

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

// --- Parameterized execution ---

/** Create a bound memory executor for a specific memory directory. */
export function createMemoryExecutor(memoryDir: string): (name: string, args: Record<string, string>) => string | null {
  return (name: string, args: Record<string, string>): string | null => {
    const notesFile = resolve(memoryDir, 'notes.md')
    try {
      if (name === 'save_note') {
        if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true })
        const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
        const line = `- [${timestamp}] ${args.content}\n`
        appendFileSync(notesFile, line)
        return `Saved note to memory.`
      }
      if (name === 'read_notes') {
        if (!existsSync(notesFile)) return 'No notes yet.'
        return readFileSync(notesFile, 'utf-8') || 'No notes yet.'
      }
      return null
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }
}

/** Load notes from a specific memory directory. */
export function loadNotesFrom(memoryDir: string): string | null {
  const notesFile = resolve(memoryDir, 'notes.md')
  if (!existsSync(notesFile)) return null
  const content = readFileSync(notesFile, 'utf-8').trim()
  return content || null
}

// --- Default (backward compat) ---

const DEFAULT_MEMORY_DIR = resolve('memory')
const defaultExecutor = createMemoryExecutor(DEFAULT_MEMORY_DIR)

/** Execute a memory tool using the default ./memory/. Returns null if unrecognized. */
export function executeMemoryTool(name: string, args: Record<string, string>): string | null {
  return defaultExecutor(name, args)
}

/** Load notes from the default ./memory/notes.md. */
export function loadNotes(): string | null {
  return loadNotesFrom(DEFAULT_MEMORY_DIR)
}

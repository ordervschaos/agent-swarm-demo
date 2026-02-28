/**
 * Memory — persistent episodic storage.
 *
 * save_note: append to memory/notes.md — agent writes what it learns.
 * read_notes: read all saved notes     — agent recalls what it learned.
 *
 * Separate from the sandbox: memory/ persists what the agent knows;
 * sandbox/ is the workspace for what the agent does.
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const MEMORY_DIR = resolve('memory')
const NOTES_FILE = resolve(MEMORY_DIR, 'notes.md')

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

// --- Execution ---

/** Execute a memory tool. Returns null if the tool name is not recognized. */
export function executeMemoryTool(name: string, args: Record<string, string>): string | null {
  try {
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
    return null
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

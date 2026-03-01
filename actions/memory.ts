/**
 * Memory actions — persistent episodic storage.
 *
 * save_note: append to notes.md
 * read_notes: recall saved notes
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

// --- Tool definitions ---

export const tools = [
  {
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
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_notes',
      description: 'Read all saved notes from persistent memory.',
      parameters: {
        type: 'object' as const,
        properties: {},
      },
    },
  },
]

// --- Handler ---

export function createHandler(memoryDir: string): (name: string, args: Record<string, string>) => string | null {
  return (name, args) => {
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

/** Load notes from a memory directory (for system prompt injection). */
export function loadNotes(memoryDir: string): string | null {
  const notesFile = resolve(memoryDir, 'notes.md')
  if (!existsSync(notesFile)) return null
  const content = readFileSync(notesFile, 'utf-8').trim()
  return content || null
}

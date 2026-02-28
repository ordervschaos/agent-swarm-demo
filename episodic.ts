/**
 * Episodic Memory
 *
 * The agent loads persona.md (semantic memory) AND memory/notes.md (episodic memory)
 * at startup. It also has save_note and read_notes tools to write new memories.
 *
 * The lesson: episodic memory = persistent storage the agent reads AND writes.
 * Agent-curated (not human-curated like persona). This is auto-memory in NanoClaw.
 *
 * Run: npm run episodic "My name is Alex and my timezone is PST. Remember this for next time."
 * Then: npm run episodic "What's my name?"
 * Check: cat memory/notes.md
 */

import { loadPersona, buildSystemPrompt, allTools, runAgent } from './agent.js'
import { loadNotes } from './memory.js'

const identity = loadPersona()
console.log(`[memory] Loaded persona from persona.md (${identity.length} bytes)`)

const notes = loadNotes()
if (notes) {
  console.log(`[memory] Loaded ${notes.split('\n').length} note(s) from memory/notes.md`)
} else {
  console.log(`[memory] No previous notes found — starting fresh.`)
}
console.log()

const prompt = process.argv[2] || 'My name is Alex and my timezone is PST. Remember this for next time.'
let systemPrompt = buildSystemPrompt(identity, notes)
systemPrompt += '\n\nWhen the user tells you something worth remembering for future sessions (their name, preferences, facts about them), use the save_note tool to record it. Be selective — only save things that would be useful to know next time.'

console.log(`You: ${prompt}\n`)

const reply = await runAgent(prompt, systemPrompt, allTools, true)
console.log(`Agent: ${reply}`)
console.log(`\n--- Done ---`)

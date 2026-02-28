/**
 * Semantic Memory
 *
 * The agent loads persona.md at startup and injects it into the system prompt.
 * Same agent loop from Chapter 2, same sandbox actions. No memory tools needed —
 * persona is pre-loaded, not tool-accessed.
 *
 * The lesson: semantic memory = content loaded into the system prompt from a file.
 * Human-curated, burns context every run. This is CLAUDE.md in NanoClaw.
 *
 * Run: npm run semantic
 * Try: npm run semantic "Who are you?"
 * Try: Edit persona.md (change the name/personality), then run again.
 */

import { loadPersona, buildSystemPrompt, actionTools, runAgent } from './agent.js'

const identity = loadPersona()
console.log(`[memory] Loaded persona from persona.md (${identity.length} bytes)\n`)

const prompt = process.argv[2] || 'Introduce yourself and tell me what you can do.'
const systemPrompt = buildSystemPrompt(identity, null)

console.log(`You: ${prompt}\n`)

const reply = await runAgent(prompt, systemPrompt, actionTools, true)
console.log(`Agent: ${reply}`)
console.log(`\n--- Done ---`)

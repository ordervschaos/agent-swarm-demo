import { loadPersona, buildSystemPrompt, allTools, runAgent } from './agent.js'
import { loadNotes } from './memory/memory.js'

const prompt = process.argv[2]
if (!prompt) {
  console.error('Usage: npm start "<prompt>"')
  process.exit(1)
}

const identity = loadPersona()
const notes = loadNotes()
const reply = await runAgent(prompt, buildSystemPrompt(identity, notes), allTools, true)
console.log(reply)

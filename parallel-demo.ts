/**
 * Chapter 6: Parallel Demo — run multiple agents concurrently.
 *
 * Each agent has its own config (name, persona, sandbox, memory).
 * They run the same prompt via Promise.all — same cortex, different genomes.
 *
 * Run: npm run parallel
 * Run: npm run parallel "Write a haiku about your identity to sandbox/haiku.txt"
 */

import { readdirSync } from 'fs'
import { resolve } from 'path'
import { createDefaultConfig } from './agent-config.js'
import { loadPersona, buildSystemPrompt, runAgent, allTools } from './agent.js'
import { loadNotesFrom } from './memory/memory.js'

const prompt = process.argv[2] || 'Introduce yourself, then write a short file called sandbox/hello.txt with a greeting in your personal style.'

const agents = ['atlas', 'nova'].map(name => {
  const config = createDefaultConfig(name)
  const identity = loadPersona(config.persona)
  const notes = loadNotesFrom(config.memoryDir)
  const systemPrompt = buildSystemPrompt(identity, notes)
  return { config, systemPrompt }
})

console.log(`[parallel] Running ${agents.length} agents on the same prompt:`)
console.log(`  "${prompt}"\n`)

const start = Date.now()

const results = await Promise.all(
  agents.map(async ({ config, systemPrompt }) => {
    console.log(`[${config.name}] started`)
    const reply = await runAgent(prompt, systemPrompt, allTools, true, config)
    console.log(`[${config.name}] done\n`)
    return { name: config.name, reply, sandboxDir: config.sandboxDir }
  })
)

const elapsed = ((Date.now() - start) / 1000).toFixed(1)

console.log(`\n${'='.repeat(60)}`)
console.log(`Results (${elapsed}s total):`)
console.log(`${'='.repeat(60)}\n`)

for (const { name, reply, sandboxDir } of results) {
  console.log(`--- ${name} ---`)
  console.log(reply)
  console.log()

  // Show sandbox contents to prove isolation
  try {
    const files = readdirSync(sandboxDir)
    console.log(`  sandbox: ${files.length ? files.join(', ') : '(empty)'}`)
  } catch {
    console.log(`  sandbox: (not created)`)
  }
  console.log()
}

console.log(`Isolation check: each agent's files live in agents/{name}/sandbox/`)
console.log(`  ls agents/atlas/sandbox/`)
console.log(`  ls agents/nova/sandbox/`)

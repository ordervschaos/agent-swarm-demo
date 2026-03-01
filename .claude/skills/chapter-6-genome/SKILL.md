---
name: chapter-6-genome
description: Build Chapter 6 of the agent tutorial — The Genome (AgentConfig + parallel execution). Use when the student says "build chapter 6", "run multiple agents", "parallel agents", or wants to extract agent configuration for isolation. Requires Chapters 1-5 code to already exist.
---

# Chapter 6: The Genome — AgentConfig + Parallel Execution

Extract an `AgentConfig` from hardcoded globals so multiple agents can run in parallel with full isolation. The biological metaphor: DNA defines the organism before it's born. Different genomes produce different organisms from the same cellular machinery.

## Prerequisites

- Chapters 1-5 complete: `actions.ts`, `memory/memory.ts`, `agent.ts`, `llm.ts`, `index.ts`, `watch.ts`, `schedule.ts`
- Working API key in `.env.local`

## The pattern

**extract → parameterize → isolate → parallelize**

1. Define `AgentConfig` interface — what makes one agent different from another
2. Parameterize tool executors — `createActionExecutor(sandboxDir)`, `createMemoryExecutor(memoryDir)`
3. Update `runAgent()` to accept config — isolated sandbox and memory per agent
4. Run multiple agents with `Promise.all` — same prompt, different genomes, different results

## Create `agent-config.ts`

```typescript
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import type { ChatCompletionTool } from 'openai/resources/index'

export interface AgentConfig {
  name: string              // agent identifier (for logs)
  persona: string           // path to identity file
  memoryDir: string         // where notes.md lives
  sandboxDir: string        // isolated workspace
  model: string             // which LLM model ('' = use default)
  tools: ChatCompletionTool[] // capabilities
  maxIterations: number     // loop cap
}

export function createDefaultConfig(name: string): AgentConfig {
  const agentRoot = resolve('agents', name)
  const memoryDir = resolve(agentRoot, 'memory')
  const sandboxDir = resolve(agentRoot, 'sandbox')
  const persona = resolve(agentRoot, 'identity.md')

  for (const dir of [memoryDir, sandboxDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  return {
    name, persona, memoryDir, sandboxDir,
    model: '', tools: [], maxIterations: 15,
  }
}
```

## Modify `actions.ts`

Add `createActionExecutor(sandboxDir)` that returns a bound executor. Keep `executeAction()` as a default wrapper for backward compat.

## Modify `memory/memory.ts`

Add `createMemoryExecutor(memoryDir)` and `loadNotesFrom(memoryDir)`. Keep `executeMemoryTool()` and `loadNotes()` as defaults.

## Modify `agent.ts`

Add optional `config?: AgentConfig` parameter to `runAgent()`. When present, build tool executors from config paths. When absent, use defaults. Add `buildToolExecutor(config?)` helper.

## Create `agents/` directory

```
agents/
  atlas/
    identity.md    # Calm, precise personality (copy from memory/persona.md)
  nova/
    identity.md    # Enthusiastic, creative personality (different)
```

## Create `parallel-demo.ts`

```typescript
import { createDefaultConfig } from './agent-config.js'
import { loadPersona, buildSystemPrompt, runAgent, allTools } from './agent.js'
import { loadNotesFrom } from './memory/memory.js'

const prompt = process.argv[2] || 'Introduce yourself, then write a short file...'

const agents = ['atlas', 'nova'].map(name => {
  const config = createDefaultConfig(name)
  const identity = loadPersona(config.persona)
  const notes = loadNotesFrom(config.memoryDir)
  return { config, systemPrompt: buildSystemPrompt(identity, notes) }
})

const results = await Promise.all(
  agents.map(({ config, systemPrompt }) =>
    runAgent(prompt, systemPrompt, allTools, true, config)
  )
)
```

## Update `package.json`

- Change name to `chapter-6-genome`
- Add script: `"parallel": "node --no-deprecation --import tsx/esm parallel-demo.ts"`

## Update `.gitignore`

Add `agents/*/sandbox/` and `agents/*/memory/` — runtime data, not source.

## What to tell the student

- **Same cortex, different genome.** The LLM client, tool schemas, and agent loop are shared. The config (paths, identity, model) varies per agent. This is how one codebase serves many agents.
- **Parameterize, don't duplicate.** `createActionExecutor(sandboxDir)` is a factory that returns a closure bound to a specific directory. Same function, different environment. No code was copied.
- **Isolation is directory structure.** Each agent gets `agents/{name}/sandbox/` and `agents/{name}/memory/`. You can `ls` into each agent's world. No containers needed for isolation — just different paths.
- **`Promise.all` is the simplest concurrency.** No task queue, no worker pool. Just concurrent promises. The LLM provider handles rate limiting. This works until you have dozens of agents — then you need a semaphore.
- **Backward compat via defaults.** `executeAction()` still works with `./sandbox/`. `loadNotes()` still works with `./memory/`. Existing entry points (`index.ts`, `watch.ts`, `schedule.ts`) don't need changes.
- **In NanoClaw:** `groups/{name}/` is the AgentConfig. Each group has its own CLAUDE.md (persona), sandbox (container filesystem), and memory. The genome pattern is how NanoClaw scales to many groups.

# Minimal Agent Refactor

## What Changed

Removed all tutorial demo scaffolding. The codebase is now a functional agent, not a tutorial.

## Deleted

- `semantic.ts` — demo for semantic memory concept
- `episodic.ts` — demo for episodic memory concept
- `vigilance.ts` — demo for inbox watching
- `clock.ts` — demo for scheduled tasks

## Added

- `index.ts` — single CLI entry point (12 lines)

## Modified

- `agent.ts` — `buildSystemPrompt` now always includes memory save instruction (episodic memory is integrated, not optional)
- `package.json` — 4 scripts → 1 script: `npm start "<prompt>"`

## Final Structure

```
index.ts          # CLI entry point
agent.ts          # loop, tools, persona, system prompt
actions.ts        # sandbox file tools
llm.ts            # LLM client
memory/
  memory.ts       # save_note / read_notes tools
  persona.md      # identity
  notes.md        # runtime episodic data
```

## Usage

```bash
npm start "My name is Anzal. Remember this."
npm start "What's my name?"   # recalls from notes
```

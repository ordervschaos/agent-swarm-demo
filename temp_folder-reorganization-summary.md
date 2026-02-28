# Folder Reorganization: Memory Files Consolidated

## What Changed

Moved all memory-related files into the `memory/` directory so one folder owns everything memory-related.

## Before

```
tutorial/
  memory.ts       ← module at root
  persona.md      ← data file at root
  memory/
    (empty)       ← runtime data dir, nothing in it yet
```

## After

```
tutorial/
  memory/
    memory.ts     ← module (moved from root)
    persona.md    ← semantic identity (moved from root)
    notes.md      ← episodic data (written here at runtime)
```

## Files Updated

| File | Change |
|------|--------|
| `agent.ts` | Import from `./memory/memory.js`; `loadPersona` default → `memory/persona.md` |
| `episodic.ts` | Import from `./memory/memory.js`; console.log path updated |
| `vigilance.ts` | Import from `./memory/memory.js` |
| `clock.ts` | Import from `./memory/memory.js` |
| `semantic.ts` | console.log path updated |

## Verification

`npm run semantic "Who are you?"` works correctly, loading from `memory/persona.md`.

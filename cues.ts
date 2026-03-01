/**
 * Cue definitions — what the agent attends to.
 *
 * Adding a new cue = adding an object here + optionally a .md skill file.
 */

import type { Cue } from './attention.js'

export const cues: Cue[] = [
  {
    id: 'heartbeat',
    sensor: { type: 'clock', every: 30_000 },
    skill: 'heartbeat.md',
  },
  {
    id: 'memory-review',
    sensor: { type: 'clock', every: 2 * 60_000 },
    skill: 'memory-review.md',
  },
  {
    id: 'inbox',
    sensor: { type: 'inbox', dir: 'inbox', pattern: '*.txt' },
    // No skill — the file content IS the prompt
  },
]

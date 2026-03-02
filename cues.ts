/**
 * Cue definitions — what the agent attends to.
 *
 * Adding a new cue = adding an object here + optionally a .md skill file.
 */

import type { Cue } from './attention.js'

export const cues: Cue[] = [
  {
    id: 'heartbeat',
    agent: 'default',
    sensor: { type: 'clock', every: 30_000 },
    skill: 'heartbeat.md',
  },
  {
    id: 'memory-review',
    agent: 'default',
    sensor: { type: 'clock', every: 2 * 60_000 },
    skill: 'memory-review.md',
  },
  {
    id: 'inbox',
    agent: 'default',
    sensor: { type: 'inbox', dir: 'agents/default/inbox', pattern: '*.txt' },
  },
  {
    id: 'atlas-inbox',
    agent: 'atlas',
    sensor: { type: 'inbox', dir: 'agents/atlas/inbox', pattern: '*.txt' },
  },
  {
    id: 'nova-inbox',
    agent: 'nova',
    sensor: { type: 'inbox', dir: 'agents/nova/inbox', pattern: '*.txt' },
  },
  {
    id: 'leader-inbox',
    agent: 'leader',
    sensor: { type: 'inbox', dir: 'agents/leader/inbox', pattern: '*.txt' },
  },
]

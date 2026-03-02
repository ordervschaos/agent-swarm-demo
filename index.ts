/**
 * Entry point.
 *
 *   npm start              # REPL with default 'leader' agent
 *   npm start -- nova      # REPL with specific agent
 *   npm start -- nova "Write a haiku"   # single-shot mode
 */

import { Agent } from './agent.js'
import { runOnce, startRepl } from './ui.js'

const agentName = process.argv[2] || 'leader'
const singleShot = process.argv[3]

const agent = new Agent(agentName)

if (singleShot) {
  await runOnce(agent, singleShot)
} else {
  startRepl(agent)
}

/**
 * Awaken — start the agent's attention system.
 *
 * Creates an agent, gives it attention, wakes it up.
 */

import { Agent } from './agent.js'
import { Attention } from './attention.js'
import { cues } from './cues.js'

const agent = new Agent('default')
const attention = new Attention(agent, cues)

attention.awaken()

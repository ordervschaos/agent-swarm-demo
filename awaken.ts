/**
 * Awaken — start the agent's attention system.
 *
 * Creates an agent, gives it attention, wakes it up.
 */

import { Attention } from './attention.js'
import { cues } from './cues.js'

const attention = new Attention(cues)

attention.awaken()

/**
 * The Raw Cortex
 *
 * The LLM as a pure text generator. Tokens in, tokens out.
 * It can think, but it can't DO anything.
 *
 * Run: npm run raw-cortex
 */

import { llm, MODEL } from './llm.js'

const prompt = process.argv[2] || 'What files are in the current directory?'

const response = await llm.chat.completions.create({
  model: MODEL,
  messages: [{ role: 'user', content: prompt }],
})

console.log(response.choices[0].message.content)

// Try it: npm run raw-cortex "What files are in the current directory?"
//
// It will DESCRIBE what it would do — "I would run ls" — but it can't
// actually run ls. It's a cortex with no hands.

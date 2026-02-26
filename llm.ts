import { config } from 'dotenv'
config({ path: '.env.local' })
import OpenAI from 'openai'

// --- Pick your provider. Swap these two lines. ---

// Google Gemini (free tier — 1M tokens/min, no credit card)
export const llm = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})
export const MODEL = 'gemini-2.5-flash'

// // MiniMax (free quota, top tool-use benchmarks)
// export const llm = new OpenAI({ apiKey: process.env.MINIMAX_API_KEY, baseURL: 'https://api.minimax.chat/v1' })
// export const MODEL = 'MiniMax-M2.1'

// // Groq (free, 14,400 req/day, fastest inference)
// export const llm = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
// export const MODEL = 'llama-3.3-70b-versatile'

// // OpenRouter (50 req/day free, access to many models)
// export const llm = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })
// export const MODEL = 'google/gemini-2.5-flash'

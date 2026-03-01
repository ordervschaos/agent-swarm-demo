import { Agent } from './agent.js'

const prompt = process.argv[2]
if (!prompt) {
  console.error('Usage: npm start "<prompt>"')
  process.exit(1)
}

const agent = new Agent('default')
agent.verbose = true
const reply = await agent.run(prompt)
console.log(reply)

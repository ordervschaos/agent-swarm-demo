import { Agent } from './agent.js'

const prompt = process.argv[2]
if (!prompt) {
  console.error('Usage: npm start "<prompt>" [agent]')
  process.exit(1)
}

const agentName = process.argv[3] || 'leader'

const agent = new Agent(agentName)
agent.verbose = true
const reply = await agent.deliberate(prompt)
console.log(reply)

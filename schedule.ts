import { Agent } from './agent.js'

const agent = new Agent('default')

interface Task { id: string; prompt: string; every: number }

const TASKS: Task[] = [
  {
    id: 'heartbeat',
    prompt: 'Write the current timestamp and a one-line status to sandbox/heartbeat.txt',
    every: 30_000,
  },
  {
    id: 'memory-review',
    prompt: 'Read your notes and write a one-paragraph summary to sandbox/summary.txt',
    every: 2 * 60_000,
  },
]

const nextRun: Record<string, number> = Object.fromEntries(TASKS.map(t => [t.id, 0]))

async function tick() {
  const now = Date.now()
  for (const task of TASKS) {
    if (now < nextRun[task.id]) continue
    console.log(`[${task.id}] running`)
    try {
      const reply = await agent.run(task.prompt)
      console.log(`[${task.id}] ${reply.slice(0, 100)}${reply.length > 100 ? '...' : ''}`)
    } catch (e: any) {
      console.error(`[${task.id}] error: ${e.message}`)
    }
    nextRun[task.id] = Date.now() + task.every
  }
}

console.log(`${TASKS.length} task(s): ${TASKS.map(t => `${t.id} every ${t.every / 1000}s`).join(', ')}`)

tick()
setInterval(tick, 5_000)

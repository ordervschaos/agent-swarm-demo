/**
 * Delegation actions — synchronous leader->worker coordination.
 *
 * delegate_task: instantiate a worker agent, run it to completion, return result
 * list_team:     discover available agents for delegation
 */

import { existsSync, readdirSync, statSync } from 'fs'
import { resolve } from 'path'
import type { ChatCompletionTool } from 'openai/resources/index'

const AGENTS_DIR = resolve('agents')

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'delegate_task',
      description:
        'Delegate a task to another agent synchronously. The agent will execute the task and return their full response. Use this for coordinated work where you need the result before proceeding.',
      parameters: {
        type: 'object',
        properties: {
          agent: { type: 'string', description: 'Name of the agent to delegate to (e.g. "atlas", "nova")' },
          task: { type: 'string', description: 'The task description for the worker agent' },
        },
        required: ['agent', 'task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_team',
      description: 'List all agents available on your team for delegation.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

export type AgentFactory = (name: string) => { deliberate(prompt: string): Promise<string>; verbose: boolean }

export function createHandler(agentFactory: AgentFactory) {
  return async (name: string, args: Record<string, string>): Promise<string | null> => {
    try {
      if (name === 'delegate_task') {
        const { agent, task } = args
        if (!agent || !task) return 'Error: "agent" and "task" are required'

        if (!existsSync(resolve(AGENTS_DIR, agent))) {
          return `Error: agent "${agent}" does not exist`
        }

        const worker = agentFactory(agent)
        worker.verbose = true
        console.log(`[delegation] delegating to ${agent}: ${task.slice(0, 100)}`)
        const result = await worker.deliberate(task)
        console.log(`[delegation] ${agent} finished`)
        return result
      }

      if (name === 'list_team') {
        if (!existsSync(AGENTS_DIR)) return '(no agents found)'
        const agents = readdirSync(AGENTS_DIR)
          .filter(f => statSync(resolve(AGENTS_DIR, f)).isDirectory())
        return agents.length > 0
          ? agents.map(a => `- ${a}`).join('\n')
          : '(no agents found)'
      }

      return null
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }
}

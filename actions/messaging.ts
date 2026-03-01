/**
 * Messaging actions — inter-agent communication.
 *
 * send_message: drop a message into another agent's inbox
 * list_agents:  discover which agents exist
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { resolve } from 'path'

const AGENTS_DIR = resolve('agents')

// --- Tool definitions ---

export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'send_message',
      description: 'Send a message to another agent. The message will appear in their inbox.',
      parameters: {
        type: 'object' as const,
        properties: {
          to: { type: 'string', description: 'Name of the target agent (e.g. "atlas", "nova")' },
          message: { type: 'string', description: 'The message to send' },
        },
        required: ['to', 'message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_agents',
      description: 'List all agents you can send messages to.',
      parameters: { type: 'object' as const, properties: {} },
    },
  },
]

// --- Handler ---

export function createHandler(senderName: string): (name: string, args: Record<string, string>) => string | null {
  return (name, args) => {
    try {
      if (name === 'send_message') {
        const { to, message } = args
        if (!to || !message) return 'Error: "to" and "message" are required'
        if (to === senderName) return 'Error: cannot send a message to yourself'

        const targetInbox = resolve(AGENTS_DIR, to, 'inbox')
        if (!existsSync(resolve(AGENTS_DIR, to))) {
          return `Error: agent "${to}" does not exist`
        }
        if (!existsSync(targetInbox)) mkdirSync(targetInbox, { recursive: true })

        const timestamp = Date.now()
        const random = Math.random().toString(36).slice(2, 8)
        const filename = `${timestamp}-${random}.txt`
        const content = `From: ${senderName}\n\n${message}`

        writeFileSync(resolve(targetInbox, filename), content)
        return `Message sent to ${to}`
      }

      if (name === 'list_agents') {
        if (!existsSync(AGENTS_DIR)) return '(no agents found)'
        const agents = readdirSync(AGENTS_DIR)
          .filter(f => statSync(resolve(AGENTS_DIR, f)).isDirectory())
          .filter(f => f !== senderName)
        return agents.length > 0 ? agents.join('\n') : '(no other agents found)'
      }

      return null
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }
}

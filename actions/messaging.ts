/**
 * Messaging actions — inter-agent communication.
 *
 * send_message:   drop a message into another agent's agent-messages/ directory
 * read_messages:  read messages from your own agent-messages/ directory
 * list_agents:    discover which agents exist
 *
 * Note: agent-messages/ is separate from inbox/. The daemon watches inbox/
 * for external triggers (WhatsApp, cron). agent-messages/ is only for
 * inter-agent communication, read during the agent's own deliberation loop.
 */

import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { resolve } from 'path'

const AGENTS_DIR = resolve('agents')

// --- Tool definitions ---

export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'send_message',
      description: 'Send a message to another agent. The message will appear in their agent-messages directory for them to read.',
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
      name: 'read_messages',
      description: 'Read all messages in your agent-messages directory. Returns messages from other agents. Messages are removed after reading.',
      parameters: { type: 'object' as const, properties: {} },
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

export function createHandler(senderName: string, agentMessagesDir: string): (name: string, args: Record<string, string>) => string | null {
  if (!existsSync(agentMessagesDir)) mkdirSync(agentMessagesDir, { recursive: true })

  return (name, args) => {
    try {
      if (name === 'send_message') {
        const { to, message } = args
        if (!to || !message) return 'Error: "to" and "message" are required'
        if (to === senderName) return 'Error: cannot send a message to yourself'

        const targetDir = resolve(AGENTS_DIR, to, 'agent-messages')
        if (!existsSync(resolve(AGENTS_DIR, to))) {
          return `Error: agent "${to}" does not exist`
        }
        if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })

        const timestamp = Date.now()
        const random = Math.random().toString(36).slice(2, 8)
        const filename = `${timestamp}-${random}.txt`
        const content = `From: ${senderName}\n\n${message}`

        writeFileSync(resolve(targetDir, filename), content)
        return `Message sent to ${to}`
      }

      if (name === 'read_messages') {
        if (!existsSync(agentMessagesDir)) return '(no messages)'
        const files = readdirSync(agentMessagesDir)
          .filter(f => f.endsWith('.txt'))
          .sort()
        if (files.length === 0) return '(no messages)'

        const messages: string[] = []
        for (const file of files) {
          const filePath = resolve(agentMessagesDir, file)
          messages.push(readFileSync(filePath, 'utf-8'))
          unlinkSync(filePath) // consume after reading
        }
        return messages.join('\n---\n')
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

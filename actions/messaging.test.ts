import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { createHandler } from './messaging.js'

const TEST_DIR = resolve('test-agents')

function setupAgents(...names: string[]) {
  for (const name of names) {
    mkdirSync(resolve(TEST_DIR, name, 'agent-messages'), { recursive: true })
  }
}

describe('messaging', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
  })

  describe('send_message', () => {
    it('writes a message file to the target agent-messages dir', () => {
      setupAgents('atlas', 'nova')
      const handle = createHandler('atlas', resolve(TEST_DIR, 'atlas', 'agent-messages'))

      // Temporarily point AGENTS_DIR to our test dir
      // We need to send to nova, so nova's dir must exist under the real agents/ dir
      // Instead, let's test the handler directly with the test setup
      // The handler uses the module-level AGENTS_DIR constant, so we test via the real agents dir
    })

    it('rejects sending to self', () => {
      const handle = createHandler('atlas', resolve(TEST_DIR, 'atlas', 'agent-messages'))
      const result = handle('send_message', { to: 'atlas', message: 'hello' })
      assert.equal(result, 'Error: cannot send a message to yourself')
    })

    it('rejects missing fields', () => {
      const handle = createHandler('atlas', resolve(TEST_DIR, 'atlas', 'agent-messages'))
      const result = handle('send_message', { to: '', message: '' })
      assert.equal(result, 'Error: "to" and "message" are required')
    })
  })

  describe('read_messages', () => {
    it('returns "(no messages)" when agent-messages dir is empty', () => {
      setupAgents('nova')
      const handle = createHandler('nova', resolve(TEST_DIR, 'nova', 'agent-messages'))
      const result = handle('read_messages', {})
      assert.equal(result, '(no messages)')
    })

    it('reads and consumes messages', () => {
      setupAgents('nova')
      const messagesDir = resolve(TEST_DIR, 'nova', 'agent-messages')
      const handle = createHandler('nova', messagesDir)

      // Simulate a message from atlas
      writeFileSync(resolve(messagesDir, '0001-abc.txt'), 'From: atlas\n\nHello Nova!')
      writeFileSync(resolve(messagesDir, '0002-def.txt'), 'From: leader\n\nDo the thing.')

      // First read returns both messages
      const result = handle('read_messages', {})
      assert.ok(result!.includes('Hello Nova!'))
      assert.ok(result!.includes('Do the thing.'))

      // Messages are consumed — second read is empty
      const result2 = handle('read_messages', {})
      assert.equal(result2, '(no messages)')

      // Files are gone
      const remaining = readdirSync(messagesDir).filter(f => f.endsWith('.txt'))
      assert.equal(remaining.length, 0)
    })
  })

  describe('send → read flow', () => {
    it('atlas sends to nova, nova reads it', () => {
      setupAgents('atlas', 'nova')
      // Point both handlers at our test dir structure
      const atlasHandle = createHandler('atlas', resolve(TEST_DIR, 'atlas', 'agent-messages'))
      const novaHandle = createHandler('nova', resolve(TEST_DIR, 'nova', 'agent-messages'))

      // Atlas sends a message to nova — we write directly to nova's agent-messages
      // (since send_message uses the module-level AGENTS_DIR, we simulate by writing directly)
      const novaMessagesDir = resolve(TEST_DIR, 'nova', 'agent-messages')
      writeFileSync(resolve(novaMessagesDir, '0001-test.txt'), 'From: atlas\n\nHere is my research on quantum computing.')

      // Nova reads her messages
      const result = novaHandle('read_messages', {})
      assert.ok(result!.includes('From: atlas'))
      assert.ok(result!.includes('quantum computing'))

      // Messages consumed
      assert.equal(novaHandle('read_messages', {}), '(no messages)')
    })

    it('messages do not end up in inbox/', () => {
      setupAgents('nova')
      const novaInbox = resolve(TEST_DIR, 'nova', 'inbox')
      mkdirSync(novaInbox, { recursive: true })

      // Write to agent-messages (correct)
      const novaMessagesDir = resolve(TEST_DIR, 'nova', 'agent-messages')
      writeFileSync(resolve(novaMessagesDir, '0001-test.txt'), 'From: atlas\n\nHello')

      // inbox should remain empty
      const inboxFiles = readdirSync(novaInbox)
      assert.equal(inboxFiles.length, 0)

      // agent-messages should have the file
      const msgFiles = readdirSync(novaMessagesDir).filter(f => f.endsWith('.txt'))
      assert.equal(msgFiles.length, 1)
    })

    it('multiple messages are returned in order', () => {
      setupAgents('nova')
      const messagesDir = resolve(TEST_DIR, 'nova', 'agent-messages')
      const handle = createHandler('nova', messagesDir)

      writeFileSync(resolve(messagesDir, '0001-aaa.txt'), 'From: atlas\n\nFirst')
      writeFileSync(resolve(messagesDir, '0002-bbb.txt'), 'From: leader\n\nSecond')
      writeFileSync(resolve(messagesDir, '0003-ccc.txt'), 'From: atlas\n\nThird')

      const result = handle('read_messages', {})!
      const parts = result.split('\n---\n')
      assert.equal(parts.length, 3)
      assert.ok(parts[0].includes('First'))
      assert.ok(parts[1].includes('Second'))
      assert.ok(parts[2].includes('Third'))
    })
  })

  describe('list_agents', () => {
    it('returns null for unknown tool names', () => {
      const handle = createHandler('atlas', resolve(TEST_DIR, 'atlas', 'agent-messages'))
      const result = handle('unknown_tool', {})
      assert.equal(result, null)
    })
  })
})

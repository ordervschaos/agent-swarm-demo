/**
 * Terminal UI — ANSI rendering, spinner, REPL, and event handler.
 */

import * as readline from 'readline'
import type { Agent } from './agent.js'
import type { AgentEvent } from './agent.js'

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const ESC = '\x1b['
const c = {
  reset:   `${ESC}0m`,
  bold:    `${ESC}1m`,
  dim:     `${ESC}2m`,
  italic:  `${ESC}3m`,
  cyan:    `${ESC}36m`,
  green:   `${ESC}32m`,
  yellow:  `${ESC}33m`,
  magenta: `${ESC}35m`,
  white:   `${ESC}37m`,
}

// ── Spinner ───────────────────────────────────────────────────────────────────

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
let interval: ReturnType<typeof setInterval> | null = null
let frame = 0

function startSpinner(label: string) {
  stopSpinner()
  frame = 0
  interval = setInterval(() => {
    const f = FRAMES[frame++ % FRAMES.length]
    process.stdout.write(`\r${c.cyan}${f}${c.reset} ${c.dim}${label}${c.reset}`)
  }, 80)
}

function stopSpinner() {
  if (interval) {
    clearInterval(interval)
    interval = null
    process.stdout.write('\r\x1b[K')
  }
}

// ── Output formatting ─────────────────────────────────────────────────────────

function printHeader(agentName: string) {
  const w = Math.min(process.stdout.columns || 80, 80)
  const title = ` ${agentName} `
  const line = '─'.repeat(Math.max(0, w - title.length - 4))
  console.log(`\n${c.cyan}╭─${c.bold}${title}${c.reset}${c.cyan}${line}╮${c.reset}`)
  console.log(`${c.cyan}│${c.reset} ${c.dim}Type a message to begin. /quit to exit.${c.reset}`)
  console.log(`${c.cyan}╰${'─'.repeat(w - 2)}╯${c.reset}\n`)
}

function printThinking(text: string) {
  for (const line of text.split('\n')) {
    console.log(`  ${c.yellow}${c.italic}${line}${c.reset}`)
  }
}

function printToolStart(name: string, args: Record<string, unknown>) {
  const argStr = Object.entries(args)
    .map(([k, v]) => {
      const val = typeof v === 'string' && v.length > 60 ? v.slice(0, 57) + '...' : v
      return `${c.dim}${k}=${c.reset}${c.white}${JSON.stringify(val)}${c.reset}`
    })
    .join(` ${c.dim},${c.reset} `)
  console.log(`  ${c.magenta}●${c.reset} ${c.bold}${name}${c.reset}(${argStr})`)
}

function printToolEnd(result: string) {
  const truncated = result.length > 300 ? result.slice(0, 297) + '...' : result
  for (const line of truncated.split('\n')) {
    console.log(`    ${c.dim}↳ ${line}${c.reset}`)
  }
}

function printResponse(text: string, cycles: number) {
  console.log()
  console.log(text)
  console.log(`\n${c.dim}(${cycles} cycle${cycles === 1 ? '' : 's'})${c.reset}`)
}

// ── Event handler ─────────────────────────────────────────────────────────────

function handleEvent(event: AgentEvent) {
  switch (event.type) {
    case 'thinking':
      stopSpinner()
      printThinking(event.text)
      startSpinner('Thinking...')
      break
    case 'tool_start':
      stopSpinner()
      printToolStart(event.name, event.args)
      startSpinner(`Running ${event.name}...`)
      break
    case 'tool_end':
      stopSpinner()
      printToolEnd(event.result)
      break
    case 'response':
      stopSpinner()
      printResponse(event.text, event.cycles)
      break
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Run a single prompt, print the result, and exit. */
export async function runOnce(agent: Agent, prompt: string) {
  agent.onEvent = handleEvent
  startSpinner('Thinking...')
  await agent.deliberate(prompt)
}

/** Start an interactive REPL loop. */
export function startRepl(agent: Agent) {
  agent.onEvent = handleEvent
  printHeader(agent.config.name)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.green}❯${c.reset} `,
  })

  const goodbye = () => {
    stopSpinner()
    console.log(`\n${c.dim}Goodbye.${c.reset}\n`)
    process.exit(0)
  }

  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()
    if (!input) { rl.prompt(); return }

    if (input === '/quit' || input === '/exit') goodbye()

    if (input === '/help') {
      console.log(`\n${c.bold}Commands:${c.reset}`)
      console.log(`  ${c.cyan}/quit${c.reset}    Exit the session`)
      console.log(`  ${c.cyan}/help${c.reset}    Show this help`)
      console.log()
      rl.prompt()
      return
    }

    rl.pause()
    console.log()
    startSpinner('Thinking...')

    try {
      await agent.deliberate(input)
    } catch (err: unknown) {
      stopSpinner()
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`\n  ${c.yellow}Error: ${msg}${c.reset}`)
    }

    console.log()
    rl.resume()
    rl.prompt()
  })

  rl.on('close', goodbye)
}

import { watch, readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { Agent } from './agent.js'

const INBOX  = resolve('inbox')
const OUTBOX = resolve('outbox')

for (const dir of [INBOX, OUTBOX]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

const agent = new Agent('default')
const processing = new Set<string>()

async function handleFile(filename: string) {
  if (!filename.endsWith('.txt') || filename.startsWith('._')) return
  if (processing.has(filename)) return

  const src = resolve(INBOX, filename)
  const tmp = resolve(INBOX, `._${filename}`)

  try { renameSync(src, tmp) } catch { return }

  processing.add(filename)

  const task = readFileSync(tmp, 'utf-8').trim()
  console.log(`[inbox] ${filename}: ${task.slice(0, 80)}${task.length > 80 ? '...' : ''}`)

  try {
    const reply = await agent.deliberate(task)
    writeFileSync(resolve(OUTBOX, filename), reply)
    console.log(`[outbox] ${filename}: ${reply.slice(0, 80)}${reply.length > 80 ? '...' : ''}`)
  } catch (e: any) {
    writeFileSync(resolve(OUTBOX, filename), `[error] ${e.message}`)
    console.error(`[error] ${filename}: ${e.message}`)
  } finally {
    processing.delete(filename)
    try { rmSync(tmp) } catch {}
  }
}

for (const f of readdirSync(INBOX)) handleFile(f)

watch(INBOX, (_, filename) => { if (filename) handleFile(filename) })

console.log(`watching inbox/ → outbox/`)
